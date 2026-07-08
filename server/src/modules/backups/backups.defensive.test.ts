import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCollections, startMemoryMongo, stopMemoryMongo } from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { Project } from './backups.model.js';
import { createProject, runBackup, scanProjectPath } from './backups.service.js';
import {
  runResticCheck,
  runRestoreDrill,
  runScheduledChecks,
  runScheduledDrills,
} from './backups.verify.service.js';
import type {
  DbDiffer,
  DiskSpaceProbe,
  DockerClient,
  FileDiffer,
  ResticRunner,
  ScratchWorkspace,
} from './backups.boundaries.js';
import type * as BackupsAdapters from './backups.adapters.js';

// Force the best-effort alert sender to throw so the swallow-and-log catch
// blocks in runBackup / stampDrill are exercised (sendFailureAlert never throws
// in practice — its own try/catch swallows everything — so we mock it here).
vi.mock('../alerting/index.js', () => ({
  sendFailureAlert: vi.fn(async () => {
    throw new Error('alert transport exploded');
  }),
}));

// Drive assertArgvSafe by making the matched adapter return a poisoned argv.
// A real adapter can never return a non-string / NUL token, so the guard is
// only reachable through an injected fake adapter.
let mockArgv: unknown = ['pg_dumpall', '-U', 'postgres'];
let mockDumpThrow: unknown = null;
vi.mock('./backups.adapters.js', async (importOriginal) => {
  const actual = await importOriginal<typeof BackupsAdapters>();
  return {
    ...actual,
    matchAdapter: () => ({
      type: 'postgres',
      mode: 'stdin',
      match: () => true,
      dumpCmd: () => {
        if (mockDumpThrow !== null) throw mockDumpThrow;
        return mockArgv;
      },
    }),
  };
});

function makeRestic(overrides: Partial<ResticRunner> = {}): ResticRunner {
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
    async snapshotsDetailed() {
      return [];
    },
    async dump(): Promise<never> {
      throw new Error('dump not stubbed');
    },
    ...overrides,
  };
}

function makeDocker(overrides: Partial<DockerClient> = {}): DockerClient {
  return {
    async exec() {
      return Readable.from(['dump-bytes']);
    },
    async execStream() {
      return {
        stream: Readable.from(['dump-bytes']),
        exit: async () => ({ exitCode: 0, stderrTail: '' }),
      };
    },
    async execCollect() {
      return { exitCode: 0, stdout: 'OK', stderr: '' };
    },
    async execWithStdin() {
      throw new Error('execWithStdin not stubbed');
    },
    async restart() {
      throw new Error('restart not stubbed');
    },
    async inspect(container) {
      return { id: container, running: true, env: [], cmd: [], image: '' };
    },
    async listContainers() {
      return [];
    },
    ...overrides,
  };
}

async function seedUser(email = 'defensive@test.com'): Promise<string> {
  const u = await User.create({
    email,
    password: 'irrelevant-hashed',
    profile: { firstName: 'D', lastName: 'D' },
    emailVerified: true,
  });
  return u._id.toString();
}

async function seedProject(ownerId: string): Promise<string> {
  const p = await createProject(ownerId, {
    name: 'defensivedemo',
    path: '/var/www/defensivedemo',
    repoPassword: 'password1',
  });
  p.plan = {
    paths: ['/var/www/defensivedemo'],
    databases: [{ service: 'pg', type: 'postgres', container: 'pg_1', enabled: true }],
    configs: [] as string[],
  } as unknown as typeof p.plan;
  await p.save();
  return p._id.toString();
}

describe('backups.service: defensive guards', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(async () => {
    await clearCollections();
    mockArgv = ['pg_dumpall', '-U', 'postgres'];
    mockDumpThrow = null;
  });

  it('refuses to back up a paused project', async () => {
    const id = await seedUser();
    const projectId = await seedProject(id);
    await Project.updateOne({ _id: projectId }, { paused: true });
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('fails and logs when the disk probe reports insufficient free space', async () => {
    const id = await seedUser();
    const projectId = await seedProject(id);
    const diskProbe: DiskSpaceProbe = { async freeBytes() { return 1; } };
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
        diskProbe,
        minFreeBytes: 1_000_000,
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
  });

  it('rejects an adapter argv that is not an array', async () => {
    const id = await seedUser();
    const projectId = await seedProject(id);
    mockArgv = 'pg_dumpall -U postgres';
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
  });

  it('rejects an adapter argv containing a non-string token', async () => {
    const id = await seedUser();
    const projectId = await seedProject(id);
    mockArgv = ['pg_dumpall', 123];
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('rejects an adapter argv token containing a NUL byte', async () => {
    const id = await seedUser();
    const projectId = await seedProject(id);
    mockArgv = ['pg_dumpall', '-U', 'ro\0ot'];
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('accepts an explicit plan on create (plan.paths present)', async () => {
    const id = await seedUser('withplan@test.com');
    const project = await createProject(id, {
      name: 'withplan',
      path: '/var/www/withplan',
      repoPassword: 'password1',
      plan: {
        paths: ['/var/www/withplan'],
        databases: [],
        configs: [],
      },
    });
    expect(project.plan.paths).toContain('/var/www/withplan');
  });

  it('rejects a plan config outside the /var/www allowlist on create', async () => {
    const id = await seedUser('badconfig@test.com');
    await expect(
      createProject(id, {
        name: 'badconfig',
        path: '/var/www/badconfig',
        repoPassword: 'password1',
        plan: { paths: ['/var/www/badconfig'], databases: [], configs: ['/etc/passwd'] },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses to run a backup whose persisted plan has an out-of-tree config', async () => {
    const id = await seedUser('smuggled@test.com');
    const projectId = await seedProject(id);
    // Simulate a plan that bypassed the schema (e.g. legacy row / raw write):
    // the runBackup allowlist re-assert must catch it before restic runs.
    await Project.updateOne(
      { _id: projectId },
      { $set: { 'plan.configs': ['/var/lib/dockstash/.env'] } },
    );
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('succeeds with default compose services when none are supplied', async () => {
    const id = await seedUser('nocompose@test.com');
    const projectId = await seedProject(id);
    const res = await runBackup(projectId, id, {
      resticRunner: makeRestic(),
      dockerClient: makeDocker(),
    });
    expect(res.status).toBe('success');
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('success');
  });

  it('uses the inspected container image when present (else falls back to db type)', async () => {
    const id = await seedUser('image@test.com');
    const projectId = await seedProject(id);
    const res = await runBackup(projectId, id, {
      resticRunner: makeRestic(),
      dockerClient: makeDocker({
        async inspect(container) {
          return { id: container, running: true, env: [], cmd: [], image: 'postgres:16' };
        },
      }),
    });
    expect(res.status).toBe('success');
  });

  it('handles a non-Error thrown by the dump command build', async () => {
    const id = await seedUser('strthrow@test.com');
    const projectId = await seedProject(id);
    mockDumpThrow = 'dump build blew up';
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('handles a non-Error thrown by docker exec-stream setup', async () => {
    const id = await seedUser('dockerthrow@test.com');
    const projectId = await seedProject(id);
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic(),
        dockerClient: makeDocker({
          async execStream() {
            throw 'exec blew up';
          },
        }),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('handles a non-Error thrown by the restic stdin backup', async () => {
    const id = await seedUser('resticthrow@test.com');
    const projectId = await seedProject(id);
    await expect(
      runBackup(projectId, id, {
        resticRunner: makeRestic({
          async backup() {
            throw 'restic stdin blew up';
          },
        }),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('handles a non-Error thrown by the restic paths backup (no-db project)', async () => {
    const id = await seedUser('pathsthrow@test.com');
    const project = await createProject(id, {
      name: 'nodb',
      path: '/var/www/nodb',
      repoPassword: 'password1',
    });
    project.plan = {
      paths: ['/var/www/nodb'],
      databases: [],
      configs: [] as string[],
    } as unknown as typeof project.plan;
    await project.save();
    await expect(
      runBackup(project._id.toString(), id, {
        resticRunner: makeRestic({
          async backup() {
            throw 'restic paths blew up';
          },
        }),
        dockerClient: makeDocker(),
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('wraps a non-Error thrown by the compose scanner (scanProjectPath)', async () => {
    await expect(
      scanProjectPath('/var/www/scanfail', {
        scanner: async () => {
          throw 'scan blew up';
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('backups.verify: defensive guards', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  function passingScratch(): ScratchWorkspace {
    return {
      async create() { return '/tmp/scratch-defensive'; },
      async remove() {},
    };
  }
  const cleanFile: FileDiffer = { async diff() { return { mismatches: 0, details: [] }; } };
  const cleanDb: DbDiffer = { async diff() { return { mismatches: 0, details: [] }; } };

  it('a drill that fails still returns fail even when the failure alert throws', async () => {
    const id = await seedUser('drill@test.com');
    const projectId = await seedProject(id);
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: makeRestic(),
      scratch: passingScratch(),
      fileDiff: cleanFile,
      dbDiff: { async diff() { return { mismatches: 5, details: ['torn'] }; } },
    });
    expect(res.status).toBe('fail');
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastDrillStatus).toBe('fail');
  });

  it('runScheduledChecks records an error result when the runner factory throws', async () => {
    const id = await seedUser('sc@test.com');
    await seedProject(id);
    const results = await runScheduledChecks({
      resticRunnerFor: () => {
        throw new Error('cannot build restic runner');
      },
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.detail).toMatch(/cannot build restic runner/);
  });

  it('runScheduledDrills records an error result when a factory throws', async () => {
    const id = await seedUser('sd@test.com');
    await seedProject(id);
    const results = await runScheduledDrills({
      resticRunnerFor: () => {
        throw new Error('cannot build restic runner');
      },
      scratchFor: () => passingScratch(),
      fileDiffFor: () => cleanFile,
      dbDiffFor: () => cleanDb,
    });
    expect(results).toHaveLength(1);
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.detail).toMatch(/cannot build restic runner/);
  });

  it('stringifies a non-Error thrown by restic check', async () => {
    const id = await seedUser('nc@test.com');
    const projectId = await seedProject(id);
    const res = await runResticCheck(projectId, id, {
      resticRunner: makeRestic({
        async check() {
          throw 'check blew up';
        },
      }),
    });
    expect(res.status).toBe('fail');
    expect(res.detail).toMatch(/check blew up/);
  });

  it('stringifies a non-Error thrown by snapshots()', async () => {
    const id = await seedUser('ns@test.com');
    const projectId = await seedProject(id);
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: makeRestic({
        async snapshots() {
          throw 'snapshots blew up';
        },
      }),
      scratch: passingScratch(),
      fileDiff: cleanFile,
      dbDiff: cleanDb,
    });
    expect(res.status).toBe('fail');
    expect(res.detail).toMatch(/snapshots blew up/);
  });

  it('stringifies a non-Error thrown mid-drill (restore)', async () => {
    const id = await seedUser('nr@test.com');
    const projectId = await seedProject(id);
    const res = await runRestoreDrill(projectId, id, {
      resticRunner: makeRestic({
        async restore() {
          throw 'restore blew up';
        },
      }),
      scratch: passingScratch(),
      fileDiff: cleanFile,
      dbDiff: cleanDb,
    });
    expect(res.status).toBe('fail');
    expect(res.detail).toMatch(/restore blew up/);
  });

  it('runScheduledChecks stringifies a non-Error factory throw', async () => {
    const id = await seedUser('scs@test.com');
    await seedProject(id);
    const results = await runScheduledChecks({
      resticRunnerFor: () => {
        throw 'factory string blew up';
      },
    });
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.detail).toMatch(/factory string blew up/);
  });

  it('runScheduledDrills stringifies a non-Error factory throw', async () => {
    const id = await seedUser('sds@test.com');
    await seedProject(id);
    const results = await runScheduledDrills({
      resticRunnerFor: () => {
        throw 'factory string blew up';
      },
      scratchFor: () => passingScratch(),
      fileDiffFor: () => cleanFile,
      dbDiffFor: () => cleanDb,
    });
    expect(results[0]?.status).toBe('error');
    expect(results[0]?.detail).toMatch(/factory string blew up/);
  });
});

describe('runRestore: alert transport explosion is swallowed', () => {
  beforeAll(() => startMemoryMongo());
  afterAll(() => stopMemoryMongo());
  beforeEach(() => clearCollections());

  it('still rejects with the restore failure, not the alert failure', async () => {
    const { runRestore } = await import('./backups.restore.service.js');
    const id = await seedUser('restore-defensive@test.com');
    const projectId = await seedProject(id);
    await expect(
      runRestore(
        projectId,
        id,
        { snapshotId: 'deadbeef', overwrite: true },
        {
          resticRunner: {
            ...makeRestic(),
            // Overwrite resolves the snapshot record first; give it a path
            // snapshot inside the allowlist so it reaches the restic call.
            snapshotsDetailed: async () => [
              { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/var/www/app'] },
            ],
            restore: async () => {
              throw new Error('restic restore blew up');
            },
          },
        },
      ),
    ).rejects.toMatchObject({ status: 500 });
    const row = await Project.findById(projectId);
    expect(row?.lastRestoreStatus).toBe('fail');
    expect(row?.lastRestoreDetail).toContain('restic restore blew up');
  });
});
