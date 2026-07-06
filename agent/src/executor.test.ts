import { PassThrough, type Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { executeJob, pruneArgs, type ExecutorDeps } from './executor.js';
import type { DockerClient } from './docker-client.js';
import type { ResticRunnerExt, ResticSnapshotDetail, ResticStats } from './restic-runner.js';
import type { ClaimedJob } from './types.js';

interface FakeResticOptions {
  check?(args: string[]): Promise<void>;
  restore?(args: string[]): Promise<void>;
  forget?(args: string[]): Promise<void>;
  unlock?(): Promise<void>;
  stats?: ResticStats;
  snapshotsDetailed?: ResticSnapshotDetail[];
}

function makeFakeRestic(opts: FakeResticOptions = {}): {
  restic: ResticRunnerExt;
  calls: { check: string[][]; restore: string[][]; forget: string[][]; unlock: number };
} {
  const calls = { check: [] as string[][], restore: [] as string[][], forget: [] as string[][], unlock: 0 };
  const restic: ResticRunnerExt = {
    async init() {},
    async backup() {},
    async snapshots() {
      return [];
    },
    async snapshotsDetailed() {
      return opts.snapshotsDetailed ?? [];
    },
    async stats() {
      return opts.stats ?? {};
    },
    async check(args) {
      calls.check.push(args);
      if (opts.check) await opts.check(args);
    },
    async restore(args) {
      calls.restore.push(args);
      if (opts.restore) await opts.restore(args);
    },
    async unlock() {
      calls.unlock += 1;
      if (opts.unlock) await opts.unlock();
    },
    async forget(args) {
      calls.forget.push(args);
      if (opts.forget) await opts.forget(args);
    },
    async dump() {
      throw new Error('dump not stubbed');
    },
  };
  return { restic, calls };
}

function makeFakeDocker(): DockerClient {
  return {
    async exec(): Promise<Readable> {
      const stream = new PassThrough();
      stream.end();
      return stream;
    },
    async execCollect() {
      throw new Error('execCollect not stubbed');
    },
    async execWithStdin() {
      throw new Error('execWithStdin not stubbed');
    },
    async restart() {
      throw new Error('restart not stubbed');
    },
    async inspect(container) {
      return { id: container, running: true, env: [], image: '' };
    },
    async listContainers() {
      return [];
    },
  };
}

function baseJob(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: 'job-1',
    kind: 'check',
    projectId: 'proj-1',
    leaseSeconds: 60,
    attempt: 1,
    maxAttempts: 1,
    plan: { paths: [], configs: [], databases: [] },
    retention: null,
    restore: null,
    repo: { url: 'sftp:backup@host:/repo', password: 'pw' },
    ssh: { privateKey: 'key', hostKeyLine: 'host ssh-ed25519 AAAA' },
    ...overrides,
  };
}

describe('pruneArgs', () => {
  it('builds forget --prune argv from a retention policy', () => {
    expect(pruneArgs({ keepDaily: 7, keepWeekly: 4, keepMonthly: 6 })).toEqual([
      'forget',
      '--prune',
      '--keep-daily',
      '7',
      '--keep-weekly',
      '4',
      '--keep-monthly',
      '6',
    ]);
  });
});

describe('executeJob: kind dispatch (single attempt, success)', () => {
  it('backup: runs the backup layer and returns stats', async () => {
    const { restic } = makeFakeRestic({ stats: { total_size: 100 } });
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'backup',
      plan: { paths: ['/var/www/app'], configs: [], databases: [] },
    });
    const deps: ExecutorDeps = { restic, docker, roots: ['/var/www'], log: vi.fn(), sleep: vi.fn() };
    const result = await executeJob(job, deps);
    expect(result.ok).toBe(true);
    expect(result.stats).toMatchObject({ totalRepoBytes: 100 });
  });

  it('check: calls restic.check', async () => {
    const { restic, calls } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({ kind: 'check' });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: true });
    expect(calls.check).toEqual([['check']]);
  });

  it('prune: calls restic.forget with prune args built from retention', async () => {
    const { restic, calls } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'prune',
      retention: { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 },
    });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: true });
    expect(calls.forget).toEqual([pruneArgs({ keepDaily: 7, keepWeekly: 4, keepMonthly: 6 })]);
  });

  it('prune: missing retention policy fails the job', async () => {
    const { restic } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({ kind: 'prune', retention: null, maxAttempts: 1 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'prune job missing retention policy' });
  });

  it('restore: overwrite of a path snapshot targets "/" with the full id', async () => {
    const { restic, calls } = makeFakeRestic({
      snapshotsDetailed: [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/var/www/app'] },
      ],
    });
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'restore',
      restore: { snapshotId: 'deadbeef', overwrite: true, targetPath: null },
    });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: true });
    expect(calls.restore).toEqual([['restore', 'deadbeefcafe', '--target', '/']]);
  });

  it('restore: non-overwrite targets the allowed project path', async () => {
    const { restic, calls } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'restore',
      restore: { snapshotId: 'deadbeef', overwrite: false, targetPath: '/var/www/app' },
    });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: true });
    expect(calls.restore).toEqual([['restore', 'deadbeef', '--target', '/var/www/app']]);
  });

  it('restore: missing restore payload fails the job', async () => {
    const { restic } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({ kind: 'restore', restore: null, maxAttempts: 1 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'restore job missing payload' });
  });

  it('restore: a malformed snapshotId is rejected without touching restic', async () => {
    const { restic, calls } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'restore',
      maxAttempts: 1,
      restore: { snapshotId: '--insecure-no-password', overwrite: true, targetPath: null },
    });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'invalid snapshot id: --insecure-no-password' });
    expect(calls.restore).toEqual([]);
  });

  it('restore: falsy targetPath (non-overwrite) is rejected without touching isAllowedProjectPath', async () => {
    const { restic } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'restore',
      maxAttempts: 1,
      restore: { snapshotId: 'deadbeef', overwrite: false, targetPath: null },
    });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'restore target not allowed: ' });
  });

  it('restore: disallowed targetPath (non-overwrite) is rejected', async () => {
    const { restic } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({
      kind: 'restore',
      maxAttempts: 1,
      restore: { snapshotId: 'deadbeef', overwrite: false, targetPath: '/etc/passwd' },
    });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'restore target not allowed: /etc/passwd' });
  });
});

describe('executeJob: retry loop', () => {
  it('retries after a failure, calling restic.unlock between attempts, then succeeds', async () => {
    let attempts = 0;
    const { restic, calls } = makeFakeRestic({
      check: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient lock');
      },
    });
    const docker = makeFakeDocker();
    const sleep = vi.fn(async () => {});
    const job = baseJob({ kind: 'check', maxAttempts: 2 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn(), sleep });
    expect(result).toEqual({ ok: true });
    expect(calls.check).toHaveLength(2);
    expect(calls.unlock).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(200);
  });

  it('swallows an unlock rejection between attempts and still retries', async () => {
    let attempts = 0;
    const { restic, calls } = makeFakeRestic({
      check: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('transient lock');
      },
      unlock: async () => {
        throw new Error('unlock also failed');
      },
    });
    const docker = makeFakeDocker();
    const sleep = vi.fn(async () => {});
    const job = baseJob({ kind: 'check', maxAttempts: 2 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn(), sleep });
    expect(result).toEqual({ ok: true });
    expect(calls.unlock).toBe(1);
  });

  it('returns ok:false with the last error after exhausting all attempts', async () => {
    const { restic } = makeFakeRestic({
      check: async () => {
        throw new Error('always fails');
      },
    });
    const docker = makeFakeDocker();
    const sleep = vi.fn(async () => {});
    const job = baseJob({ kind: 'check', maxAttempts: 3 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn(), sleep });
    expect(result).toEqual({ ok: false, error: 'always fails' });
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenNthCalledWith(1, 200);
    expect(sleep).toHaveBeenNthCalledWith(2, 400);
  });

  it('normalizes a non-Error throw into an Error message', async () => {
    const { restic } = makeFakeRestic({
      check: async () => {
        throw 'raw string failure';
      },
    });
    const docker = makeFakeDocker();
    const job = baseJob({ kind: 'check', maxAttempts: 1 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'raw string failure' });
  });

  it('falls back to "job failed" when maxAttempts is 0 (retry loop never executes)', async () => {
    const { restic } = makeFakeRestic();
    const docker = makeFakeDocker();
    const job = baseJob({ kind: 'check', maxAttempts: 0 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn() });
    expect(result).toEqual({ ok: false, error: 'job failed' });
  });

  it('uses the real defaultSleep when no sleep is injected', async () => {
    let attempts = 0;
    const { restic } = makeFakeRestic({
      check: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error('once');
      },
    });
    const docker = makeFakeDocker();
    const job = baseJob({ kind: 'check', maxAttempts: 2 });
    const result = await executeJob(job, { restic, docker, roots: ['/var/www'], log: vi.fn(), baseBackoffMs: 1 });
    expect(result).toEqual({ ok: true });
    expect(attempts).toBe(2);
  });
});
