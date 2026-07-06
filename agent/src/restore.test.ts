import { PassThrough, type Readable } from 'node:stream';
import { describe, expect, it, vi } from 'vitest';
import { resolveSnapshot, runRestoreJob, SNAPSHOT_ID_RE, type RestoreDeps } from './restore.js';
import type { DockerClient, DockerInspectResult } from './docker-client.js';
import type { ResticRunnerExt, ResticSnapshotDetail } from './restic-runner.js';
import type { ClaimedJob } from './types.js';

interface FakeOptions {
  snapshots?: ResticSnapshotDetail[];
  inspect?: DockerInspectResult;
  stdinResult?: { exitCode: number; stderr: string };
}

interface Fakes {
  deps: RestoreDeps;
  restoreCalls: string[][];
  dumpCalls: string[][];
  inspectCalls: string[];
  stdinCalls: Array<{ container: string; argv: string[] }>;
  restartCalls: string[];
  execCalls: Array<{ container: string; argv: string[] }>;
  log: ReturnType<typeof vi.fn>;
}

function makeFakes(opts: FakeOptions = {}): Fakes {
  const restoreCalls: string[][] = [];
  const dumpCalls: string[][] = [];
  const inspectCalls: string[] = [];
  const stdinCalls: Array<{ container: string; argv: string[] }> = [];
  const restartCalls: string[] = [];
  const execCalls: Array<{ container: string; argv: string[] }> = [];
  const restic: ResticRunnerExt = {
    async init() {},
    async backup() {},
    async snapshots() {
      return [];
    },
    async snapshotsDetailed() {
      return opts.snapshots ?? [];
    },
    async stats() {
      return {};
    },
    async check() {},
    async restore(args) {
      restoreCalls.push(args);
    },
    async dump(args) {
      dumpCalls.push(args);
      const stream = new PassThrough();
      stream.end('bytes');
      return { stream, done: Promise.resolve() };
    },
    async unlock() {},
    async forget() {},
  };
  const docker: DockerClient = {
    async exec(): Promise<Readable> {
      const s = new PassThrough();
      s.end();
      return s;
    },
    async execCollect(container, argv) {
      execCalls.push({ container, argv });
      return { exitCode: 0, stdout: '', stderr: '' };
    },
    async execWithStdin(container, argv) {
      stdinCalls.push({ container, argv });
      return opts.stdinResult ?? { exitCode: 0, stderr: '' };
    },
    async restart(container) {
      restartCalls.push(container);
    },
    async inspect(container) {
      inspectCalls.push(container);
      return opts.inspect ?? { id: container, running: true, env: [], image: '' };
    },
    async listContainers() {
      return [];
    },
  };
  const log = vi.fn();
  return {
    deps: { restic, docker, roots: ['/var/www'], log },
    restoreCalls,
    dumpCalls,
    inspectCalls,
    stdinCalls,
    restartCalls,
    execCalls,
    log,
  };
}

function job(restore: ClaimedJob['restore'], databases: ClaimedJob['plan']['databases'] = []): ClaimedJob {
  return {
    id: 'job-1',
    kind: 'restore',
    projectId: 'proj-1',
    leaseSeconds: 60,
    attempt: 1,
    maxAttempts: 3,
    plan: { paths: [], configs: [], databases },
    retention: null,
    restore,
    repo: { url: 'sftp:backup@host:/repo', password: 'pw' },
    ssh: { privateKey: 'key', hostKeyLine: 'host ssh-ed25519 AAAA' },
  };
}

const redisDb = { service: 'redis', type: 'redis', container: 'thakaatprodredis', enabled: true };

describe('SNAPSHOT_ID_RE', () => {
  it('accepts hex ids and latest, rejects flag-shaped input', () => {
    expect(SNAPSHOT_ID_RE.test('5ad025be')).toBe(true);
    expect(SNAPSHOT_ID_RE.test('latest')).toBe(true);
    expect(SNAPSHOT_ID_RE.test('--flag')).toBe(false);
  });
});

describe('resolveSnapshot', () => {
  const snaps: ResticSnapshotDetail[] = [
    { id: 'aaaa1111aaaa', short_id: 'aaaa1111', time: '2026-07-01T00:00:00Z' },
    { id: 'bbbb2222bbbb', short_id: 'bbbb2222', time: '2026-07-05T00:00:00Z' },
  ];

  it('latest picks the newest by time', () => {
    expect(resolveSnapshot(snaps, 'latest')?.id).toBe('bbbb2222bbbb');
    expect(resolveSnapshot(snaps, 'LATEST')?.id).toBe('bbbb2222bbbb');
  });

  it('matches a short id exactly', () => {
    expect(resolveSnapshot(snaps, 'aaaa1111')?.id).toBe('aaaa1111aaaa');
  });

  it('matches a full-id prefix', () => {
    expect(resolveSnapshot(snaps, 'bbbb2222bb')?.id).toBe('bbbb2222bbbb');
  });

  it('returns undefined when nothing matches', () => {
    expect(resolveSnapshot(snaps, 'cccc3333')).toBeUndefined();
    expect(resolveSnapshot([], 'latest')).toBeUndefined();
  });
});

describe('runRestoreJob', () => {
  it('rejects a missing payload', async () => {
    const f = makeFakes();
    await expect(runRestoreJob(job(null), f.deps)).rejects.toThrow('restore job missing payload');
  });

  it('rejects a malformed snapshot id without touching restic', async () => {
    const f = makeFakes();
    await expect(
      runRestoreJob(job({ snapshotId: '--insecure', overwrite: true, targetPath: null }), f.deps),
    ).rejects.toThrow('invalid snapshot id: --insecure');
    expect(f.restoreCalls).toEqual([]);
  });

  it('non-overwrite: restores to the allowed target path', async () => {
    const f = makeFakes();
    await runRestoreJob(
      job({ snapshotId: 'deadbeef', overwrite: false, targetPath: '/var/www/app-restore' }),
      f.deps,
    );
    expect(f.restoreCalls).toEqual([
      ['restore', 'deadbeef', '--target', '/var/www/app-restore'],
    ]);
    expect(f.log).toHaveBeenCalledWith('restoring deadbeef to /var/www/app-restore');
  });

  it('non-overwrite: rejects a null targetPath', async () => {
    const f = makeFakes();
    await expect(
      runRestoreJob(job({ snapshotId: 'deadbeef', overwrite: false, targetPath: null }), f.deps),
    ).rejects.toThrow('restore target not allowed: ');
  });

  it('non-overwrite: rejects a target outside the roots', async () => {
    const f = makeFakes();
    await expect(
      runRestoreJob(
        job({ snapshotId: 'deadbeef', overwrite: false, targetPath: '/etc/passwd' }),
        f.deps,
      ),
    ).rejects.toThrow('restore target not allowed: /etc/passwd');
  });

  it('overwrite: unknown snapshot id fails with a clear message', async () => {
    const f = makeFakes({ snapshots: [] });
    await expect(
      runRestoreJob(job({ snapshotId: 'deadbeef', overwrite: true, targetPath: null }), f.deps),
    ).rejects.toThrow('snapshot deadbeef not found in the repository');
  });

  it('overwrite path snapshot: restores the full id over "/" after the roots pre-flight', async () => {
    const f = makeFakes({
      snapshots: [
        {
          id: 'deadbeefcafe',
          short_id: 'deadbeef',
          time: 't1',
          paths: ['/var/www/app', '/var/www/app/docker-compose.yml'],
        },
      ],
    });
    await runRestoreJob(
      job({ snapshotId: 'deadbeef', overwrite: true, targetPath: null }),
      f.deps,
    );
    expect(f.restoreCalls).toEqual([['restore', 'deadbeefcafe', '--target', '/']]);
  });

  it('overwrite path snapshot: tolerates a snapshot record with no paths field', async () => {
    const f = makeFakes({
      snapshots: [{ id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1' }],
    });
    await runRestoreJob(
      job({ snapshotId: 'deadbeef', overwrite: true, targetPath: null }),
      f.deps,
    );
    expect(f.restoreCalls).toEqual([['restore', 'deadbeefcafe', '--target', '/']]);
  });

  it('overwrite path snapshot: a recorded path outside the roots is refused (the /redis-dump.rdb failure mode)', async () => {
    const f = makeFakes({
      snapshots: [
        { id: 'deadbeefcafe', short_id: 'deadbeef', time: 't1', paths: ['/stray-file.bin'] },
      ],
    });
    await expect(
      runRestoreJob(job({ snapshotId: 'deadbeef', overwrite: true, targetPath: null }), f.deps),
    ).rejects.toThrow(
      'snapshot path /stray-file.bin is outside the agent project roots — restore to a new location instead',
    );
    expect(f.restoreCalls).toEqual([]);
  });

  it('overwrite db snapshot: streams the artifact back into the running container', async () => {
    const f = makeFakes({
      snapshots: [
        { id: '5ad025be1234', short_id: '5ad025be', time: 't1', paths: ['/redis-dump.rdb'] },
      ],
      inspect: {
        id: 'thakaatprodredis',
        running: true,
        env: [],
        image: 'redis:7-alpine',
      },
    });
    await runRestoreJob(
      job({ snapshotId: '5ad025be', overwrite: true, targetPath: null }, [redisDb]),
      f.deps,
    );
    expect(f.inspectCalls).toEqual(['thakaatprodredis']);
    // restic dump used the FULL snapshot id and the artifact path.
    expect(f.dumpCalls).toEqual([['dump', '5ad025be1234', '/redis-dump.rdb']]);
    expect(f.stdinCalls[0]).toMatchObject({
      container: 'thakaatprodredis',
      argv: ['dd', 'of=/data/dump.rdb.dockstash-restore'],
    });
    expect(f.restartCalls).toEqual(['thakaatprodredis']);
    // No filesystem restore happened — the artifact never touches the agent fs.
    expect(f.restoreCalls).toEqual([]);
  });

  it('overwrite db snapshot: env from inspect feeds credential resolution', async () => {
    const f = makeFakes({
      snapshots: [{ id: 'ffff0000ffff', short_id: 'ffff0000', time: 't1', paths: ['/db.dump'] }],
      inspect: {
        id: 'c-pg',
        running: true,
        env: ['POSTGRES_USER=app'],
        image: 'postgres:16',
      },
    });
    await runRestoreJob(
      job({ snapshotId: 'ffff0000', overwrite: true, targetPath: null }, [
        { service: 'db', type: 'postgres', container: 'c-pg', enabled: true },
      ]),
      f.deps,
    );
    // Cleanup scripts run first (strict psql), the dump replay is the last stdin step.
    expect(f.stdinCalls[0]?.argv).toEqual([
      'psql',
      '-U',
      'app',
      '-d',
      'postgres',
      '-v',
      'ON_ERROR_STOP=1',
    ]);
    expect(f.stdinCalls.at(-1)?.argv).toEqual(['psql', '-U', 'app', '-d', 'postgres']);
  });

  it('overwrite db snapshot: falls back to the plan type when inspect reports no image', async () => {
    const f = makeFakes({
      snapshots: [
        { id: '5ad025be1234', short_id: '5ad025be', time: 't1', paths: ['/redis-dump.rdb'] },
      ],
      inspect: { id: 'thakaatprodredis', running: true, env: [], image: '' },
    });
    await runRestoreJob(
      job({ snapshotId: '5ad025be', overwrite: true, targetPath: null }, [redisDb]),
      f.deps,
    );
    expect(f.restartCalls).toEqual(['thakaatprodredis']);
  });

  it('overwrite db snapshot: refuses a stopped container', async () => {
    const f = makeFakes({
      snapshots: [
        { id: '5ad025be1234', short_id: '5ad025be', time: 't1', paths: ['/redis-dump.rdb'] },
      ],
      inspect: { id: 'thakaatprodredis', running: false, env: [], image: 'redis:7' },
    });
    await expect(
      runRestoreJob(
        job({ snapshotId: '5ad025be', overwrite: true, targetPath: null }, [redisDb]),
        f.deps,
      ),
    ).rejects.toThrow('container thakaatprodredis is not running — start it and retry');
  });

  it('overwrite db snapshot: unsupported engine error propagates with the restore-to-path hint', async () => {
    const f = makeFakes({
      snapshots: [{ id: 'abcd1234abcd', short_id: 'abcd1234', time: 't1', paths: ['/ch.tar'] }],
      inspect: { id: 'c-ch', running: true, env: [], image: 'clickhouse/clickhouse-server:24' },
    });
    await expect(
      runRestoreJob(
        job({ snapshotId: 'abcd1234', overwrite: true, targetPath: null }, [
          { service: 'ch', type: 'clickhouse', container: 'c-ch', enabled: true },
        ]),
        f.deps,
      ),
    ).rejects.toThrow(/overwrite restore is not supported for clickhouse/);
  });

  it('overwrite db snapshot: a failing consumer surfaces the per-engine error', async () => {
    const f = makeFakes({
      snapshots: [
        { id: '5ad025be1234', short_id: '5ad025be', time: 't1', paths: ['/redis-dump.rdb'] },
      ],
      stdinResult: { exitCode: 1, stderr: 'dd: no space' },
    });
    await expect(
      runRestoreJob(
        job({ snapshotId: '5ad025be', overwrite: true, targetPath: null }, [redisDb]),
        f.deps,
      ),
    ).rejects.toThrow('restore redis (redis) in thakaatprodredis: dd exit 1: dd: no space');
  });
});
