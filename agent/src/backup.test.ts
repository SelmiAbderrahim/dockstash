import { PassThrough, type Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  assertArgvSafe,
  collectStats,
  drainStream,
  runBackupJob,
  type BackupDeps,
} from './backup.js';
import type { DockerClient } from './docker-client.js';
import type { ResticRunnerExt, ResticSnapshotDetail, ResticStats } from './restic-runner.js';
import type { ClaimedJob } from './types.js';

type ResticCall =
  | { op: 'init' }
  | { op: 'backup'; args: string[]; stdin?: Readable }
  | { op: 'check'; args: string[] }
  | { op: 'restore'; args: string[] }
  | { op: 'unlock' }
  | { op: 'forget'; args: string[] };

interface FakeResticOptions {
  onBackup?(args: string[], options?: { stdin?: Readable }): Promise<void> | void;
  stats?: ResticStats;
  snapshots?: ResticSnapshotDetail[];
}

function makeFakeRestic(opts: FakeResticOptions = {}): {
  restic: ResticRunnerExt;
  calls: ResticCall[];
} {
  const calls: ResticCall[] = [];
  const restic: ResticRunnerExt = {
    async init() {
      calls.push({ op: 'init' });
    },
    async backup(args, options) {
      calls.push({ op: 'backup', args, stdin: options?.stdin });
      if (opts.onBackup) await opts.onBackup(args, options);
    },
    async snapshots() {
      return (opts.snapshots ?? []).map((s) => ({ id: s.id, time: s.time }));
    },
    async snapshotsDetailed() {
      return opts.snapshots ?? [];
    },
    async stats() {
      return opts.stats ?? {};
    },
    async check(args) {
      calls.push({ op: 'check', args });
    },
    async restore(args) {
      calls.push({ op: 'restore', args });
    },
    async unlock() {
      calls.push({ op: 'unlock' });
    },
    async forget(args) {
      calls.push({ op: 'forget', args });
    },
  };
  return { restic, calls };
}

interface FakeDockerOptions {
  exec?(container: string, argv: string[]): Promise<Readable>;
}

function makeFakeDocker(opts: FakeDockerOptions = {}): {
  docker: DockerClient;
  calls: Array<{ container: string; argv: string[] }>;
} {
  const calls: Array<{ container: string; argv: string[] }> = [];
  const docker: DockerClient = {
    async exec(container, argv) {
      calls.push({ container, argv });
      if (opts.exec) return opts.exec(container, argv);
      const stream = new PassThrough();
      stream.end('dump-output');
      return stream;
    },
    async inspect(container) {
      return { id: container, running: true };
    },
    async listContainers() {
      return [];
    },
  };
  return { docker, calls };
}

function baseJob(overrides: Partial<ClaimedJob> = {}): ClaimedJob {
  return {
    id: 'job-1',
    kind: 'backup',
    projectId: 'proj-1',
    leaseSeconds: 60,
    attempt: 1,
    maxAttempts: 3,
    plan: { paths: [], configs: [], databases: [] },
    retention: null,
    restore: null,
    repo: { url: 'sftp:backup@host:/repo', password: 'pw' },
    ssh: { privateKey: 'key', hostKeyLine: 'host ssh-ed25519 AAAA' },
    ...overrides,
  };
}

function makeDeps(restic: ResticRunnerExt, docker: DockerClient): BackupDeps {
  return { restic, docker, roots: ['/var/www'], log: vi.fn() };
}

describe('assertArgvSafe', () => {
  it('accepts clean argv tokens', () => {
    expect(() => assertArgvSafe(['pg_dumpall', '-U', 'postgres'])).not.toThrow();
  });

  it('throws when a token contains a NUL byte', () => {
    expect(() => assertArgvSafe(['ok', 'bad\0token'])).toThrow(/NUL byte/);
  });
});

describe('drainStream', () => {
  it('resolves once the stream ends', async () => {
    const stream = new PassThrough();
    const done = drainStream(stream);
    stream.end('ignored payload');
    await expect(done).resolves.toBeUndefined();
  });

  it('rejects when the stream errors', async () => {
    const stream = new PassThrough();
    const done = drainStream(stream);
    stream.emit('error', new Error('stream broke'));
    await expect(done).rejects.toThrow('stream broke');
  });
});

describe('collectStats', () => {
  it('includes totalRepoBytes when present and omits it when absent', async () => {
    const { restic: withSize } = makeFakeRestic({ stats: { total_size: 555 } });
    await expect(collectStats(withSize)).resolves.toMatchObject({ totalRepoBytes: 555 });

    const { restic: withoutSize } = makeFakeRestic({ stats: {} });
    const stats = await collectStats(withoutSize);
    expect(stats.totalRepoBytes).toBeUndefined();
  });

  it('reports snapshotCount 0 and no lastBackupBytes when there are no snapshots', async () => {
    const { restic } = makeFakeRestic({ snapshots: [] });
    await expect(collectStats(restic)).resolves.toEqual({ snapshotCount: 0 });
  });

  it('reports lastBackupBytes from the final snapshot summary when present', async () => {
    const { restic } = makeFakeRestic({
      snapshots: [
        { id: 'a', short_id: 'a', time: 't1' },
        { id: 'b', short_id: 'b', time: 't2', summary: { total_bytes_processed: 777 } },
      ],
    });
    await expect(collectStats(restic)).resolves.toEqual({
      snapshotCount: 2,
      lastBackupBytes: 777,
    });
  });

  it('omits lastBackupBytes when the last snapshot has no summary', async () => {
    const { restic } = makeFakeRestic({
      snapshots: [{ id: 'a', short_id: 'a', time: 't1' }],
    });
    const stats = await collectStats(restic);
    expect(stats.snapshotCount).toBe(1);
    expect(stats.lastBackupBytes).toBeUndefined();
  });
});

describe('runBackupJob', () => {
  it('runs a stdin-mode adapter layer (postgres) piping the exec stream into restic', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [
          { service: 'db', type: 'postgres', container: 'c1', enabled: true },
        ],
      },
    });
    const stats = await runBackupJob(job, makeDeps(restic, docker));
    expect(dockerCalls[0]).toEqual({ container: 'c1', argv: ['pg_dumpall', '-U', 'postgres'] });
    const backupCall = resticCalls.find((c) => c.op === 'backup');
    expect(backupCall).toMatchObject({
      op: 'backup',
      args: ['backup', '--stdin', '--stdin-filename', 'db.dump'],
    });
    expect(backupCall && 'stdin' in backupCall && backupCall.stdin).toBeDefined();
    expect(stats).toEqual({ snapshotCount: 0 });
  });

  it('runs a file-mode adapter layer (redis) draining the stream then backing up the artifact path', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [
          { service: 'cache', type: 'redis', container: 'c-redis', enabled: true },
        ],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(dockerCalls[0]).toEqual({ container: 'c-redis', argv: ['redis-cli', 'SAVE'] });
    const backupCall = resticCalls.find((c) => c.op === 'backup');
    expect(backupCall).toMatchObject({ op: 'backup', args: ['backup', '/data/dump.rdb'] });
  });

  it('skips disabled database layers', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [
          { service: 'db', type: 'postgres', container: 'c1', enabled: false },
        ],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(dockerCalls).toHaveLength(0);
    expect(resticCalls.filter((c) => c.op === 'backup')).toHaveLength(0);
  });

  it('throws when no adapter matches the database type', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [
          { service: 'weird', type: 'unknown-engine', container: 'c1', enabled: true },
        ],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /no adapter matched service weird/,
    );
  });

  it('wraps docker exec failures as "dump failed for <service>"', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      exec: async () => {
        throw new Error('container not running');
      },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for db: container not running/,
    );
  });

  it('normalizes a non-Error docker exec rejection into a string message', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      exec: () => Promise.reject('container gone'),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for db: container gone/,
    );
  });

  it('wraps restic backup failures during a layer dump as "restic dump failed"', async () => {
    const { restic } = makeFakeRestic({
      onBackup: () => {
        throw new Error('repo locked');
      },
    });
    const { docker } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /restic dump failed: repo locked/,
    );
  });

  it('normalizes a non-Error restic backup rejection during a layer dump into a string message', async () => {
    const { restic } = makeFakeRestic({
      onBackup: () => Promise.reject('raw dump failure'),
    });
    const { docker } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /restic dump failed: raw dump failure/,
    );
  });

  it('backs up plan paths and configs together', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: ['/var/www/app'],
        configs: ['/var/www/app/docker-compose.yml'],
        databases: [],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    const backupCall = resticCalls.find((c) => c.op === 'backup');
    expect(backupCall).toMatchObject({
      op: 'backup',
      args: ['backup', '/var/www/app', '/var/www/app/docker-compose.yml'],
    });
  });

  it('wraps restic path-backup failures as "restic paths failed"', async () => {
    const { restic } = makeFakeRestic({
      onBackup: (args) => {
        if (args[0] === 'backup' && args.includes('/var/www/app')) {
          throw new Error('disk full');
        }
      },
    });
    const { docker } = makeFakeDocker();
    const job = baseJob({
      plan: { paths: ['/var/www/app'], configs: [], databases: [] },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /restic paths failed: disk full/,
    );
  });

  it('normalizes a non-Error restic path-backup rejection into a string message', async () => {
    const { restic } = makeFakeRestic({
      onBackup: (args) => {
        if (args[0] === 'backup' && args.includes('/var/www/app')) {
          return Promise.reject('raw paths failure');
        }
      },
    });
    const { docker } = makeFakeDocker();
    const job = baseJob({
      plan: { paths: ['/var/www/app'], configs: [], databases: [] },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /restic paths failed: raw paths failure/,
    );
  });

  it('skips the paths backup call entirely when there are no paths or configs', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker } = makeFakeDocker();
    const job = baseJob({ plan: { paths: [], configs: [], databases: [] } });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(resticCalls.filter((c) => c.op === 'backup')).toHaveLength(0);
  });

  it('rejects a plan path outside the /var/www allowlist before touching restic or docker', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({ plan: { paths: ['/etc/passwd'], configs: [], databases: [] } });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /path not allowed: \/etc\/passwd/,
    );
    expect(resticCalls).toHaveLength(0);
    expect(dockerCalls).toHaveLength(0);
  });

  it('rejects a plan CONFIG outside the /var/www allowlist before touching restic or docker', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({
      plan: { paths: ['/var/www/app'], configs: ['/root/.ssh/id_rsa'], databases: [] },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /path not allowed: \/root\/\.ssh\/id_rsa/,
    );
    expect(resticCalls).toHaveLength(0);
    expect(dockerCalls).toHaveLength(0);
  });
});
