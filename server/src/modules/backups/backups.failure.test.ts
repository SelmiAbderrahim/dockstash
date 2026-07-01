import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from './backups.model.js';
import { createProject, runBackup } from './backups.service.js';
import { runRestoreDrill } from './backups.verify.service.js';
import type {
  DbDiffer,
  DockerClient,
  FileDiffer,
  ResticRunner,
  ScratchWorkspace,
} from './backups.boundaries.js';

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email = 'fail@test.com'): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant-hashed',
    profile: { firstName: 'F', lastName: 'F' },
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedProject(ownerId: string): Promise<string> {
  const p = await createProject(ownerId, {
    name: 'faildemo',
    path: '/var/www/faildemo',
    repoPassword: 'password1',
  });
  p.plan = {
    paths: ['/var/www/faildemo'],
    databases: [{ service: 'pg', type: 'postgres', container: 'pg_1', enabled: true }],
    configs: [] as string[],
  } as unknown as typeof p.plan;
  await p.save();
  return p._id.toString();
}

function makeBaseRestic(overrides: Partial<ResticRunner> = {}): ResticRunner {
  return {
    async init() {},
    async backup(_args, opts) {
      if (opts?.stdin) opts.stdin.resume();
    },
    async snapshots() {
      return [{ id: 'abc', time: '2026-07-01T00:00:00Z' }];
    },
    async check() {},
    async restore() {},
    ...overrides,
  };
}

function makeBaseDocker(overrides: Partial<DockerClient> = {}): DockerClient {
  return {
    async exec() {
      return Readable.from(['dump-bytes']);
    },
    async inspect(container) {
      return { id: container, running: true };
    },
    ...overrides,
  };
}

describe('backups: failure injection (runBackup)', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('kill mid-backup — docker stream errors partway → failed, restic paths never called', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    let backupCalls = 0;
    const docker = makeBaseDocker({
      async exec() {
        const stream = new Readable({
          read() {
            /* pushed manually */
          },
        });
        // emit some data then error
        setImmediate(() => {
          stream.push('partial');
          stream.emit('error', new Error('stream killed mid-backup'));
        });
        return stream;
      },
    });
    const restic = makeBaseRestic({
      async backup(_args, opts) {
        backupCalls += 1;
        if (opts?.stdin) {
          await new Promise<void>((resolve, reject) => {
            opts.stdin!.on('data', () => {});
            opts.stdin!.on('error', reject);
            opts.stdin!.on('end', resolve);
            opts.stdin!.resume();
          });
        }
      },
    });
    await expect(
      runBackup(projectId, id, {
        resticRunner: restic,
        dockerClient: docker,
        composeServices: { pg: { image: 'postgres:16' } },
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(persisted?.lastStatus).not.toBe('success');
    // only the dump-restic call was attempted; paths phase never reached.
    expect(backupCalls).toBe(1);
  });

  it('fill disk — restic backup rejects ENOSPC → failed, error surfaced', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeBaseRestic({
      async backup() {
        const err = new Error('ENOSPC: no space left on device') as Error & { code?: string };
        err.code = 'ENOSPC';
        throw err;
      },
    });
    await expect(
      runBackup(projectId, id, {
        resticRunner: restic,
        dockerClient: makeBaseDocker(),
        composeServices: { pg: { image: 'postgres:16' } },
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(persisted?.lastError).toMatch(/ENOSPC|no space/);
  });

  it('drop network — restic connection error → failed', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeBaseRestic({
      async backup() {
        throw new Error('ECONNREFUSED 10.0.0.1:22');
      },
    });
    await expect(
      runBackup(projectId, id, {
        resticRunner: restic,
        dockerClient: makeBaseDocker(),
        composeServices: { pg: { image: 'postgres:16' } },
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(persisted?.lastError).toMatch(/ECONNREFUSED/);
  });

  it('stale lock — restic reports locked repo → failed, NEVER a false success', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeBaseRestic({
      async backup() {
        throw new Error('unable to create lock: repository is already locked by PID 42');
      },
    });
    await expect(
      runBackup(projectId, id, {
        resticRunner: restic,
        dockerClient: makeBaseDocker(),
        composeServices: { pg: { image: 'postgres:16' } },
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(persisted?.lastStatus).not.toBe('success');
    expect(persisted?.lastError).toMatch(/lock/i);
  });
});

describe('backups: failure injection (runRestoreDrill)', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  function passingScratch(): ScratchWorkspace & { removeCalls: string[] } {
    const removeCalls: string[] = [];
    return {
      removeCalls,
      async create() {
        return '/tmp/scratch-drill';
      },
      async remove(p) {
        removeCalls.push(p);
      },
    };
  }

  it('torn dump — DB row-diff mismatches → drill fails, never reports pass', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeBaseRestic();
    const scratch = passingScratch();
    const fileDiff: FileDiffer = {
      async diff() {
        return { mismatches: 0, details: [] };
      },
    };
    const dbDiff: DbDiffer = {
      async diff() {
        return { mismatches: 12, details: ['pg: 12 rows missing'] };
      },
    };
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff,
      dbDiff,
    });
    expect(res.status).toBe('fail');
    expect(res.status).not.toBe('pass');
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastDrillStatus).toBe('fail');
    expect(persisted?.lastDrillDetail).toMatch(/12|mismatch/);
    // scratch cleaned even on the success path (through finally).
    expect(scratch.removeCalls).toEqual(['/tmp/scratch-drill']);
  });

  it('mid-drill docker exec failure → drill fails, scratch cleaned', async () => {
    const { id } = await seedUser();
    const projectId = await seedProject(id);
    const restic = makeBaseRestic({
      async restore() {
        // simulate the restic restore succeeding but a downstream diff failing.
      },
    });
    const scratch = passingScratch();
    const fileDiff: FileDiffer = {
      async diff() {
        throw new Error('docker exec died mid-drill');
      },
    };
    const dbDiff: DbDiffer = {
      async diff() {
        return { mismatches: 0, details: [] };
      },
    };
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: restic,
      scratch,
      fileDiff,
      dbDiff,
    });
    expect(res.status).toBe('fail');
    expect(scratch.removeCalls).toEqual(['/tmp/scratch-drill']);
  });
});
