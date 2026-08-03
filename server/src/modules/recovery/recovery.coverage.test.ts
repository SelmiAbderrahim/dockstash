import { Readable } from 'node:stream';
import type { RequestHandler } from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User, ROLE_ADMIN } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { encryptSecret } from '../../shared/crypto/index.js';
import type { ResticRunner, ResticBackupOptions } from '../backups/backups.boundaries.js';
import { buildExportEnvelope } from './recovery.export.js';
import { importEnvelope } from './recovery.import.js';
import {
  runSelfBackup,
  registerSelfBackupCron,
  type MongoDumpRunner,
} from './recovery.selfbackup.js';
import { SelfBackupRun } from './recovery.model.js';
import {
  configureRecoveryController,
  resetRecoveryController,
  exportConfig,
  importConfig,
  enableRecoveryCodes,
  triggerSelfBackup,
} from './recovery.controller.js';
import type { ImportEnvelope } from './recovery.schema.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(
  email: string,
  role?: string,
): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'R', lastName: 'U' },
    emailVerified: true,
    ...(role ? { role } : {}),
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

function makeRestic(): ResticRunner {
  return {
    async init() {},
    async backup(_args: string[], opts?: ResticBackupOptions) {
      if (opts?.stdin) {
        await new Promise<void>((resolve) => {
          opts.stdin!.on('end', () => resolve());
          opts.stdin!.resume();
        });
      }
    },
    async snapshots() {
      return [];
    },
    async check() {},
    async restore() {},
    async snapshotsDetailed() {
      return [];
    },
    async dump(): Promise<never> {
      throw new Error('dump not stubbed');
    },
  };
}

function makeMongoDump(): MongoDumpRunner {
  return {
    async dump() {
      return Readable.from(['archive-bytes']);
    },
  };
}

type FakeRes = {
  statusCode: number;
  headers: Record<string, string>;
  body?: unknown;
  setHeader(k: string, v: string): void;
  status(c: number): FakeRes;
  json(b: unknown): FakeRes;
};

/**
 * Invoke a controller handler directly (bypassing the language middleware) so
 * the `!req.t` fallback branches are exercised. Resolves when the handler calls
 * `res.json`; rejects when the handler forwards an error to `next`.
 */
function invoke(handler: RequestHandler, req: unknown): Promise<FakeRes> {
  return new Promise<FakeRes>((resolve, reject) => {
    const res: FakeRes = {
      statusCode: 200,
      headers: {},
      setHeader(k, v) {
        this.headers[k.toLowerCase()] = v;
      },
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.body = b;
        resolve(this);
        return this;
      },
    };
    handler(req as never, res as never, ((err?: unknown) =>
      err ? reject(err) : resolve(res)) as never);
  });
}

function validEnvelope(id = '507f1f77bcf86cd799439011', name = 'p'): ImportEnvelope {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    keyVersion: 1,
    projects: [
      {
        id,
        name,
        path: '/var/www/p',
        plan: { paths: ['/var/www/p'], databases: [], configs: [] },
        repoPasswordEnc: encryptSecret('coverage-secret-42'),
      },
    ],
  };
}

describe('recovery coverage: export envelope branches', () => {
  it('maps databases (enabled true+false), emits storage w/ sshKey, summary keyVersion', async () => {
    const fakeProjects = [
      {
        _id: { toString: () => 'proj-1' },
        name: 'n',
        path: '/p',
        plan: {
          paths: ['/p'],
          databases: [
            { service: 'db1', type: 'postgres', container: 'c1', enabled: true },
            { service: 'db2', type: 'mysql', container: 'c2', enabled: false },
          ],
          configs: ['cfg'],
        },
        repoPasswordEnc: { ciphertext: 'ct', iv: 'iv', authTag: 'at', keyVersion: 3 },
      },
    ];
    const envelope = await buildExportEnvelope('u1', {
      findProjects: async () => fakeProjects as never,
      loadStorage: async () => ({
        host: 'h',
        user: 'u',
        sshKeyEnc: { ciphertext: 'c', iv: 'i', authTag: 'a', keyVersion: 1 },
      }),
    });
    expect(envelope.projects[0]!.plan.databases).toHaveLength(2);
    expect(envelope.projects[0]!.plan.databases[0]!.enabled).toBe(true);
    expect(envelope.projects[0]!.plan.databases[1]!.enabled).toBe(false);
    expect(envelope.storage).toEqual({
      host: 'h',
      user: 'u',
      sshKeyEnc: { ciphertext: 'c', iv: 'i', authTag: 'a', keyVersion: 1 },
    });
    expect(envelope.keyVersion).toBe(3);
  });

  it('emits storage without sshKeyEnc; empty projects → summary keyVersion 0', async () => {
    const envelope = await buildExportEnvelope('u1', {
      findProjects: async () => [] as never,
      loadStorage: async () => ({ host: 'h', user: 'u' }),
    });
    expect(envelope.storage).toEqual({ host: 'h', user: 'u' });
    expect(envelope.keyVersion).toBe(0);
  });

  it('loadStorage returning null / partial host/user yields undefined storage', async () => {
    const nullStorage = await buildExportEnvelope('u1', {
      findProjects: async () => [] as never,
      loadStorage: async () => null,
    });
    expect(nullStorage.storage).toBeUndefined();

    const missingHost = await buildExportEnvelope('u1', {
      findProjects: async () => [] as never,
      loadStorage: async () => ({ host: '', user: 'u' }),
    });
    expect(missingHost.storage).toBeUndefined();

    const missingUser = await buildExportEnvelope('u1', {
      findProjects: async () => [] as never,
      loadStorage: async () => ({ host: 'h', user: '' }),
    });
    expect(missingUser.storage).toBeUndefined();
  });
});

describe('recovery coverage: DB-backed branches', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
    resetRecoveryController();
  });

  it('import: validates storage.sshKeyEnc, probes reachable on create + reconcile-with-databases', async () => {
    const owner = await seedUser('cov-imp@t.com');
    const envelope: ImportEnvelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      keyVersion: 1,
      projects: [
        {
          id: '507f1f77bcf86cd799439055',
          name: 'p',
          path: '/var/www/p',
          plan: {
            paths: ['/var/www/p'],
            databases: [{ service: 's', type: 'postgres', container: 'c', enabled: true }],
            configs: ['/var/www/p/cfg'],
          },
          repoPasswordEnc: encryptSecret('reachable-pw-42'),
        },
      ],
      storage: { host: 'h', user: 'u', sshKeyEnc: encryptSecret('ssh-key-material') },
    };
    const probed: string[] = [];
    const storageProbe = async (_p: unknown, pw: string): Promise<void> => {
      probed.push(pw);
    };

    const r1 = await importEnvelope(owner.id, envelope, { storageProbe });
    expect(r1.imported).toBe(1);
    expect(r1.reachable).toBe(1);

    const r2 = await importEnvelope(owner.id, envelope, { storageProbe });
    expect(r2.reconciled).toBe(1);
    expect(r2.reachable).toBe(1);
    expect(probed).toHaveLength(2);

    const proj = await Project.findOne({ owner: owner.id });
    expect(proj!.plan.databases).toHaveLength(1);
  });

  it('import: probeReachable swallows a failing storageProbe (reachable stays 0)', async () => {
    const owner = await seedUser('cov-probe-fail@t.com');
    const envelope: ImportEnvelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      keyVersion: 1,
      projects: [
        {
          id: '507f1f77bcf86cd799439066',
          name: 'p',
          path: '/var/www/p',
          plan: { paths: ['/var/www/p'], databases: [], configs: [] },
          repoPasswordEnc: encryptSecret('unreachable-pw-42'),
        },
      ],
    };
    const storageProbe = async (): Promise<void> => {
      throw new Error('repo unreachable');
    };
    const result = await importEnvelope(owner.id, envelope, { storageProbe });
    expect(result.imported).toBe(1);
    expect(result.reachable).toBe(0);
  });

  it('runSelfBackup: ensureRepoInitialized runs before dump', async () => {
    let inited = false;
    const result = await runSelfBackup({
      resticRunner: makeRestic(),
      mongoDump: makeMongoDump(),
      ensureRepoInitialized: async () => {
        inited = true;
      },
    });
    expect(inited).toBe(true);
    expect(result.status).toBe('success');
  });

  it('runSelfBackup: non-Error dump failure is stringified', async () => {
    const dump = {
      async dump(): Promise<Readable> {
        throw 'raw-string-failure';
      },
    };
    const result = await runSelfBackup({ resticRunner: makeRestic(), mongoDump: dump });
    expect(result.status).toBe('failed');
    expect(result.error).toBe('raw-string-failure');
  });

  it('runSelfBackup: destroys dump stream on failure even when destroy throws', async () => {
    const fakeStream = {
      destroy() {
        throw new Error('destroy-boom');
      },
    } as unknown as Readable;
    const dump: MongoDumpRunner = {
      async dump() {
        return fakeStream;
      },
    };
    const restic: ResticRunner = {
      async init() {},
      async backup() {
        throw new Error('backup-failed');
      },
      async snapshots() {
        return [];
      },
      async check() {},
      async restore() {},
      async snapshotsDetailed() {
        return [];
      },
      async dump(): Promise<never> {
        throw new Error('dump not stubbed');
      },
    };
    const result = await runSelfBackup({ resticRunner: restic, mongoDump: dump });
    expect(result.status).toBe('failed');
    expect(result.error).toContain('backup-failed');
  });

  it('registerSelfBackupCron: tick succeeds normally and catches+logs enqueue failure', async () => {
    let captured: (() => Promise<void>) | null = null;
    const cron = {
      register(_id: string, _expr: string, cb: () => Promise<void>) {
        captured = cb;
      },
      unregister() {},
      list() {
        return [] as string[];
      },
      clear() {},
    };

    // Happy path — enqueue resolves, catch block is skipped.
    let enqueued = 0;
    registerSelfBackupCron({
      cron,
      enqueue: async () => {
        enqueued += 1;
      },
    });
    await expect((captured as unknown as () => Promise<void>)()).resolves.toBeUndefined();
    expect(enqueued).toBe(1);

    // Failure path — enqueue throws, error is caught and logged.
    registerSelfBackupCron({
      cron,
      enqueue: async () => {
        throw new Error('enqueue-fail');
      },
    });
    await expect((captured as unknown as () => Promise<void>)()).resolves.toBeUndefined();
  });

  it('importConfig without req.t: envelope-wrapped, raw body, and missing body', async () => {
    const owner = await seedUser('cov-ctl-imp@t.com');

    const wrapped = await invoke(importConfig, {
      user: { id: owner.id },
      body: { envelope: validEnvelope('507f1f77bcf86cd799439101') },
    });
    expect((wrapped.body as { message: string }).message).toBe('recovery.success.imported');
    expect((wrapped.body as { imported: number }).imported).toBe(1);

    const raw = await invoke(importConfig, {
      user: { id: owner.id },
      body: validEnvelope('507f1f77bcf86cd799439102'),
    });
    expect((raw.body as { imported: number }).imported).toBe(1);

    await expect(invoke(importConfig, { user: { id: owner.id } })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('exportConfig without req.t sets attachment headers', async () => {
    const owner = await seedUser('cov-ctl-exp@t.com');
    const res = await invoke(exportConfig, { user: { id: owner.id } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
  });

  it('enableRecoveryCodes without req.t uses the fallback message', async () => {
    const owner = await seedUser('cov-ctl-codes@t.com');
    const res = await invoke(enableRecoveryCodes, { user: { id: owner.id } });
    expect(res.statusCode).toBe(201);
    expect((res.body as { message: string }).message).toBe('recovery.success.escrowEnabled');
    expect((res.body as { enabled: boolean }).enabled).toBe(true);
  });

  it('triggerSelfBackup without config or req.t throws the plain fallback error', async () => {
    await expect(
      invoke(triggerSelfBackup, { user: { id: '507f1f77bcf86cd799439011' } }),
    ).rejects.toMatchObject({ message: 'self-backup not configured' });
  });

  it('POST /self-backup runs the injected runNow path', async () => {
    const owner = await seedUser('cov-runnow@t.com', ROLE_ADMIN);
    configureRecoveryController({ runNow: async () => ({ ran: true }) });
    const res = await request(app)
      .post('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(202);
    expect(res.body.triggered).toBe(true);
    expect(res.body.result).toEqual({ ran: true });
  });

  it('POST /self-backup runs the injected restic+mongoDump path', async () => {
    const owner = await seedUser('cov-direct@t.com', ROLE_ADMIN);
    configureRecoveryController({ resticRunner: makeRestic(), mongoDump: makeMongoDump() });
    const res = await request(app)
      .post('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(202);
    expect(res.body.triggered).toBe(true);
    expect(res.body.status).toBe('success');
  });

  it('POST /self-backup with only resticRunner (no mongoDump) falls through to 500', async () => {
    const owner = await seedUser('cov-partial@t.com', ROLE_ADMIN);
    configureRecoveryController({ resticRunner: makeRestic() });
    const res = await request(app)
      .post('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(500);
  });

  it('POST /self-backup with nothing configured returns 500 (localized via req.t)', async () => {
    const owner = await seedUser('cov-none@t.com', ROLE_ADMIN);
    const res = await request(app)
      .post('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(500);
  });

  it('GET /self-backup renders null startedAt/finishedAt for a raw running row', async () => {
    const owner = await seedUser('cov-list-null@t.com', ROLE_ADMIN);
    await SelfBackupRun.collection.insertOne({ repo: env.SELF_BACKUP_REPO, status: 'running' });
    const res = await request(app)
      .get('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(200);
    const run = res.body.runs.find(
      (r: { status: string }) => r.status === 'running',
    );
    expect(run.startedAt).toBeNull();
    expect(run.finishedAt).toBeNull();
  });
});
