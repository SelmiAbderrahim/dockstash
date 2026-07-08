import { PassThrough, type Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import {
  assertArgvSafe,
  collectStats,
  isPartialReadFailure,
  runBackupJob,
  type BackupDeps,
} from './backup.js';
import type { DockerClient, DockerInspectResult } from './docker-client.js';
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
    async dump() {
      throw new Error('dump not stubbed');
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

interface StreamOutcome {
  stdout?: string;
  exitCode?: number;
  stderrTail?: string;
  streamError?: Error;
}
interface CollectOutcome {
  exitCode?: number;
  stdout?: string;
  stderr?: string;
}

interface FakeDockerOptions {
  /** Override the inspect result (merged over sensible running defaults). */
  inspect?(container: string): Partial<DockerInspectResult>;
  /** Control an execStream: return the dump's stdout + exit, or throw to fail setup. */
  onExecStream?(container: string, argv: string[]): StreamOutcome;
  /** Control an execCollect: return the dump's exit + channels, or throw to fail setup. */
  onExecCollect?(container: string, argv: string[]): CollectOutcome;
}

interface FakeDocker {
  docker: DockerClient;
  /** Every execStream/execCollect as {container, argv} in call order (inspect excluded). */
  calls: Array<{ container: string; argv: string[] }>;
  /** execStream invocations with the env passed — for asserting secrets ride env, not argv. */
  streams: Array<{ container: string; argv: string[]; env?: string[] }>;
  /** execCollect invocations with the env passed. */
  collects: Array<{ container: string; argv: string[]; env?: string[] }>;
  inspects: string[];
}

function makeFakeDocker(opts: FakeDockerOptions = {}): FakeDocker {
  const calls: FakeDocker['calls'] = [];
  const streams: FakeDocker['streams'] = [];
  const collects: FakeDocker['collects'] = [];
  const inspects: string[] = [];
  const docker: DockerClient = {
    async exec() {
      throw new Error('exec not used by runBackupJob');
    },
    async execStream(container, argv, execOpts) {
      calls.push({ container, argv });
      streams.push({ container, argv, env: execOpts?.env });
      const r = opts.onExecStream ? opts.onExecStream(container, argv) : {};
      const stream = new PassThrough();
      if (r.streamError) {
        const err = r.streamError;
        queueMicrotask(() => stream.destroy(err));
      } else {
        stream.end(r.stdout ?? 'dump-output');
      }
      return {
        stream,
        exit: async () => ({ exitCode: r.exitCode ?? 0, stderrTail: r.stderrTail ?? '' }),
      };
    },
    async execCollect(container, argv, env) {
      calls.push({ container, argv });
      collects.push({ container, argv, env });
      const r = opts.onExecCollect ? opts.onExecCollect(container, argv) : {};
      // Default stdout 'OK' so redis/valkey verifyDump passes on the happy path.
      return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? 'OK', stderr: r.stderr ?? '' };
    },
    async execWithStdin() {
      throw new Error('execWithStdin not stubbed');
    },
    async restart() {
      throw new Error('restart not stubbed');
    },
    async inspect(container) {
      inspects.push(container);
      return {
        id: container,
        running: true,
        env: [],
        cmd: [],
        image: '',
        ...(opts.inspect ? opts.inspect(container) : {}),
      };
    },
    async listContainers() {
      return [];
    },
  };
  return { docker, calls, streams, collects, inspects };
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

describe('isPartialReadFailure', () => {
  it('matches only the restic backup exit-3 error shape', () => {
    expect(isPartialReadFailure('restic backup exit 3: error: open x: permission denied')).toBe(true);
    expect(isPartialReadFailure('restic backup exit 1: Fatal: repo locked')).toBe(false);
    expect(isPartialReadFailure('restic restore exit 3: whatever')).toBe(false);
    expect(isPartialReadFailure('wrapped: restic backup exit 3: not anchored')).toBe(false);
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
    expect(dockerCalls[0]).toEqual({ container: 'c1', argv: ['pg_dumpall', '--clean', '--if-exists', '-U', 'postgres'] });
    const backupCall = resticCalls.find((c) => c.op === 'backup');
    expect(backupCall).toMatchObject({
      op: 'backup',
      args: ['backup', '--stdin', '--stdin-filename', 'db.dump', '--tag', 'db:db:postgres'],
    });
    expect(backupCall && 'stdin' in backupCall && backupCall.stdin).toBeDefined();
    expect(stats).toEqual({ snapshotCount: 0 });
  });

  it('file-mode (redis): dumps, then streams the artifact OUT via cat into restic --stdin', async () => {
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
    // Two execs: the SAVE dump, then cat of the produced artifact.
    expect(dockerCalls).toEqual([
      { container: 'c-redis', argv: ['redis-cli', 'SAVE'] },
      { container: 'c-redis', argv: ['cat', '/data/dump.rdb'] },
    ]);
    const backupCall = resticCalls.find((c) => c.op === 'backup');
    expect(backupCall).toMatchObject({
      op: 'backup',
      args: [
        'backup',
        '--stdin',
        '--stdin-filename',
        'cache-dump.rdb',
        '--tag',
        'db:cache:redis',
      ],
    });
    expect(backupCall && 'stdin' in backupCall && backupCall.stdin).toBeDefined();
    // Regression: restic must NEVER receive the bare in-container artifact path
    // — that path only exists inside the container, so `restic backup <path>`
    // fails "<path> does not exist" (the original prod bug).
    expect(
      resticCalls.some((c) => c.op === 'backup' && c.args.includes('/data/dump.rdb')),
    ).toBe(false);
  });

  it('file-mode (directory adapter): streams a tar of the artifact dir into restic --stdin', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [
          { service: 'objects', type: 'minio', container: 'c-minio', enabled: true },
        ],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    // minio is a directory artifact → tar it out of the container.
    expect(dockerCalls[1]).toEqual({
      container: 'c-minio',
      argv: ['tar', '-cf', '-', '-C', '/backup/minio', '.'],
    });
    const backupCall = resticCalls.find((c) => c.op === 'backup');
    expect(backupCall).toMatchObject({
      op: 'backup',
      args: [
        'backup',
        '--stdin',
        '--stdin-filename',
        'objects.tar',
        '--tag',
        'db:objects:minio',
      ],
    });
  });

  it('runs a mixed plan: a stdin layer (postgres) and a file layer (redis)', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker();
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [
          { service: 'db', type: 'postgres', container: 'c-pg', enabled: true },
          { service: 'cache', type: 'redis', container: 'c-redis', enabled: true },
        ],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(dockerCalls).toEqual([
      { container: 'c-pg', argv: ['pg_dumpall', '--clean', '--if-exists', '-U', 'postgres'] },
      { container: 'c-redis', argv: ['redis-cli', 'SAVE'] },
      { container: 'c-redis', argv: ['cat', '/data/dump.rdb'] },
    ]);
    const filenames = resticCalls
      .filter((c) => c.op === 'backup')
      .map((c) => (c.op === 'backup' ? c.args[c.args.indexOf('--stdin-filename') + 1] : ''));
    expect(filenames).toEqual(['db.dump', 'cache-dump.rdb']);
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

  it('wraps docker exec-stream setup failures as "dump failed for <service>"', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      onExecStream: () => {
        throw new Error('exec create failed');
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
      /dump failed for db: exec create failed/,
    );
  });

  it('normalizes a non-Error docker exec rejection into a string message', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      onExecStream: () => {
        throw 'container gone';
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

  it('exit 3 (partial read) on the paths backup: warns and succeeds — the snapshot exists', async () => {
    const { restic } = makeFakeRestic({
      onBackup: (args) => {
        if (args[0] === 'backup' && args.includes('/var/www/app')) {
          throw new Error('restic backup exit 3: error: open /var/www/app/.env: permission denied');
        }
      },
    });
    const { docker } = makeFakeDocker();
    const deps = makeDeps(restic, docker);
    const job = baseJob({
      plan: { paths: ['/var/www/app'], configs: [], databases: [] },
    });
    await expect(runBackupJob(job, deps)).resolves.toEqual({ snapshotCount: 0 });
    expect(deps.log).toHaveBeenCalledWith(
      expect.stringMatching(/^warning: snapshot created but some files were unreadable:/),
    );
  });

  it('exit 3 tolerance is scoped to the paths layer — a DB-layer exit 3 still fails the job', async () => {
    const { restic } = makeFakeRestic({
      onBackup: (args) => {
        if (args.includes('--stdin')) {
          throw new Error('restic backup exit 3: partial stdin');
        }
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
      /restic dump failed/,
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

  // ── Container env → real dump credentials (the labib root cause) ──────────

  it('postgres: uses POSTGRES_USER from the inspected container env (labib repro)', async () => {
    const { restic } = makeFakeRestic();
    const { docker, streams } = makeFakeDocker({
      inspect: () => ({ image: 'postgres:15-alpine', env: ['POSTGRES_USER=labib_user'] }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'labib_db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(streams[0]?.argv).toEqual([
      'pg_dumpall',
      '--clean',
      '--if-exists',
      '-U',
      'labib_user',
    ]);
  });

  it('fails fast when the target container is not running — restic is never touched', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker({
      inspect: () => ({ running: false }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /container c1 is not running — start it or disable this database layer/,
    );
    // Only the inspect ran; no dump exec, no restic.
    expect(dockerCalls).toHaveLength(0);
    expect(resticCalls.filter((c) => c.op === 'backup')).toHaveLength(0);
  });

  it('surfaces the dump exit code + real stderr, not restic\'s "no data read"', async () => {
    // The dump exits 1 writing nothing; restic then fails on empty stdin. The
    // job error must quote the DUMP failure (role does not exist), the real
    // cause — never the downstream "no data read" symptom.
    const { restic } = makeFakeRestic({
      onBackup: () => {
        throw new Error('restic backup exit 3: read /db.dump: no data read');
      },
    });
    const { docker } = makeFakeDocker({
      onExecStream: () => ({
        stdout: '',
        exitCode: 1,
        stderrTail: 'pg_dumpall: error: FATAL: role "postgres" does not exist',
      }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for db \(exit 1\): pg_dumpall: error: FATAL: role "postgres" does not exist/,
    );
  });

  it('partial-dump guard: restic SUCCEEDS but the dump exited non-zero → job still FAILS', async () => {
    // Regression: a dump that dies after emitting partial bytes leaves restic
    // happy (snapshot created) — without the exit check this was recorded as a
    // successful backup of a corrupt dump.
    const { restic } = makeFakeRestic(); // restic.backup resolves fine
    const { docker } = makeFakeDocker({
      onExecStream: () => ({ stdout: 'partial', exitCode: 2, stderrTail: 'killed mid-dump' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for db \(exit 2\): killed mid-dump/,
    );
  });

  it('a non-fallback dump failure with empty stderr falls back to "no stderr"', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      onExecStream: () => ({ exitCode: 5, stderrTail: '' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'postgres', container: 'c1', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for db \(exit 5\): no stderr/,
    );
  });

  // ── Mongo credentials + standalone --oplog fallback ───────────────────────

  it('mongo: appends root creds from env and keeps --oplog when it works', async () => {
    const { restic } = makeFakeRestic();
    const { docker, streams } = makeFakeDocker({
      inspect: () => ({
        image: 'mongo:7',
        env: ['MONGO_INITDB_ROOT_USERNAME=root', 'MONGO_INITDB_ROOT_PASSWORD=s3cr3t'],
      }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'mongo', type: 'mongo', container: 'c-mongo', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(streams).toHaveLength(1);
    expect(streams[0]?.argv).toEqual([
      'mongodump',
      '--archive',
      '--oplog',
      '-u',
      'root',
      '-p',
      's3cr3t',
      '--authenticationDatabase',
      'admin',
    ]);
  });

  it('mongo: retries WITHOUT --oplog once when the server is standalone', async () => {
    const { restic } = makeFakeRestic();
    const { docker, streams } = makeFakeDocker({
      inspect: () => ({ image: 'mongo:7' }),
      onExecStream: (_c, argv) =>
        argv.includes('--oplog')
          ? { exitCode: 1, stderrTail: 'error: --oplog mode only works on replica sets' }
          : { exitCode: 0 },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'mongo', type: 'mongo', container: 'c-mongo', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(streams.map((s) => s.argv)).toEqual([
      ['mongodump', '--archive', '--oplog'],
      ['mongodump', '--archive'], // retry dropped --oplog
    ]);
  });

  it('mongo: does NOT retry when the failure is unrelated to --oplog', async () => {
    const { restic } = makeFakeRestic();
    const { docker, streams } = makeFakeDocker({
      inspect: () => ({ image: 'mongo:7' }),
      onExecStream: () => ({ exitCode: 1, stderrTail: 'Authentication failed' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'mongo', type: 'mongo', container: 'c-mongo', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for mongo \(exit 1\): Authentication failed/,
    );
    expect(streams).toHaveLength(1); // no retry
  });

  // ── MySQL/MariaDB: password via env, never argv ───────────────────────────

  it('mysql: password rides MYSQL_PWD in the exec env, never the argv; no bare -p', async () => {
    const { restic } = makeFakeRestic();
    const { docker, streams } = makeFakeDocker({
      inspect: () => ({ image: 'mysql:8', env: ['MYSQL_ROOT_PASSWORD=rootpw'] }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'mysql', container: 'c-mysql', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(streams[0]?.argv).toEqual([
      'mysqldump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
    ]);
    expect(streams[0]?.env).toEqual(['MYSQL_PWD=rootpw']);
    expect(streams[0]?.argv.some((a) => a.includes('rootpw'))).toBe(false);
    expect(streams[0]?.argv).not.toContain('-p');
  });

  it('mariadb: empty password → no MYSQL_PWD env and no -p token', async () => {
    const { restic } = makeFakeRestic();
    const { docker, streams } = makeFakeDocker({
      inspect: () => ({ image: 'mariadb:11' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'db', type: 'mariadb', container: 'c-maria', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    expect(streams[0]?.env).toEqual([]); // no MYSQL_PWD → docker-client omits Env
    expect(streams[0]?.argv).not.toContain('-p');
  });

  // ── Redis/Valkey: auth via env, requirepass from Cmd, SAVE reply verified ──

  it('redis: REDISCLI_AUTH from REDIS_PASSWORD env; secret never in argv', async () => {
    const { restic } = makeFakeRestic();
    const { docker, collects } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7', env: ['REDIS_PASSWORD=hunter2'] }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    const saveCall = collects.find((c) => c.argv.includes('SAVE'));
    expect(saveCall?.env).toEqual(['REDISCLI_AUTH=hunter2']);
    expect(saveCall?.argv).toEqual(['redis-cli', 'SAVE']);
  });

  it('redis: reads --requirepass from the container Cmd when no env password', async () => {
    const { restic } = makeFakeRestic();
    const { docker, collects } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7', cmd: ['redis-server', '--requirepass', 'fromcmd'] }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await runBackupJob(job, makeDeps(restic, docker));
    const saveCall = collects.find((c) => c.argv.includes('SAVE'));
    expect(saveCall?.env).toEqual(['REDISCLI_AUTH=fromcmd']);
  });

  it('redis: a non-OK SAVE reply fails the layer (NOAUTH → never a stale backup)', async () => {
    const { restic, calls: resticCalls } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7' }),
      onExecCollect: () => ({ exitCode: 0, stdout: 'NOAUTH Authentication required.' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /redis-cli SAVE did not return OK: NOAUTH Authentication required\./,
    );
    // The stale /data/dump.rdb was never streamed to restic.
    expect(resticCalls.filter((c) => c.op === 'backup')).toHaveLength(0);
  });

  it('file-mode: a non-zero dump exit fails BEFORE the artifact read (cat)', async () => {
    const { restic } = makeFakeRestic();
    const { docker, calls: dockerCalls } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7' }),
      // Empty stderr exercises the "no stderr" fallback in the message.
      onExecCollect: () => ({ exitCode: 1, stdout: '', stderr: '' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for cache \(exit 1\): no stderr/,
    );
    // Only the SAVE ran; the cat artifact-read never fired.
    expect(dockerCalls).toEqual([{ container: 'c-redis', argv: ['redis-cli', 'SAVE'] }]);
  });

  it('file-mode: a non-zero artifact-read exit fails the layer', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7' }),
      onExecStream: () => ({ exitCode: 1, stderrTail: 'cat: /data/dump.rdb: No such file' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /artifact read failed for cache \(exit 1\): cat: \/data\/dump\.rdb: No such file/,
    );
  });

  it('file-mode: an artifact-read exit with empty stderr falls back to "no stderr"', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7' }),
      onExecStream: () => ({ exitCode: 1, stderrTail: '' }),
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /artifact read failed for cache \(exit 1\): no stderr/,
    );
  });

  it('file-mode: normalizes a non-Error artifact-read setup rejection', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7' }),
      onExecStream: () => {
        throw 'raw cat failure';
      },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /artifact read failed for cache: raw cat failure/,
    );
  });

  it('file-mode: wraps an execCollect (dump) setup failure as "dump failed for <service>"', async () => {
    const { restic } = makeFakeRestic();
    const docker: DockerClient = {
      ...makeFakeDocker({ inspect: () => ({ image: 'redis:7' }) }).docker,
      async execCollect() {
        throw new Error('exec create failed');
      },
    };
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for cache: exec create failed/,
    );
  });

  it('file-mode: wraps an artifact-read execStream setup failure', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'redis:7' }),
      onExecStream: () => {
        throw new Error('cat exec create failed');
      },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /artifact read failed for cache: cat exec create failed/,
    );
  });

  it('file-mode: a restic failure on the artifact stream surfaces as "restic dump failed"', async () => {
    const { restic } = makeFakeRestic({
      onBackup: () => {
        throw new Error('repo locked');
      },
    });
    const { docker } = makeFakeDocker({ inspect: () => ({ image: 'redis:7' }) });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /restic dump failed: repo locked/,
    );
  });

  it('mongo: a retry that also fails surfaces the retry exit + stderr', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'mongo:7' }),
      onExecStream: (_c, argv) =>
        argv.includes('--oplog')
          ? { exitCode: 1, stderrTail: '--oplog mode only works on replica sets' }
          : { exitCode: 1, stderrTail: 'disk full' },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'mongo', type: 'mongo', container: 'c-mongo', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for mongo \(exit 1\): disk full/,
    );
  });

  it('mongo: a retry that fails with empty stderr falls back to "no stderr"', async () => {
    const { restic } = makeFakeRestic();
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'mongo:7' }),
      onExecStream: (_c, argv) =>
        argv.includes('--oplog')
          ? { exitCode: 1, stderrTail: 'only works on replica sets' }
          : { exitCode: 4, stderrTail: '' },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'mongo', type: 'mongo', container: 'c-mongo', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for mongo \(exit 4\): no stderr/,
    );
  });

  it('file-mode: normalizes a non-Error execCollect (dump) setup rejection', async () => {
    const { restic } = makeFakeRestic();
    const docker: DockerClient = {
      ...makeFakeDocker({ inspect: () => ({ image: 'redis:7' }) }).docker,
      async execCollect() {
        throw 'raw dump setup failure';
      },
    };
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'cache', type: 'redis', container: 'c-redis', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /dump failed for cache: raw dump setup failure/,
    );
  });

  it('mongo: a restic failure AFTER a successful --oplog-dropped retry surfaces as "restic dump failed"', async () => {
    const { restic } = makeFakeRestic({
      onBackup: () => {
        throw new Error('network down');
      },
    });
    const { docker } = makeFakeDocker({
      inspect: () => ({ image: 'mongo:7' }),
      onExecStream: (_c, argv) =>
        argv.includes('--oplog')
          ? { exitCode: 1, stderrTail: 'only works on replica sets' }
          : { exitCode: 0 },
    });
    const job = baseJob({
      plan: {
        paths: [],
        configs: [],
        databases: [{ service: 'mongo', type: 'mongo', container: 'c-mongo', enabled: true }],
      },
    });
    await expect(runBackupJob(job, makeDeps(restic, docker))).rejects.toThrow(
      /restic dump failed: network down/,
    );
  });
});
