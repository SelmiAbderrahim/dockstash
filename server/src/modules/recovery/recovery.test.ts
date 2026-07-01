import { Readable } from 'node:stream';
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
import { User } from '../users/index.js';
import { createProject } from '../backups/backups.service.js';
import { Project, type ProjectHydrated } from '../backups/backups.model.js';
import { verifyKeyParity } from '../../shared/i18n/index.js';
import { encryptSecret, decryptSecret } from '../../shared/crypto/index.js';
import { MemoryQueue } from '../scheduler/scheduler.queue.memory.js';
import type { ResticRunner, ResticBackupOptions } from '../backups/backups.boundaries.js';
import {
  buildExportEnvelope,
  importEnvelope,
  runSelfBackup,
  enqueueSelfBackup,
  registerSelfBackupCron,
  SELF_BACKUP_CRON_ID,
  SELF_BACKUP_OWNER,
  SelfBackupRun,
  plaintextGuard,
  type MongoDumpRunner,
  configureRecoveryController,
  resetRecoveryController,
  type ImportEnvelope,
} from './index.js';
import type { SchedulerCron } from '../scheduler/scheduler.boundaries.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant',
    profile: { firstName: 'R', lastName: 'U' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(
  userId: string,
  name = 'p',
  path = '/var/www/p',
  repoPassword = 'super-secret-password-42',
): Promise<ProjectHydrated> {
  return createProject(userId, { name, path, repoPassword });
}

function makeRestic(overrides: Partial<ResticRunner> = {}): ResticRunner & {
  calls: Array<{ args: string[]; hasStdin: boolean }>;
  activeStdinCount: number;
} {
  const calls: Array<{ args: string[]; hasStdin: boolean }> = [];
  const inst = {
    calls,
    activeStdinCount: 0,
    async init() {},
    async backup(args: string[], opts?: ResticBackupOptions) {
      inst.calls.push({ args, hasStdin: Boolean(opts?.stdin) });
      if (opts?.stdin) {
        inst.activeStdinCount += 1;
        try {
          await new Promise<void>((resolve) => {
            opts.stdin!.on('end', () => resolve());
            opts.stdin!.resume();
          });
        } finally {
          inst.activeStdinCount -= 1;
        }
      }
    },
    async snapshots() {
      return [] as Array<{ id: string; time: string }>;
    },
    async check() {},
    async restore() {},
  };
  return Object.assign(inst, overrides);
}

function makeMongoDump(payload = 'archive-bytes'): MongoDumpRunner {
  return {
    async dump() {
      return Readable.from([payload]);
    },
  };
}

describe('recovery: i18n key parity', () => {
  it('all 7 locales expose the same recovery.* keys + placeholders', () => {
    const parity = verifyKeyParity();
    expect(parity).toEqual({ ok: true });
  });
});

describe('recovery: self-backup', () => {
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

  it('runSelfBackup streams mongodump into restic --stdin and persists success', async () => {
    const restic = makeRestic();
    const dump = makeMongoDump();
    const result = await runSelfBackup({ resticRunner: restic, mongoDump: dump });
    expect(result.status).toBe('success');
    expect(restic.calls).toHaveLength(1);
    expect(restic.calls[0]!.args).toEqual([
      'backup',
      '--stdin',
      '--stdin-filename',
      'dockstash-mongo.archive',
    ]);
    expect(restic.calls[0]!.hasStdin).toBe(true);
    const runs = await SelfBackupRun.find({});
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('success');
    expect(runs[0]!.repo).toBe(env.SELF_BACKUP_REPO);
    expect(runs[0]!.finishedAt).toBeTruthy();
  });

  it('enqueueSelfBackup enqueues one job against the reserved repo (not a user project)', async () => {
    const owner = await seedUser('e1@t.com');
    const proj = await seedProject(owner.id);
    const projectId = proj._id.toString();

    const queue = new MemoryQueue();
    const added: Array<{ projectId: string; owner: string }> = [];
    queue.setProcessor(async (job) => {
      added.push({ projectId: job.data.projectId, owner: job.data.owner });
    });

    await enqueueSelfBackup({ queue });
    await queue.waitIdle();

    expect(added).toHaveLength(1);
    expect(added[0]!.projectId).toBe(env.SELF_BACKUP_REPO);
    expect(added[0]!.projectId).not.toBe(projectId);
    expect(added[0]!.owner).toBe(SELF_BACKUP_OWNER);
  });

  it('serializes concurrent enqueues against the reserved repo (per-repo queue)', async () => {
    const queue = new MemoryQueue();
    const restic = makeRestic();
    const dump = makeMongoDump();
    let maxOverlap = 0;
    let active = 0;
    queue.setProcessor(async () => {
      active += 1;
      maxOverlap = Math.max(maxOverlap, active);
      try {
        await runSelfBackup({ resticRunner: restic, mongoDump: dump });
      } finally {
        active -= 1;
      }
    });
    await Promise.all([
      enqueueSelfBackup({ queue }),
      enqueueSelfBackup({ queue }),
      enqueueSelfBackup({ queue }),
    ]);
    await queue.waitIdle();
    expect(maxOverlap).toBe(1);
    expect(restic.calls).toHaveLength(3);
  });

  it('marks the run failed atomically when mongodump throws — no partial success', async () => {
    const restic = makeRestic();
    const dump: MongoDumpRunner = {
      async dump() {
        throw new Error('mongodump exit=1');
      },
    };
    const result = await runSelfBackup({ resticRunner: restic, mongoDump: dump });
    expect(result.status).toBe('failed');
    expect(restic.calls).toHaveLength(0);
    const runs = await SelfBackupRun.find({});
    expect(runs).toHaveLength(1);
    expect(runs[0]!.status).toBe('failed');
    expect(runs[0]!.error).toContain('mongodump exit=1');
  });

  it('marks the run failed when restic --stdin fails mid-stream — no partial success', async () => {
    const dump = makeMongoDump();
    const restic: ResticRunner = {
      async init() {},
      async backup() {
        throw new Error('restic no-space');
      },
      async snapshots() {
        return [];
      },
      async check() {},
      async restore() {},
    };
    const result = await runSelfBackup({ resticRunner: restic, mongoDump: dump });
    expect(result.status).toBe('failed');
    const runs = await SelfBackupRun.find({});
    expect(runs[0]!.status).toBe('failed');
    expect(runs[0]!.error).toContain('restic no-space');
  });

  it('registerSelfBackupCron is idempotent (never stacks a second entry)', () => {
    const registered = new Map<string, string>();
    const cron: SchedulerCron = {
      register(id, expr) {
        registered.set(id, expr);
      },
      unregister(id) {
        registered.delete(id);
      },
      list() {
        return Array.from(registered.keys());
      },
      clear() {
        registered.clear();
      },
    };
    const enqueue = async () => undefined;
    registerSelfBackupCron({ cron, enqueue });
    registerSelfBackupCron({ cron, enqueue });
    expect(cron.list()).toEqual([SELF_BACKUP_CRON_ID]);
  });
});

describe('recovery: export envelope', () => {
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

  it('the plaintext repo password never appears anywhere in the serialized envelope', async () => {
    const owner = await seedUser('e3@t.com');
    const uniquePlaintext = 'THE-SECRET-STRING-nobody-should-see-42';
    await seedProject(owner.id, 'a', '/var/www/a', uniquePlaintext);
    const envelope = await buildExportEnvelope(owner.id);
    const serialized = JSON.stringify(envelope);
    expect(serialized).not.toContain(uniquePlaintext);
    // But the ciphertext + keyVersion MUST be present.
    expect(envelope.projects[0]!.repoPasswordEnc.ciphertext).toBeTruthy();
    expect(typeof envelope.projects[0]!.repoPasswordEnc.keyVersion).toBe('number');
  });

  it('export scopes to the caller — never emits another user\'s projects', async () => {
    const a = await seedUser('e4a@t.com');
    const b = await seedUser('e4b@t.com');
    await seedProject(a.id, 'ap', '/var/www/ap');
    await seedProject(b.id, 'bp', '/var/www/bp');
    const envA = await buildExportEnvelope(a.id);
    expect(envA.projects.map((p) => p.name)).toEqual(['ap']);
    const envB = await buildExportEnvelope(b.id);
    expect(envB.projects.map((p) => p.name)).toEqual(['bp']);
  });

  it('roundtrip: export → import restores project definitions AND ciphertext byte-equal', async () => {
    const owner = await seedUser('e5@t.com');
    const uniquePlaintext = 'roundtrip-password-9001';
    const original = await seedProject(owner.id, 'p', '/var/www/p', uniquePlaintext);
    const envelope = await buildExportEnvelope(owner.id);
    // Wipe the project (simulate a fresh agent on a fresh VPS).
    await Project.deleteMany({});
    const result = await importEnvelope(owner.id, envelope);
    expect(result.imported).toBe(1);
    expect(result.reconciled).toBe(0);
    const restored = await Project.findOne({ owner: owner.id });
    expect(restored).toBeTruthy();
    expect(restored!.name).toBe(original.name);
    expect(restored!.path).toBe(original.path);
    // Ciphertext byte-equal.
    expect(restored!.repoPasswordEnc.ciphertext).toBe(original.repoPasswordEnc.ciphertext);
    expect(restored!.repoPasswordEnc.iv).toBe(original.repoPasswordEnc.iv);
    expect(restored!.repoPasswordEnc.authTag).toBe(original.repoPasswordEnc.authTag);
    expect(restored!.repoPasswordEnc.keyVersion).toBe(original.repoPasswordEnc.keyVersion);
    // And with the correct master key, decrypt yields the original password.
    expect(decryptSecret(restored!.repoPasswordEnc)).toBe(uniquePlaintext);
  });
});

describe('recovery: import validation', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  function baseEnvelope(): ImportEnvelope {
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      keyVersion: 1,
      projects: [
        {
          id: '507f1f77bcf86cd799439011',
          name: 'imp',
          path: '/var/www/imp',
          plan: { paths: ['/var/www/imp'], databases: [], configs: [] },
          repoPasswordEnc: encryptSecret('legitimate-password-42'),
        },
      ],
    };
  }

  it('rejects an envelope with a tampered ciphertext (GCM auth fails)', async () => {
    const owner = await seedUser('i1@t.com');
    const env = baseEnvelope();
    // Flip a byte inside the base64 ciphertext.
    const original = env.projects[0]!.repoPasswordEnc.ciphertext;
    const flipped = original.startsWith('A')
      ? 'B' + original.slice(1)
      : 'A' + original.slice(1);
    env.projects[0]!.repoPasswordEnc.ciphertext = flipped;
    await expect(importEnvelope(owner.id, env)).rejects.toMatchObject({ status: 400 });
  });

  it('rejects an envelope with a plaintext password field (zod .strict())', async () => {
    const owner = await seedUser('i2@t.com');
    const env = baseEnvelope() as unknown as Record<string, unknown>;
    (env as { password?: string }).password = 'oops-in-the-clear';
    await expect(importEnvelope(owner.id, env)).rejects.toMatchObject({ status: 400 });
  });

  it('plaintextGuard detects a plaintext password nested in the envelope', () => {
    const env = { projects: [{ meta: { password: 'raw-string' } }] };
    expect(plaintextGuard(env)).toBe('$.projects[0].meta.password');
  });

  it('plaintextGuard passes on a well-formed encryptedSecret shape', () => {
    const enc = encryptSecret('anything');
    expect(plaintextGuard({ repoPasswordEnc: enc })).toBeNull();
  });

  it('rejects an envelope whose keyVersion cannot be decrypted', async () => {
    const owner = await seedUser('i3@t.com');
    const env = baseEnvelope();
    // Mint an envelope with a known-bad keyVersion.
    env.projects[0]!.repoPasswordEnc.keyVersion = 9999;
    await expect(importEnvelope(owner.id, env)).rejects.toMatchObject({ status: 400 });
  });

  it('refuses to overwrite a project owned by another user (cross-user leak)', async () => {
    const a = await seedUser('i4a@t.com');
    const b = await seedUser('i4b@t.com');
    // A already owns a project id X.
    const proj = await seedProject(a.id, 'ap', '/var/www/ap');
    const env = baseEnvelope();
    env.projects[0]!.id = proj._id.toString();
    // B tries to import a project referencing A's id.
    await expect(importEnvelope(b.id, env)).rejects.toMatchObject({ status: 403 });
  });

  it('is idempotent: re-importing the same envelope reconciles instead of duplicating', async () => {
    const owner = await seedUser('i5@t.com');
    const env = baseEnvelope();
    const r1 = await importEnvelope(owner.id, env);
    expect(r1.imported).toBe(1);
    const r2 = await importEnvelope(owner.id, env);
    expect(r2.reconciled).toBe(1);
    expect(r2.imported).toBe(0);
    const count = await Project.countDocuments({ owner: owner.id });
    expect(count).toBe(1);
  });
});

describe('recovery: HTTP routes', () => {
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

  it('requires auth on every route', async () => {
    const exportRes = await request(app).post('/api/recovery/export');
    expect(exportRes.status).toBe(401);
    const importRes = await request(app).post('/api/recovery/import').send({});
    expect(importRes.status).toBe(401);
    const codesRes = await request(app).post('/api/recovery/recovery-codes');
    expect(codesRes.status).toBe(401);
    const sbRes = await request(app).post('/api/recovery/self-backup');
    expect(sbRes.status).toBe(401);
    const listRes = await request(app).get('/api/recovery/self-backup');
    expect(listRes.status).toBe(401);
  });

  it('POST /recovery-codes enables escrow and returns codes once', async () => {
    const owner = await seedUser('h-codes@t.com');
    const res = await request(app)
      .post('/api/recovery/recovery-codes')
      .set('Authorization', `JWT ${owner.token}`)
      .send();
    expect(res.status).toBe(201);
    expect(res.body.enabled).toBe(true);
    expect(Array.isArray(res.body.codes)).toBe(true);
    expect(res.body.codes.length).toBe(res.body.shareCount);
    expect(res.body.message).toBeTruthy();
  });

  it('POST /export returns a JSON attachment envelope for the caller only', async () => {
    const owner = await seedUser('h1@t.com');
    await seedProject(owner.id, 'x', '/var/www/x');
    const res = await request(app)
      .post('/api/recovery/export')
      .set('Authorization', `JWT ${owner.token}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename=/);
    expect(res.body.version).toBe(1);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('x');
  });

  it('POST /import applies an envelope and returns a localized message', async () => {
    const owner = await seedUser('h2@t.com');
    // build an envelope manually
    const envelope: ImportEnvelope = {
      version: 1,
      exportedAt: new Date().toISOString(),
      keyVersion: 1,
      projects: [
        {
          id: '507f1f77bcf86cd799439099',
          name: 'imported',
          path: '/var/www/imported',
          plan: { paths: ['/var/www/imported'], databases: [], configs: [] },
          repoPasswordEnc: encryptSecret('another-secret-42'),
        },
      ],
    };
    const res = await request(app)
      .post('/api/recovery/import')
      .set('Authorization', `JWT ${owner.token}`)
      .send({ envelope });
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(1);
    // Non-en localization surfaces through req.t.
    const resFr = await request(app)
      .post('/api/recovery/import')
      .set('Authorization', `JWT ${owner.token}`)
      .set('Accept-Language', 'fr')
      .send({ envelope: { ...envelope, version: 42 } });
    expect(resFr.status).toBe(400);
    expect(resFr.body.error.message).toBeTruthy();
  });

  it('POST /self-backup triggers a run via the configured queue', async () => {
    const owner = await seedUser('h3@t.com');
    const queue = new MemoryQueue();
    let seen = 0;
    queue.setProcessor(async (job) => {
      if (job.data.projectId === env.SELF_BACKUP_REPO) seen += 1;
    });
    configureRecoveryController({ queue });
    const res = await request(app)
      .post('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(202);
    await queue.waitIdle();
    expect(seen).toBe(1);
  });

  it('GET /self-backup lists recent runs', async () => {
    const owner = await seedUser('h4@t.com');
    await SelfBackupRun.create({
      repo: env.SELF_BACKUP_REPO,
      status: 'success',
      startedAt: new Date(),
      finishedAt: new Date(),
    });
    const res = await request(app)
      .get('/api/recovery/self-backup')
      .set('Authorization', `JWT ${owner.token}`);
    expect(res.status).toBe(200);
    expect(res.body.runs).toHaveLength(1);
    expect(res.body.runs[0]!.status).toBe('success');
  });
});
