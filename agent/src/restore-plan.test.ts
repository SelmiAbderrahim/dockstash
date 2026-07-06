// Mirrors server/src/modules/backups/backups.restore-plan.test.ts — keeps the
// vendored copy honest.
import { PassThrough, type Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  buildDbRestorePlan,
  classifySnapshot,
  dbSnapshotTag,
  expectedArtifactName,
  performDbRestore,
  UnsupportedRestoreError,
  type DbRestoreDeps,
  type DbRestorePlan,
  type PlanDatabase,
  type RestoreExecResult,
} from './restore-plan.js';

const db = (service: string, type: string, container = `c-${service}`): PlanDatabase => ({
  service,
  type,
  container,
  enabled: true,
});

describe('dbSnapshotTag', () => {
  it('builds the db:<service>:<type> tag', () => {
    expect(dbSnapshotTag('cache', 'redis')).toBe('db:cache:redis');
  });
});

describe('expectedArtifactName', () => {
  it('stdin engines → <service>.dump', () => {
    expect(expectedArtifactName(db('db', 'postgres'))).toBe('db.dump');
    expect(expectedArtifactName(db('main', 'mongo'))).toBe('main.dump');
  });

  it('file engines → <service>-<basename>', () => {
    expect(expectedArtifactName(db('redis', 'redis'))).toBe('redis-dump.rdb');
    expect(expectedArtifactName(db('kv', 'valkey'))).toBe('kv-dump.rdb');
    expect(expectedArtifactName(db('app', 'sqlite'))).toBe('app-app-backup.db');
  });

  it('directory engines → <service>.tar', () => {
    expect(expectedArtifactName(db('ch', 'clickhouse'))).toBe('ch.tar');
    expect(expectedArtifactName(db('objects', 'minio'))).toBe('objects.tar');
  });

  it('unknown type → null', () => {
    expect(expectedArtifactName(db('weird', 'not-a-db'))).toBeNull();
  });
});

describe('classifySnapshot', () => {
  const databases = [db('redis', 'redis', 'thakaatprodredis'), db('db', 'postgres')];

  it('prefers a db:<service>:<type> tag naming a known plan service', () => {
    const cls = classifySnapshot({ tags: ['db:redis:redis'], paths: [] }, databases);
    expect(cls).toEqual({
      kind: 'db',
      db: databases[0],
      artifactPath: '/redis-dump.rdb',
    });
  });

  it('ignores tags for services not in the plan', () => {
    const cls = classifySnapshot({ tags: ['db:ghost:redis'] }, databases);
    expect(cls).toEqual({ kind: 'paths' });
  });

  it('ignores non-db tags', () => {
    const cls = classifySnapshot({ tags: ['manual', 'weekly'] }, databases);
    expect(cls).toEqual({ kind: 'paths' });
  });

  it('falls through a tag whose plan type has no adapter', () => {
    const weird = [db('x', 'not-a-db')];
    expect(classifySnapshot({ tags: ['db:x:not-a-db'] }, weird)).toEqual({ kind: 'paths' });
  });

  it('heuristic: single root-level artifact path matches a plan db (prod /redis-dump.rdb)', () => {
    const cls = classifySnapshot({ paths: ['/redis-dump.rdb'] }, databases);
    expect(cls).toEqual({
      kind: 'db',
      db: databases[0],
      artifactPath: '/redis-dump.rdb',
    });
  });

  it('heuristic: stdin artifact name matches', () => {
    const cls = classifySnapshot({ paths: ['/db.dump'] }, databases);
    expect(cls).toEqual({ kind: 'db', db: databases[1], artifactPath: '/db.dump' });
  });

  it('multiple paths → paths snapshot', () => {
    expect(classifySnapshot({ paths: ['/redis-dump.rdb', '/db.dump'] }, databases)).toEqual({
      kind: 'paths',
    });
  });

  it('nested single path → paths snapshot', () => {
    expect(classifySnapshot({ paths: ['/var/www/app'] }, databases)).toEqual({ kind: 'paths' });
  });

  it('single root path not matching any plan db → paths snapshot', () => {
    expect(classifySnapshot({ paths: ['/stray.bin'] }, databases)).toEqual({ kind: 'paths' });
  });

  it('missing paths and tags → paths snapshot', () => {
    expect(classifySnapshot({}, databases)).toEqual({ kind: 'paths' });
  });
});

describe('buildDbRestorePlan', () => {
  it('postgres: psql against the maintenance DB with the configured user', () => {
    const plan = buildDbRestorePlan(db('db', 'postgres'), {
      image: 'postgres:16',
      environment: ['POSTGRES_USER=app'],
    });
    expect(plan).toEqual({
      service: 'db',
      type: 'postgres',
      container: 'c-db',
      steps: [{ kind: 'exec-stdin', argv: ['psql', '-U', 'app', '-d', 'postgres'] }],
    });
  });

  it('postgres: defaults the user to postgres', () => {
    const plan = buildDbRestorePlan(db('db', 'postgres'), { image: 'postgres:16' });
    expect(plan.steps).toEqual([
      { kind: 'exec-stdin', argv: ['psql', '-U', 'postgres', '-d', 'postgres'] },
    ]);
  });

  it('mysql: root password from env, empty fallback', () => {
    expect(
      buildDbRestorePlan(db('sql', 'mysql'), {
        image: 'mysql:8',
        environment: ['MYSQL_ROOT_PASSWORD=s3cret'],
      }).steps,
    ).toEqual([{ kind: 'exec-stdin', argv: ['mysql', '-uroot', '-ps3cret'] }]);
    expect(buildDbRestorePlan(db('sql', 'mysql'), { image: 'mysql:8' }).steps).toEqual([
      { kind: 'exec-stdin', argv: ['mysql', '-uroot', '-p'] },
    ]);
  });

  it('mariadb: MARIADB_ROOT_PASSWORD, legacy MYSQL_ROOT_PASSWORD fallback, empty default', () => {
    expect(
      buildDbRestorePlan(db('m', 'mariadb'), {
        image: 'mariadb:11',
        environment: ['MARIADB_ROOT_PASSWORD=mm'],
      }).steps,
    ).toEqual([{ kind: 'exec-stdin', argv: ['mariadb', '-uroot', '-pmm'] }]);
    expect(
      buildDbRestorePlan(db('m', 'mariadb'), {
        image: 'mariadb:11',
        environment: ['MYSQL_ROOT_PASSWORD=legacy'],
      }).steps,
    ).toEqual([{ kind: 'exec-stdin', argv: ['mariadb', '-uroot', '-plegacy'] }]);
    expect(buildDbRestorePlan(db('m', 'mariadb'), { image: 'mariadb:11' }).steps).toEqual([
      { kind: 'exec-stdin', argv: ['mariadb', '-uroot', '-p'] },
    ]);
  });

  it('mongo: mongorestore --archive --oplogReplay --drop', () => {
    expect(buildDbRestorePlan(db('main', 'mongo'), { image: 'mongo:7' }).steps).toEqual([
      {
        kind: 'exec-stdin',
        argv: ['mongorestore', '--archive', '--oplogReplay', '--drop'],
      },
    ]);
  });

  it('redis: guard old-AOF, disable persistence writes, stage RDB + AOF base, swap, restart', () => {
    expect(buildDbRestorePlan(db('redis', 'redis'), { image: 'redis:7-alpine' }).steps).toEqual([
      {
        kind: 'exec-guard',
        argv: ['redis-cli', 'INFO'],
        failIfStdoutMatches: 'redis_version:[0-6]\\.[\\s\\S]*aof_enabled:1',
        error:
          'AOF persistence is enabled on a pre-7 server — the RDB restore cannot be loaded safely; disable appendonly or upgrade to redis/valkey 7+',
      },
      { kind: 'exec', argv: ['redis-cli', 'CONFIG', 'SET', 'save', ''] },
      { kind: 'exec', argv: ['redis-cli', 'CONFIG', 'SET', 'appendonly', 'no'] },
      { kind: 'exec-stdin', argv: ['dd', 'of=/data/dump.rdb.dockstash-restore'] },
      { kind: 'exec', argv: ['mv', '-f', '/data/dump.rdb.dockstash-restore', '/data/dump.rdb'] },
      { kind: 'exec', argv: ['mkdir', '-p', '/data/appendonlydir.dockstash-restore'] },
      {
        kind: 'exec',
        argv: [
          'cp',
          '/data/dump.rdb',
          '/data/appendonlydir.dockstash-restore/appendonly.aof.1.base.rdb',
        ],
      },
      {
        kind: 'exec-stdin-text',
        argv: ['dd', 'of=/data/appendonlydir.dockstash-restore/appendonly.aof.manifest'],
        text: 'file appendonly.aof.1.base.rdb seq 1 type b\n',
      },
      { kind: 'exec', argv: ['rm', '-rf', '/data/appendonlydir'] },
      { kind: 'exec', argv: ['mv', '-f', '/data/appendonlydir.dockstash-restore', '/data/appendonlydir'] },
      { kind: 'restart' },
    ]);
  });

  it('valkey: same sequence via valkey-cli', () => {
    const steps = buildDbRestorePlan(db('kv', 'valkey'), { image: 'valkey/valkey:8' }).steps;
    expect(steps[0]).toMatchObject({ argv: ['valkey-cli', 'INFO'] });
    expect(steps[1]).toEqual({ kind: 'exec', argv: ['valkey-cli', 'CONFIG', 'SET', 'save', ''] });
    expect(steps[2]).toEqual({
      kind: 'exec',
      argv: ['valkey-cli', 'CONFIG', 'SET', 'appendonly', 'no'],
    });
    expect(steps).toHaveLength(11);
  });

  it('sqlite: stage via dd, .restore, clean up (no restart)', () => {
    expect(buildDbRestorePlan(db('app', 'sqlite'), { image: 'nouchka/sqlite3' }).steps).toEqual([
      { kind: 'exec-stdin', argv: ['dd', 'of=/backup/app-restore.db'] },
      { kind: 'exec', argv: ['sqlite3', '/data/app.db', '.restore /backup/app-restore.db'] },
      { kind: 'exec', argv: ['rm', '-f', '/backup/app-restore.db'] },
    ]);
  });

  it('prefers the live image over the plan type for adapter matching', () => {
    // Plan says "redis" but the live container runs valkey — trust the image.
    const plan = buildDbRestorePlan(db('cache', 'redis'), { image: 'valkey/valkey:8' });
    expect(plan.type).toBe('valkey');
  });

  it('falls back to the plan type when the image matches no adapter', () => {
    const plan = buildDbRestorePlan(db('db', 'postgres'), { image: 'custom-image:1' });
    expect(plan.type).toBe('postgres');
  });

  it('throws UnsupportedRestoreError for directory/unsupported engines and unknown types', () => {
    for (const type of ['clickhouse', 'elasticsearch', 'rabbitmq', 'minio', 'influxdb', 'neo4j']) {
      expect(() => buildDbRestorePlan(db('x', type), { image: type })).toThrow(
        UnsupportedRestoreError,
      );
    }
    expect(() => buildDbRestorePlan(db('x', 'not-a-db'), {})).toThrow(
      /overwrite restore is not supported for not-a-db/,
    );
    try {
      buildDbRestorePlan(db('x', 'clickhouse'), { image: 'clickhouse/clickhouse-server:24' });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedRestoreError);
      expect((err as UnsupportedRestoreError).engine).toBe('clickhouse');
      expect((err as UnsupportedRestoreError).code).toBe('unsupportedEngine');
    }
  });
});

interface FakeRestoreDeps {
  deps: DbRestoreDeps;
  log: string[];
  execCalls: Array<{ container: string; argv: string[] }>;
  stdinCalls: Array<{ container: string; argv: string[]; stdin: Readable }>;
  dumpCalls: string[][];
  restartCalls: string[];
}

interface FakeRestoreOptions {
  execResult?(argv: string[]): RestoreExecResult;
  stdinResult?: { exitCode: number; stderr: string };
  stdinReject?: Error;
  dumpDoneReject?: Error;
  restartReject?: Error;
}

function makeRestoreDeps(opts: FakeRestoreOptions = {}): FakeRestoreDeps {
  const log: string[] = [];
  const execCalls: FakeRestoreDeps['execCalls'] = [];
  const stdinCalls: FakeRestoreDeps['stdinCalls'] = [];
  const dumpCalls: string[][] = [];
  const restartCalls: string[] = [];
  const deps: DbRestoreDeps = {
    restic: {
      async dump(args) {
        dumpCalls.push(args);
        const stream = new PassThrough();
        stream.end('artifact-bytes');
        return {
          stream,
          done: opts.dumpDoneReject ? Promise.reject(opts.dumpDoneReject) : Promise.resolve(),
        };
      },
    },
    docker: {
      async execCollect(container, argv) {
        execCalls.push({ container, argv });
        return opts.execResult
          ? opts.execResult(argv)
          : { exitCode: 0, stdout: '', stderr: '' };
      },
      async execWithStdin(container, argv, stdin) {
        stdinCalls.push({ container, argv, stdin });
        if (opts.stdinReject) throw opts.stdinReject;
        return opts.stdinResult ?? { exitCode: 0, stderr: '' };
      },
      async restart(container) {
        restartCalls.push(container);
        if (opts.restartReject) throw opts.restartReject;
      },
    },
    log: (line) => log.push(line),
  };
  return { deps, log, execCalls, stdinCalls, dumpCalls, restartCalls };
}

const redisPlan = (): DbRestorePlan =>
  buildDbRestorePlan(db('redis', 'redis', 'c-redis'), { image: 'redis:7-alpine' });

const mongoPlan = (): DbRestorePlan =>
  buildDbRestorePlan(db('main', 'mongo', 'c-mongo'), { image: 'mongo:7' });

describe('performDbRestore', () => {
  it('runs the full redis sequence: guard, persistence off, RDB + AOF base staged, swap, restart', async () => {
    const f = makeRestoreDeps();
    await performDbRestore('deadbeefcafe', '/redis-dump.rdb', redisPlan(), f.deps);
    expect(f.execCalls.map((c) => c.argv[0])).toEqual([
      'redis-cli', // INFO guard
      'redis-cli', // CONFIG SET save ''
      'redis-cli', // CONFIG SET appendonly no
      'mv', // dump.rdb swap
      'mkdir',
      'cp',
      'rm',
      'mv', // appendonlydir swap
    ]);
    expect(f.dumpCalls).toEqual([['dump', 'deadbeefcafe', '/redis-dump.rdb']]);
    // Two stdin execs: the restic-dump RDB, then the literal AOF manifest.
    expect(f.stdinCalls).toHaveLength(2);
    expect(f.stdinCalls[0]).toMatchObject({
      container: 'c-redis',
      argv: ['dd', 'of=/data/dump.rdb.dockstash-restore'],
    });
    expect(f.stdinCalls[1]).toMatchObject({
      argv: ['dd', 'of=/data/appendonlydir.dockstash-restore/appendonly.aof.manifest'],
    });
    expect(f.restartCalls).toEqual(['c-redis']);
    expect(f.log.at(-1)).toBe('restore redis (redis) in c-redis: done');
    expect(f.log.length).toBeGreaterThanOrEqual(11);
  });

  it('exec step: non-zero exit throws with the stderr tail', async () => {
    const f = makeRestoreDeps({
      execResult: (argv) =>
        argv[0] === 'mv'
          ? { exitCode: 1, stdout: '', stderr: 'mv: cannot move' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow('restore redis (redis) in c-redis: mv exit 1: mv: cannot move');
  });

  it('exec step: falls back to stdout when stderr is empty', async () => {
    const f = makeRestoreDeps({
      execResult: (argv) =>
        argv[0] === 'mv'
          ? { exitCode: 2, stdout: 'some stdout detail', stderr: '' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow(/mv exit 2: some stdout detail/);
  });

  it('guard step: trips on an AOF-enabled pre-7 server', async () => {
    const f = makeRestoreDeps({
      execResult: (argv) =>
        argv.includes('INFO')
          ? {
              exitCode: 0,
              stdout: 'redis_version:6.2.14\r\n...\r\naof_enabled:1\r\n',
              stderr: '',
            }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow(/AOF persistence is enabled on a pre-7 server/);
    expect(f.stdinCalls).toHaveLength(0);
    expect(f.restartCalls).toHaveLength(0);
  });

  it('guard step: passes a redis 7 server with AOF enabled', async () => {
    const f = makeRestoreDeps({
      execResult: (argv) =>
        argv.includes('INFO')
          ? {
              exitCode: 0,
              stdout: 'redis_version:7.4.1\r\n...\r\naof_enabled:1\r\n',
              stderr: '',
            }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    await performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps);
    expect(f.restartCalls).toEqual(['c-redis']);
  });

  it('guard step: non-zero exit throws before evaluating the marker', async () => {
    const f = makeRestoreDeps({
      execResult: (argv) =>
        argv.includes('INFO')
          ? { exitCode: 127, stdout: '', stderr: 'redis-cli: not found' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow(/redis-cli exit 127: redis-cli: not found/);
  });

  it('guard step: stdout fallback when a failing guard has empty stderr', async () => {
    const f = makeRestoreDeps({
      execResult: (argv) =>
        argv.includes('INFO')
          ? { exitCode: 5, stdout: 'guard stdout detail', stderr: '' }
          : { exitCode: 0, stdout: '', stderr: '' },
    });
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow(/redis-cli exit 5: guard stdout detail/);
  });

  it('exec-stdin: passes the dump stream to the consumer', async () => {
    const f = makeRestoreDeps();
    await performDbRestore('dead', '/main.dump', mongoPlan(), f.deps);
    expect(f.dumpCalls).toEqual([['dump', 'dead', '/main.dump']]);
    expect(f.stdinCalls[0]?.argv).toEqual([
      'mongorestore',
      '--archive',
      '--oplogReplay',
      '--drop',
    ]);
    expect(f.stdinCalls[0]?.stdin).toBeDefined();
  });

  it('exec-stdin: consumer non-zero exit throws with the stderr tail', async () => {
    const f = makeRestoreDeps({ stdinResult: { exitCode: 1, stderr: 'restore botched' } });
    await expect(performDbRestore('dead', '/main.dump', mongoPlan(), f.deps)).rejects.toThrow(
      'restore main (mongo) in c-mongo: mongorestore exit 1: restore botched',
    );
  });

  it('exec-stdin: a consumer transport rejection propagates', async () => {
    const f = makeRestoreDeps({ stdinReject: new Error('hijack failed') });
    await expect(performDbRestore('dead', '/main.dump', mongoPlan(), f.deps)).rejects.toThrow(
      /hijack failed/,
    );
  });

  it('exec-stdin: a restic dump failure fails the step even when the consumer exits 0', async () => {
    const f = makeRestoreDeps({ dumpDoneReject: new Error('restic dump exit 1: repo gone') });
    await expect(performDbRestore('dead', '/main.dump', mongoPlan(), f.deps)).rejects.toThrow(
      /restic dump exit 1: repo gone/,
    );
  });

  it('exec-stdin: joins both failures when the consumer AND restic fail', async () => {
    const f = makeRestoreDeps({
      stdinResult: { exitCode: 1, stderr: 'broken pipe' },
      dumpDoneReject: new Error('restic died'),
    });
    await expect(performDbRestore('dead', '/main.dump', mongoPlan(), f.deps)).rejects.toThrow(
      /mongorestore exit 1: broken pipe; restic died/,
    );
  });

  it('exec-stdin: normalizes non-Error rejections', async () => {
    const f = makeRestoreDeps({ dumpDoneReject: 'raw failure' as unknown as Error });
    await expect(performDbRestore('dead', '/main.dump', mongoPlan(), f.deps)).rejects.toThrow(
      /raw failure/,
    );
  });

  it('exec-stdin-text: a failing manifest write surfaces the stderr tail', async () => {
    let stdinCallCount = 0;
    const f = makeRestoreDeps();
    const origExecWithStdin = f.deps.docker.execWithStdin.bind(f.deps.docker);
    f.deps.docker.execWithStdin = async (container, argv, stdin) => {
      stdinCallCount += 1;
      if (stdinCallCount === 2) {
        return { exitCode: 1, stderr: 'dd: manifest write failed' };
      }
      return origExecWithStdin(container, argv, stdin);
    };
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow(/dd exit 1: dd: manifest write failed/);
  });

  it('restart step: propagates docker restart failures', async () => {
    const f = makeRestoreDeps({
      restartReject: new Error('docker restart denied (403): ALLOW_RESTARTS'),
    });
    await expect(
      performDbRestore('dead', '/redis-dump.rdb', redisPlan(), f.deps),
    ).rejects.toThrow(/ALLOW_RESTARTS/);
  });

  it('truncates oversized stderr to a 500-char tail', async () => {
    const noise = `${'x'.repeat(600)}TAIL-MARKER`;
    const f = makeRestoreDeps({ stdinResult: { exitCode: 1, stderr: noise } });
    const err = await performDbRestore('dead', '/main.dump', mongoPlan(), f.deps).then(
      () => {
        throw new Error('should have rejected');
      },
      (e: Error) => e,
    );
    expect(err.message).toContain('TAIL-MARKER');
    // prefix + exit banner + 500-char tail — the 600-char head is dropped.
    expect(err.message.length).toBeLessThan(600);
  });
});
