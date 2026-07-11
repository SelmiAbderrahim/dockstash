import { Readable } from 'node:stream';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
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
import {
  ADAPTER_REGISTRY,
  matchAdapter,
  mariadbAdapter,
  mongoAdapter,
  mysqlAdapter,
  postgresAdapter,
  redisAdapter,
  valkeyAdapter,
  sqliteAdapter,
  clickhouseAdapter,
  elasticsearchAdapter,
  rabbitmqAdapter,
  minioAdapter,
  influxdbAdapter,
  neo4jAdapter,
  readServiceEnv,
} from './backups.adapters.js';
import {
  DEFAULT_AGENT_ROOTS,
  isAllowedProjectPath,
  isPathUnderRoots,
  isSafeAbsolutePath,
  normalizeProjectRoot,
} from './backups.paths.js';
import {
  detectProxyConfigs,
  resolveContainerName,
  scanProject,
} from './backups.scan.js';
import {
  createProject,
  listProjectsForUser,
  loadOwnedProject,
  runBackup,
  scanProjectPath,
  updateProjectPlan,
} from './backups.service.js';
import { serializeProject } from './backups.serialize.js';
import { Project } from './backups.model.js';
import type { ProjectHydrated } from './backups.model.js';
import type { DockerClient, ResticRunner } from './backups.boundaries.js';
import { verifyKeyParity } from '../../shared/i18n/index.js';

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email = 'owner@test.com'): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'irrelevant-hashed',
    profile: { firstName: 'O', lastName: 'W' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
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

interface MockDocker extends DockerClient {
  calls: Array<{ container: string; argv: string[]; env?: string[] }>;
  /** Mutable inspect result — env is the dump-credential source (was composeServices). */
  inspectEnv: string[];
  inspectCmd: string[];
  inspectImage: string;
  inspectRunning: boolean;
  /** Optional per-call outcome hooks (may throw to fail exec setup). */
  onExecStream?: (argv: string[]) => StreamOutcome;
  onExecCollect?: (argv: string[]) => CollectOutcome;
}

function makeMocks(): {
  restic: ResticRunner & { calls: Array<{ args: string[]; hasStdin: boolean }> };
  docker: MockDocker;
} {
  const restic = {
    calls: [] as Array<{ args: string[]; hasStdin: boolean }>,
    async init() {},
    async backup(args: string[], opts?: { stdin?: Readable }) {
      restic.calls.push({ args, hasStdin: Boolean(opts?.stdin) });
      if (opts?.stdin) opts.stdin.resume();
    },
    async snapshots() {
      return [];
    },
    async snapshotsDetailed() {
      return [];
    },
    async check() {},
    async restore() {},
    async dump(): Promise<never> {
      throw new Error('dump not stubbed');
    },
  };
  const docker: MockDocker = {
    calls: [] as Array<{ container: string; argv: string[]; env?: string[] }>,
    inspectEnv: [] as string[],
    inspectCmd: [] as string[],
    inspectImage: '',
    inspectRunning: true,
    async exec(container: string, argv: string[]) {
      docker.calls.push({ container, argv });
      return Readable.from(['dump-bytes']);
    },
    async execStream(container: string, argv: string[], opts?: { env?: string[] }) {
      docker.calls.push({ container, argv, env: opts?.env });
      const r = docker.onExecStream ? docker.onExecStream(argv) : {};
      const stream = new Readable({ read() {} });
      if (r.streamError) {
        const err = r.streamError;
        queueMicrotask(() => stream.destroy(err));
      } else {
        stream.push(r.stdout ?? 'dump-bytes');
        stream.push(null);
      }
      return {
        stream,
        exit: async () => ({ exitCode: r.exitCode ?? 0, stderrTail: r.stderrTail ?? '' }),
      };
    },
    async execCollect(container: string, argv: string[], env?: string[]) {
      docker.calls.push({ container, argv, env });
      const r = docker.onExecCollect ? docker.onExecCollect(argv) : {};
      return { exitCode: r.exitCode ?? 0, stdout: r.stdout ?? 'OK', stderr: r.stderr ?? '' };
    },
    async execWithStdin(): Promise<never> {
      throw new Error('execWithStdin not stubbed');
    },
    async restart(): Promise<never> {
      throw new Error('restart not stubbed');
    },
    async inspect(container: string) {
      return {
        id: container,
        running: docker.inspectRunning,
        env: docker.inspectEnv,
        cmd: docker.inspectCmd,
        image: docker.inspectImage,
      };
    },
    async listContainers() {
      return [];
    },
  };
  return { restic, docker };
}

describe('backups: path allowlist', () => {
  it('accepts /var/www/<name>', () => {
    expect(isAllowedProjectPath('/var/www/app')).toBe(true);
    expect(isAllowedProjectPath('/var/www/app/data')).toBe(true);
  });
  it('rejects paths outside /var/www', () => {
    expect(isAllowedProjectPath('/etc/passwd')).toBe(false);
    expect(isAllowedProjectPath('/var/log/app')).toBe(false);
  });
  it('rejects traversal segments', () => {
    expect(isAllowedProjectPath('/var/www/../etc')).toBe(false);
    expect(isAllowedProjectPath('/var/www/app/..')).toBe(false);
  });
  it('rejects non-absolute, empty, NUL, non-string', () => {
    expect(isAllowedProjectPath('var/www/app')).toBe(false);
    expect(isAllowedProjectPath('')).toBe(false);
    expect(isAllowedProjectPath('   ')).toBe(false);
    expect(isAllowedProjectPath('/var/www/app\0.evil')).toBe(false);
    expect(isAllowedProjectPath(42 as unknown)).toBe(false);
    expect(isAllowedProjectPath('/var/www/')).toBe(false);
    expect(isAllowedProjectPath('/var/www')).toBe(false);
  });
});

describe('backups: multi-root (agent) path helpers', () => {
  it('isSafeAbsolutePath enforces structure only', () => {
    expect(isSafeAbsolutePath('/opt/app')).toBe(true);
    expect(isSafeAbsolutePath('/var/www/app/')).toBe(true);
    expect(isSafeAbsolutePath('relative')).toBe(false);
    expect(isSafeAbsolutePath('')).toBe(false);
    expect(isSafeAbsolutePath('   ')).toBe(false);
    expect(isSafeAbsolutePath('/a/../b')).toBe(false);
    expect(isSafeAbsolutePath('/a\0b')).toBe(false);
    expect(isSafeAbsolutePath('/')).toBe(false);
    expect(isSafeAbsolutePath(9 as unknown)).toBe(false);
  });

  it('isPathUnderRoots allows equal-to-root and nested, rejects boundary lookalikes', () => {
    const roots = ['/opt/projects', '/srv'];
    expect(isPathUnderRoots('/opt/projects', roots)).toBe(true);
    expect(isPathUnderRoots('/opt/projects/shop', roots)).toBe(true);
    expect(isPathUnderRoots('/srv/x', roots)).toBe(true);
    expect(isPathUnderRoots('/opt/projectsx', roots)).toBe(false);
    expect(isPathUnderRoots('/var/www/app', roots)).toBe(false);
    expect(isPathUnderRoots('/opt/projects/../x', roots)).toBe(false);
    expect(isPathUnderRoots('/opt/projects/shop', [])).toBe(false);
  });

  it('normalizeProjectRoot canonicalizes and rejects the denied system prefixes', () => {
    expect(normalizeProjectRoot('/opt/projects/')).toBe('/opt/projects');
    expect(normalizeProjectRoot('  /srv//apps ')).toBe('/srv/apps');
    expect(normalizeProjectRoot('/')).toBeNull();
    expect(normalizeProjectRoot('///')).toBeNull();
    expect(normalizeProjectRoot('relative')).toBeNull();
    expect(normalizeProjectRoot('/a/../b')).toBeNull();
    expect(normalizeProjectRoot('/a\0b')).toBeNull();
    expect(normalizeProjectRoot('')).toBeNull();
    expect(normalizeProjectRoot(1 as unknown)).toBeNull();
    for (const denied of ['/proc', '/sys', '/dev', '/etc', '/boot', '/run']) {
      expect(normalizeProjectRoot(denied)).toBeNull();
      expect(normalizeProjectRoot(`${denied}/nested`)).toBeNull();
    }
    // Lookalikes that only share characters are fine.
    expect(normalizeProjectRoot('/etcetera')).toBe('/etcetera');
    expect(normalizeProjectRoot('/devops')).toBe('/devops');
  });

  it('exposes the legacy default agent roots', () => {
    expect(DEFAULT_AGENT_ROOTS).toEqual(['/var/www']);
  });
});

describe('backups: adapters', () => {
  it('exposes exactly one adapter per DB type via matchAdapter', () => {
    expect(matchAdapter('postgres:16')?.type).toBe('postgres');
    expect(matchAdapter('mysql:8')?.type).toBe('mysql');
    expect(matchAdapter('mariadb:11')?.type).toBe('mariadb');
    expect(matchAdapter('mongo:7')?.type).toBe('mongo');
    expect(matchAdapter('redis:7')?.type).toBe('redis');
    expect(matchAdapter('valkey/valkey:8')?.type).toBe('valkey');
    expect(matchAdapter('nouchka/sqlite3')?.type).toBe('sqlite');
    expect(matchAdapter('clickhouse/clickhouse-server:24')?.type).toBe('clickhouse');
    expect(matchAdapter('elasticsearch:8.13.0')?.type).toBe('elasticsearch');
    expect(matchAdapter('opensearchproject/opensearch:2')?.type).toBe('elasticsearch');
    expect(matchAdapter('rabbitmq:3.13-management')?.type).toBe('rabbitmq');
    expect(matchAdapter('minio/minio:latest')?.type).toBe('minio');
    expect(matchAdapter('influxdb:2.7')?.type).toBe('influxdb');
    expect(matchAdapter('neo4j:5')?.type).toBe('neo4j');
    expect(matchAdapter('node:20')).toBeUndefined();
    expect(matchAdapter('')).toBeUndefined();
    expect(matchAdapter(undefined)).toBeUndefined();
    expect(matchAdapter(null)).toBeUndefined();
  });

  it('returns argv arrays, never shell strings', () => {
    const svc = { environment: { POSTGRES_USER: 'app' } };
    const pg = postgresAdapter.dumpCmd(svc);
    expect(Array.isArray(pg)).toBe(true);
    // --clean --if-exists so a restore replay truly overwrites (see restore-plan).
    expect(pg).toEqual(['pg_dumpall', '--clean', '--if-exists', '-U', 'app']);
    expect(postgresAdapter.dumpCmd({})).toEqual([
      'pg_dumpall',
      '--clean',
      '--if-exists',
      '-U',
      'postgres',
    ]);

    // mysql/mariadb: the password NEVER rides argv (a bare `-p` prompts on the
    // non-tty exec); it travels via MYSQL_PWD in dumpEnv.
    const MYSQL_ARGV = [
      'mysqldump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
    ];
    expect(mysqlAdapter.dumpCmd({ environment: ['MYSQL_ROOT_PASSWORD=s3cret'] })).toEqual(
      MYSQL_ARGV,
    );
    expect(mysqlAdapter.dumpEnv?.({ environment: ['MYSQL_ROOT_PASSWORD=s3cret'] })).toEqual([
      'MYSQL_PWD=s3cret',
    ]);
    expect(mysqlAdapter.dumpCmd({})).toEqual(MYSQL_ARGV);
    expect(mysqlAdapter.dumpEnv?.({})).toEqual([]);

    const MARIADB_ARGV = [
      'mariadb-dump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
    ];
    expect(mariadbAdapter.dumpCmd({ environment: { MARIADB_ROOT_PASSWORD: 'mm' } })).toEqual(
      MARIADB_ARGV,
    );
    // prefers MARIADB_ROOT_PASSWORD, falls back to the legacy MYSQL_ROOT_PASSWORD key.
    expect(mariadbAdapter.dumpEnv?.({ environment: { MARIADB_ROOT_PASSWORD: 'mm' } })).toEqual([
      'MYSQL_PWD=mm',
    ]);
    expect(mariadbAdapter.dumpEnv?.({ environment: { MYSQL_ROOT_PASSWORD: 'm' } })).toEqual([
      'MYSQL_PWD=m',
    ]);
    expect(mariadbAdapter.dumpCmd({})).toEqual(MARIADB_ARGV);
    expect(mariadbAdapter.dumpEnv?.({})).toEqual([]);

    expect(mongoAdapter.dumpCmd({})).toEqual(['mongodump', '--archive', '--oplog']);
    // mongo root creds ride argv inside the container when present.
    expect(
      mongoAdapter.dumpCmd({
        environment: {
          MONGO_INITDB_ROOT_USERNAME: 'root',
          MONGO_INITDB_ROOT_PASSWORD: 'pw',
        },
      }),
    ).toEqual([
      'mongodump',
      '--archive',
      '--oplog',
      '-u',
      'root',
      '-p',
      'pw',
      '--authenticationDatabase',
      'admin',
    ]);
  });

  it('file-artifact adapters expose mode + artifactType + artifact path + argv commands', () => {
    const fileAdapters: Array<{
      a: (typeof redisAdapter);
      dump: string[];
      artifact: string;
      kind: 'file' | 'directory';
    }> = [
      { a: redisAdapter, dump: ['redis-cli', 'SAVE'], artifact: '/data/dump.rdb', kind: 'file' },
      { a: valkeyAdapter, dump: ['valkey-cli', 'SAVE'], artifact: '/data/dump.rdb', kind: 'file' },
      {
        a: sqliteAdapter,
        dump: ['sqlite3', '/data/app.db', '.backup /backup/app-backup.db'],
        artifact: '/backup/app-backup.db',
        kind: 'file',
      },
      {
        a: clickhouseAdapter,
        dump: [
          'clickhouse-client',
          '--query',
          "BACKUP DATABASE default TO Disk('backups', 'snapshot')",
        ],
        artifact: '/var/lib/clickhouse/backups/snapshot',
        kind: 'directory',
      },
      {
        a: elasticsearchAdapter,
        dump: [
          'curl',
          '-fsS',
          '-X',
          'PUT',
          'http://localhost:9200/_snapshot/dockstash/snapshot?wait_for_completion=true',
        ],
        artifact: '/usr/share/elasticsearch/snapshots',
        kind: 'directory',
      },
      {
        a: rabbitmqAdapter,
        dump: ['rabbitmqctl', 'export_definitions', '/tmp/definitions.json'],
        artifact: '/tmp/definitions.json',
        kind: 'file',
      },
      {
        a: minioAdapter,
        dump: ['mc', 'mirror', '--overwrite', 'local', '/backup/minio'],
        artifact: '/backup/minio',
        kind: 'directory',
      },
      {
        a: influxdbAdapter,
        dump: ['influx', 'backup', '/backup/influx'],
        artifact: '/backup/influx',
        kind: 'directory',
      },
      {
        a: neo4jAdapter,
        dump: ['neo4j-admin', 'database', 'dump', 'neo4j', '--to-path=/backup'],
        artifact: '/backup/neo4j.dump',
        kind: 'file',
      },
    ];
    for (const { a, dump, artifact, kind } of fileAdapters) {
      expect(a.mode).toBe('file');
      expect(a.artifactType).toBe(kind);
      expect(a.dumpCmd({})).toEqual(dump);
      expect(a.dumpArtifactPath({})).toBe(artifact);
      // dumpCmd is always an argv array (never a shell string)
      expect(a.dumpCmd({}).every((tok) => typeof tok === 'string' && !tok.includes('\0'))).toBe(
        true,
      );
    }
    // stdin adapters have no artifact path (discriminated union enforces this)
    expect(postgresAdapter.mode).toBe('stdin');
  });

  it('match matrix covers positive/negative per adapter', () => {
    const cases: Array<[string, string[]]> = [
      ['postgres:16', ['postgres']],
      ['mariadb:11', ['mariadb']],
      ['mysql:8', ['mysql']],
      ['mongo:7', ['mongo']],
      ['redis:7', ['redis']],
      ['valkey/valkey:8', ['valkey']],
      ['nouchka/sqlite3', ['sqlite']],
      ['clickhouse/clickhouse-server:24', ['clickhouse']],
      ['elasticsearch:8.13.0', ['elasticsearch']],
      ['rabbitmq:3.13-management', ['rabbitmq']],
      ['minio/minio:latest', ['minio']],
      ['influxdb:2.7', ['influxdb']],
      ['neo4j:5', ['neo4j']],
      ['node:20', []],
    ];
    for (const [img, expected] of cases) {
      const matched = ADAPTER_REGISTRY.filter((a) => a.match(img)).map((a) => a.type);
      expect(matched).toEqual(expected);
    }
    // exactly 13 adapters, one per DatabaseType
    expect(ADAPTER_REGISTRY).toHaveLength(13);
  });

  it('readServiceEnv handles array, object, and missing forms', () => {
    expect(readServiceEnv({ environment: { A: 'B' } }, 'A')).toBe('B');
    expect(readServiceEnv({ environment: ['A=B', 'C=D'] }, 'C')).toBe('D');
    expect(readServiceEnv({ environment: ['badentry'] }, 'X')).toBeUndefined();
    expect(readServiceEnv({}, 'X')).toBeUndefined();
    expect(
      readServiceEnv({ environment: [42 as unknown as string] }, 'X'),
    ).toBeUndefined();
    expect(readServiceEnv({ environment: { A: 1 as unknown as string } }, 'A')).toBeUndefined();
  });
});

describe('backups: serialize optional fields', () => {
  const base = {
    _id: { toString: () => 'pid' },
    owner: { toString: () => 'oid' },
    name: 'n',
    path: '/var/www/n',
    plan: { paths: ['/var/www/n'], databases: [], configs: [] },
    lastStatus: 'success',
    lastError: '',
    createdAt: new Date('2027-01-01T00:00:00Z'),
    updatedAt: new Date('2027-01-01T00:00:00Z'),
  };

  it('renders the truthy/defined branch of every optional date, status, and detail field', () => {
    const at = new Date('2027-03-03T00:00:00Z');
    const full = serializeProject({
      ...base,
      lastRunAt: at,
      lastCheckAt: at,
      lastCheckStatus: 'pass',
      lastCheckDetail: 'checked ok',
      lastDrillAt: at,
      lastDrillStatus: 'fail',
      lastDrillDetail: 'drill detail',
    } as unknown as ProjectHydrated);
    expect(full.lastRunAt).toBe('2027-03-03T00:00:00.000Z');
    expect(full.lastCheckAt).toBe('2027-03-03T00:00:00.000Z');
    expect(full.lastCheckStatus).toBe('pass');
    expect(full.lastCheckDetail).toBe('checked ok');
    expect(full.lastDrillAt).toBe('2027-03-03T00:00:00.000Z');
    expect(full.lastDrillStatus).toBe('fail');
    expect(full.lastDrillDetail).toBe('drill detail');
  });

  it('renders the null/empty branch when every optional field is absent', () => {
    const empty = serializeProject(base as unknown as ProjectHydrated);
    expect(empty.lastRunAt).toBeNull();
    expect(empty.lastCheckAt).toBeNull();
    expect(empty.lastCheckStatus).toBeNull();
    expect(empty.lastCheckDetail).toBe('');
    expect(empty.lastDrillAt).toBeNull();
    expect(empty.lastDrillStatus).toBeNull();
    expect(empty.lastDrillDetail).toBe('');
  });
});

describe('backups: injection guard', () => {
  it('a metacharacter password stays out of argv and rides MYSQL_PWD (inert env value)', () => {
    const evil = '$(rm -rf /);`whoami`';
    const argv = mysqlAdapter.dumpCmd({ environment: { MYSQL_ROOT_PASSWORD: evil } });
    // The password is NOT in argv at all — no shell, and no argv token to split.
    expect(argv.some((tok) => tok.includes('rm -rf'))).toBe(false);
    expect(argv).not.toContain('-p');
    expect(argv.every((tok) => typeof tok === 'string')).toBe(true);
    expect(argv.some((tok) => tok === 'sh' || tok === '-c')).toBe(false);
    // It travels via env, where it is a literal value no shell ever interprets.
    expect(mysqlAdapter.dumpEnv?.({ environment: { MYSQL_ROOT_PASSWORD: evil } })).toEqual([
      `MYSQL_PWD=${evil}`,
    ]);
  });
});

describe('backups: adapter credential matrix', () => {
  it('postgres does NOT match pooler/API sidecars named like postgres', () => {
    expect(postgresAdapter.match('postgrest/postgrest:v12')).toBe(false);
    expect(postgresAdapter.match('mycorp/postgres-pgbouncer')).toBe(false);
    expect(postgresAdapter.match('postgres:15-alpine')).toBe(true);
    expect(matchAdapter('postgrest/postgrest')).toBeUndefined();
  });

  it('mongo offers an --oplog-dropped fallback only for oplog/replica-set failures', () => {
    expect(
      mongoAdapter.fallbackDumpCmd?.({}, 'error: --oplog mode only works on replica sets'),
    ).toEqual(['mongodump', '--archive']);
    expect(mongoAdapter.fallbackDumpCmd?.({}, 'Authentication failed')).toBeNull();
  });

  it('redis: REDISCLI_AUTH from REDIS_PASSWORD env, else --requirepass in Cmd', () => {
    expect(redisAdapter.dumpEnv?.({ environment: ['REDIS_PASSWORD=pw'] })).toEqual([
      'REDISCLI_AUTH=pw',
    ]);
    expect(
      redisAdapter.dumpEnv?.({ command: ['redis-server', '--requirepass', 'cmdpw'] }),
    ).toEqual(['REDISCLI_AUTH=cmdpw']);
    expect(redisAdapter.dumpEnv?.({})).toEqual([]);
  });

  it('valkey: ships VALKEYCLI_AUTH + REDISCLI_AUTH; reads --requirepass from Cmd', () => {
    expect(valkeyAdapter.dumpEnv?.({ environment: ['VALKEY_PASSWORD=vp'] })).toEqual([
      'VALKEYCLI_AUTH=vp',
      'REDISCLI_AUTH=vp',
    ]);
    expect(
      valkeyAdapter.dumpEnv?.({ command: ['valkey-server', '--requirepass', 'vc'] }),
    ).toEqual(['VALKEYCLI_AUTH=vc', 'REDISCLI_AUTH=vc']);
    expect(valkeyAdapter.dumpEnv?.({})).toEqual([]);
  });

  it('verifyDump throws unless SAVE replied OK (redis-cli exits 0 even on NOAUTH)', () => {
    expect(() => redisAdapter.verifyDump?.({ exitCode: 0, stdout: 'OK', stderr: '' })).not.toThrow();
    expect(() =>
      redisAdapter.verifyDump?.({ exitCode: 0, stdout: 'NOAUTH Authentication required.', stderr: '' }),
    ).toThrow(/redis-cli SAVE did not return OK: NOAUTH/);
    expect(() =>
      valkeyAdapter.verifyDump?.({ exitCode: 0, stdout: '', stderr: 'boom' }),
    ).toThrow(/valkey-cli SAVE did not return OK: boom/);
    expect(() =>
      redisAdapter.verifyDump?.({ exitCode: 0, stdout: '', stderr: '' }),
    ).toThrow(/redis-cli SAVE did not return OK: empty reply/);
  });
});

describe('backups: scanProject', () => {
  const fixtures: Record<string, string> = {
    postgres: [
      'services:',
      '  db:',
      '    image: postgres:16',
      '    environment:',
      '      POSTGRES_USER: appuser',
      '  api:',
      '    image: node:20',
    ].join('\n'),
    multiDb: [
      'services:',
      '  pg:',
      '    image: postgres:16',
      '  my:',
      '    image: mariadb:11',
      '  mo:',
      '    image: mongo:7',
    ].join('\n'),
    mongoTraefik: [
      'services:',
      '  db:',
      '    image: mongo:7',
      '    container_name: my-mongo',
      '  proxy:',
      '    image: traefik:v2',
    ].join('\n'),
    nginx: [
      'services:',
      '  proxy:',
      '    image: nginx:1',
    ].join('\n'),
    noDb: [
      'services:',
      '  api:',
      '    image: node:20',
    ].join('\n'),
    empty: 'services: {}',
    invalidMapping: '- 1\n- 2',
    unknownImage: [
      'services:',
      '  weird:',
      '    image: acme/weird:1',
    ].join('\n'),
  };

  const reader = (path: string) => {
    const key = path.replace('/var/www/', '').replace('/docker-compose.yml', '');
    const raw = fixtures[key];
    if (raw === undefined) return Promise.reject(new Error('ENOENT'));
    return Promise.resolve(raw);
  };

  it('detects a single postgres service', async () => {
    const plan = await scanProject('/var/www/postgres', { readFile: reader });
    expect(plan.paths).toEqual(['/var/www/postgres']);
    expect(plan.databases).toHaveLength(1);
    expect(plan.databases[0]).toMatchObject({
      service: 'db',
      type: 'postgres',
      enabled: true,
    });
    expect(plan.configs).toEqual([]);
  });

  it('detects multi-db plans', async () => {
    const plan = await scanProject('/var/www/multiDb', { readFile: reader });
    const types = plan.databases.map((d) => d.type).sort();
    expect(types).toEqual(['mariadb', 'mongo', 'postgres']);
  });

  it('detects mongo + traefik config path and honours container_name', async () => {
    const plan = await scanProject('/var/www/mongoTraefik', { readFile: reader });
    expect(plan.databases[0]?.container).toBe('my-mongo');
    expect(plan.configs).toContain('/etc/traefik');
  });

  it('detects nginx proxy path', async () => {
    const plan = await scanProject('/var/www/nginx', { readFile: reader });
    expect(plan.configs).toContain('/etc/nginx');
  });

  it('handles no-db and empty compose', async () => {
    const noDb = await scanProject('/var/www/noDb', { readFile: reader });
    expect(noDb.databases).toEqual([]);
    const empty = await scanProject('/var/www/empty', { readFile: reader });
    expect(empty.databases).toEqual([]);
    expect(empty.configs).toEqual([]);
  });

  it('skips services with an unknown image', async () => {
    const plan = await scanProject('/var/www/unknownImage', { readFile: reader });
    expect(plan.databases).toEqual([]);
  });

  it('rejects missing docker-compose.yml', async () => {
    await expect(scanProject('/var/www/missing', { readFile: reader })).rejects.toThrow(
      /not found/,
    );
  });

  it('rejects non-mapping compose', async () => {
    await expect(
      scanProject('/var/www/invalidMapping', { readFile: reader }),
    ).rejects.toThrow(/not a valid mapping/);
  });

  it('falls back to compose.yaml when docker-compose.yml is absent', async () => {
    const only = 'services:\n  db:\n    image: postgres:16';
    const composeYamlReader = (p: string) =>
      p === '/var/www/alt/compose.yaml'
        ? Promise.resolve(only)
        : Promise.reject(new Error('ENOENT'));
    const plan = await scanProject('/var/www/alt', { readFile: composeYamlReader });
    expect(plan.databases[0]?.type).toBe('postgres');
  });

  it('prefers docker-compose.yml over later candidates', async () => {
    const seen: string[] = [];
    const bothReader = (p: string) => {
      seen.push(p);
      return Promise.resolve('services:\n  db:\n    image: mysql:8');
    };
    await scanProject('/var/www/pref', { readFile: bothReader });
    // The first candidate resolves, so no later filename is ever read.
    expect(seen).toEqual(['/var/www/pref/docker-compose.yml']);
  });

  it('uses the default file reader when none is injected (missing file rejects)', async () => {
    await expect(scanProject('/nope/does/not/exist')).rejects.toThrow();
  });

  it('detectProxyConfigs handles neither image', () => {
    expect(detectProxyConfigs({})).toEqual([]);
    expect(detectProxyConfigs({ services: { x: { image: 'node' } } })).toEqual([]);
  });

  it('resolveContainerName sanitizes segments', () => {
    expect(resolveContainerName('/var/www/My-App', 'db')).toBe('myapp_db_1');
    expect(resolveContainerName('/', 'db')).toBe('project_db_1');
  });
});

describe('backups: service + persistence', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('applies the plan default factory when plan is omitted', async () => {
    const { id } = await seedUser('factory@test.com');
    const project = await Project.create({
      owner: id,
      name: 'no-plan',
      path: '/var/www/np',
      repoPasswordEnc: { ciphertext: 'x', iv: 'y', authTag: 'z', keyVersion: 1 },
    });
    expect(project.plan.paths).toEqual([]);
    expect(project.plan.databases).toEqual([]);
    expect(project.plan.configs).toEqual([]);
  });

  it('createProject rejects a bad path defensively', async () => {
    const { id } = await seedUser('a@test.com');
    await expect(
      createProject(id, {
        name: 'x',
        path: '/etc/evil',
        repoPassword: 'password1',
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('createProject encrypts the repo password and never exposes plaintext', async () => {
    const { id } = await seedUser('a@test.com');
    const project = await createProject(id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'sup3r-s3cret',
    });
    expect(project.repoPasswordEnc.ciphertext).not.toContain('sup3r-s3cret');
    const serialized = serializeProject(project) as unknown as Record<string, unknown>;
    expect(Object.keys(serialized)).not.toContain('repoPasswordEnc');
    expect(JSON.stringify(serialized)).not.toContain('sup3r-s3cret');
  });

  it('loadOwnedProject cloaks existence for cross-user access (404, not 403)', async () => {
    // Surface #2 / S2-01: owner-scoped resources return 404 both for missing
    // rows AND for foreign-owner rows, so an attacker iterating ObjectIds
    // cannot enumerate every tenant's projects by status-code oracle.
    const a = await seedUser('a@test.com');
    const b = await seedUser('b@test.com');
    const p = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    await expect(loadOwnedProject(p._id.toString(), b.id)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('loadOwnedProject 404s for a non-ObjectId (never a CastError 500)', async () => {
    const a = await seedUser('a@test.com');
    await expect(
      loadOwnedProject('not-an-object-id', a.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('loadOwnedProject 404s when not found', async () => {
    const a = await seedUser('a@test.com');
    await expect(
      loadOwnedProject('507f1f77bcf86cd799439011', a.id),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('updateProjectPlan validates path allowlist', async () => {
    const a = await seedUser('a@test.com');
    const p = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    await expect(
      updateProjectPlan(p._id.toString(), a.id, {
        paths: ['/etc/x'],
        databases: [],
        configs: [],
      }),
    ).rejects.toMatchObject({ status: 400 });

    // configs share the restic argv with paths, so they are held to the same
    // /var/www allowlist — an out-of-tree config must be rejected too.
    await expect(
      updateProjectPlan(p._id.toString(), a.id, {
        paths: ['/var/www/p'],
        databases: [],
        configs: ['/etc/traefik'],
      }),
    ).rejects.toMatchObject({ status: 400 });

    const updated = await updateProjectPlan(p._id.toString(), a.id, {
      paths: ['/var/www/p'],
      databases: [
        { service: 'db', type: 'postgres', container: 'p_db_1', enabled: true },
      ],
      configs: ['/var/www/p/docker-compose.yml'],
    });
    expect(updated.plan.databases).toHaveLength(1);
  });

  it('listProjectsForUser returns only the caller’s projects', async () => {
    const a = await seedUser('a@test.com');
    const b = await seedUser('b@test.com');
    await createProject(a.id, {
      name: 'pa',
      path: '/var/www/pa',
      repoPassword: 'password1',
    });
    await createProject(b.id, {
      name: 'pb',
      path: '/var/www/pb',
      repoPassword: 'password1',
    });
    const forA = await listProjectsForUser(a.id);
    expect(forA).toHaveLength(1);
    expect(forA[0]?.name).toBe('pa');
  });

  it('scanProjectPath surfaces a localized error on scanner failure', async () => {
    await expect(
      scanProjectPath('/var/www/anything', {
        scanner: async () => {
          throw new Error('boom');
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('scanProjectPath rejects a bad path before touching the scanner', async () => {
    const scanner = vi.fn();
    await expect(
      scanProjectPath('/etc/x', { scanner: scanner as unknown as typeof scanProject }),
    ).rejects.toMatchObject({ status: 400 });
    expect(scanner).not.toHaveBeenCalled();
  });
});

describe('backups: runBackup orchestration', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  async function seedProject(): Promise<{ userId: string; projectId: string }> {
    const a = await seedUser('a@test.com');
    const p = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    p.plan = {
      paths: ['/var/www/p'],
      databases: [
        { service: 'pg', type: 'postgres', container: 'p_pg_1', enabled: true },
        { service: 'disabled', type: 'postgres', container: 'x', enabled: false },
      ],
      configs: ['/var/www/p/traefik.yml'],
    } as typeof p.plan;
    await p.save();
    return { userId: a.id, projectId: p._id.toString() };
  }

  it('streams dump → restic --stdin and then backs up paths+configs', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    // The dump credential (POSTGRES_USER) now comes from the container inspect,
    // exactly as it does in production (was composeServices).
    docker.inspectEnv = ['POSTGRES_USER=app'];
    const result = await runBackup(projectId, userId, {
      resticRunner: restic,
      dockerClient: docker,
    });
    expect(result.status).toBe('success');
    expect(docker.calls[0]).toMatchObject({
      container: 'p_pg_1',
      argv: ['pg_dumpall', '--clean', '--if-exists', '-U', 'app'],
    });
    // no `sh -c` — argv-only
    expect(docker.calls[0]?.argv).not.toContain('sh');
    expect(restic.calls[0]?.args).toEqual([
      'backup',
      '--stdin',
      '--stdin-filename',
      'pg.dump',
      '--tag',
      'db:pg:postgres',
    ]);
    expect(restic.calls[0]?.hasStdin).toBe(true);
    expect(restic.calls[1]?.args).toEqual([
      'backup',
      '/var/www/p',
      '/var/www/p/traefik.yml',
    ]);
    expect(restic.calls[1]?.hasStdin).toBe(false);
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('success');
  });

  it('file-mode adapter: dumps, then streams the artifact OUT via cat into restic --stdin', async () => {
    const { userId, projectId } = await seedProject();
    const p = await Project.findById(projectId);
    if (p) {
      p.plan.databases = [
        { service: 'cache', type: 'redis', container: 'p_cache_1', enabled: true },
      ] as typeof p.plan.databases;
      await p.save();
    }
    const { restic, docker } = makeMocks();
    const result = await runBackup(projectId, userId, {
      resticRunner: restic,
      dockerClient: docker,
    });
    expect(result.status).toBe('success');
    // Two execs: the SAVE dump, then cat of the produced artifact.
    expect(docker.calls[0]).toMatchObject({ container: 'p_cache_1', argv: ['redis-cli', 'SAVE'] });
    expect(docker.calls[1]).toMatchObject({ container: 'p_cache_1', argv: ['cat', '/data/dump.rdb'] });
    // restic gets the artifact via --stdin, NOT a bare in-container path.
    expect(restic.calls[0]?.args).toEqual([
      'backup',
      '--stdin',
      '--stdin-filename',
      'cache-dump.rdb',
      '--tag',
      'db:cache:redis',
    ]);
    expect(restic.calls[0]?.hasStdin).toBe(true);
    // Regression: the bare in-container path only exists inside the container,
    // so `restic backup /data/dump.rdb` fails "does not exist" (the prod bug).
    expect(restic.calls.some((c) => c.args.includes('/data/dump.rdb'))).toBe(false);
    // then the paths+configs layer
    expect(restic.calls[1]?.args).toEqual(['backup', '/var/www/p', '/var/www/p/traefik.yml']);
  });

  it('file-mode directory adapter: streams a tar of the artifact dir into restic --stdin', async () => {
    const { userId, projectId } = await seedProject();
    const p = await Project.findById(projectId);
    if (p) {
      p.plan.paths = [];
      p.plan.configs = [];
      p.plan.databases = [
        { service: 'objects', type: 'minio', container: 'p_minio_1', enabled: true },
      ] as typeof p.plan.databases;
      await p.save();
    }
    const { restic, docker } = makeMocks();
    const result = await runBackup(projectId, userId, {
      resticRunner: restic,
      dockerClient: docker,
    });
    expect(result.status).toBe('success');
    expect(docker.calls[1]).toMatchObject({
      container: 'p_minio_1',
      argv: ['tar', '-cf', '-', '-C', '/backup/minio', '.'],
    });
    expect(restic.calls[0]?.args).toEqual([
      'backup',
      '--stdin',
      '--stdin-filename',
      'objects.tar',
      '--tag',
      'db:objects:minio',
    ]);
    expect(restic.calls[0]?.hasStdin).toBe(true);
  });

  it('file-mode adapter: a dump stream error fails the run before restic', async () => {
    const { userId, projectId } = await seedProject();
    const p = await Project.findById(projectId);
    if (p) {
      p.plan.databases = [
        { service: 'cache', type: 'redis', container: 'p_cache_1', enabled: true },
      ] as typeof p.plan.databases;
      await p.save();
    }
    const { restic } = makeMocks();
    const docker: DockerClient = {
      async exec(): Promise<never> {
        throw new Error('exec not stubbed');
      },
      async execStream(): Promise<never> {
        throw new Error('execStream not stubbed');
      },
      // File-mode dump runs via execCollect; a rejection here fails the layer
      // before the artifact is ever read.
      async execCollect() {
        throw new Error('stream boom');
      },
      async execWithStdin(): Promise<never> {
        throw new Error('execWithStdin not stubbed');
      },
      async restart(): Promise<never> {
        throw new Error('restart not stubbed');
      },
      async inspect() {
        return { id: '', running: true, env: [], cmd: [], image: '' };
      },
      async listContainers() {
        return [];
      },
    };
    await expect(
      runBackup(projectId, userId, {
        resticRunner: restic,
        dockerClient: docker,
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(persisted?.lastError).toMatch(/stream boom/);
    // restic never ran because the dump errored first
    expect(restic.calls).toHaveLength(0);
  });

  it('marks failed when the DB dump layer errors and stops before paths', async () => {
    const { userId, projectId } = await seedProject();
    const { restic } = makeMocks();
    const docker: DockerClient = {
      async exec(): Promise<never> {
        throw new Error('exec not stubbed');
      },
      async execStream() {
        throw new Error('docker down');
      },
      async execCollect(): Promise<never> {
        throw new Error('execCollect not stubbed');
      },
      async execWithStdin(): Promise<never> {
        throw new Error('execWithStdin not stubbed');
      },
      async restart(): Promise<never> {
        throw new Error('restart not stubbed');
      },
      async inspect(container) {
        return { id: container, running: true, env: [], cmd: [], image: '' };
      },
      async listContainers() {
        return [];
      },
    };
    await expect(
      runBackup(projectId, userId, {
        resticRunner: restic,
        dockerClient: docker,
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(restic.calls).toHaveLength(0);
  });

  it('marks failed when the target DB container is not running', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    docker.inspectRunning = false;
    await expect(
      runBackup(projectId, userId, {
        resticRunner: restic,
        dockerClient: docker,
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    // The identity translator returns the key; production resolves it per-locale.
    expect(persisted?.lastError).toMatch(/containerNotRunning/);
    expect(restic.calls).toHaveLength(0);
  });

  // Swap the enabled DB layer's engine for a focused failure-branch test.
  async function useDbLayer(
    projectId: string,
    layer: { service: string; type: string; container: string },
  ): Promise<void> {
    const p = await Project.findById(projectId);
    if (!p) throw new Error('missing project');
    p.plan.paths = [];
    p.plan.configs = [];
    p.plan.databases = [{ ...layer, enabled: true }] as typeof p.plan.databases;
    await p.save();
  }

  it('surfaces the dump exit code + real stderr (not restic\'s "no data read")', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    docker.onExecStream = () => ({
      stdout: '',
      exitCode: 1,
      stderrTail: 'pg_dumpall: error: FATAL: role "postgres" does not exist',
    });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/dumpFailed/); // key (identity t); exact text proven agent-side
  });

  it('partial-dump guard: restic succeeds but the dump exited non-zero → still fails', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks(); // restic resolves
    docker.onExecStream = () => ({ stdout: 'partial', exitCode: 2, stderrTail: 'killed' });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('a non-fallback dump failure with empty stderr falls back to "no stderr"', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    docker.onExecStream = () => ({ exitCode: 5, stderrTail: '' });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/dumpFailed/);
  });

  it('a non-Error throw from the dump exec surfaces via String(err)', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.onExecCollect = () => {
      // Non-Error throw on purpose: pins the String(err) fallback branch.
      throw 'collect-blew-up';
    };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/collect-blew-up/);
  });

  it('an Error throw from the artifact-read exec surfaces its message', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.onExecStream = () => {
      throw new Error('exec stream down');
    };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/artifact read failed for cache: exec stream down/);
  });

  it('a non-Error throw from the artifact-read exec surfaces via String(err)', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.onExecStream = () => {
      // Non-Error throw on purpose: pins the String(err) fallback branch.
      throw 'stream-blew-up';
    };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/stream-blew-up/);
  });

  it('mongo: appends root creds from inspect env and keeps --oplog when it works', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'mongo', type: 'mongo', container: 'm_1' });
    const { restic, docker } = makeMocks();
    docker.inspectEnv = [
      'MONGO_INITDB_ROOT_USERNAME=root',
      'MONGO_INITDB_ROOT_PASSWORD=s3cret',
    ];
    const res = await runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker });
    expect(res.status).toBe('success');
    expect(docker.calls[0]?.argv).toEqual([
      'mongodump',
      '--archive',
      '--oplog',
      '-u',
      'root',
      '-p',
      's3cret',
      '--authenticationDatabase',
      'admin',
    ]);
  });

  it('mongo: retries without --oplog once on a standalone server', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'mongo', type: 'mongo', container: 'm_1' });
    const { restic, docker } = makeMocks();
    docker.onExecStream = (argv) =>
      argv.includes('--oplog')
        ? { exitCode: 1, stderrTail: '--oplog mode only works on replica sets' }
        : { exitCode: 0 };
    const res = await runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker });
    expect(res.status).toBe('success');
    expect(docker.calls.map((c) => c.argv)).toEqual([
      ['mongodump', '--archive', '--oplog'],
      ['mongodump', '--archive'],
    ]);
  });

  it('mongo: a retry that also fails surfaces the retry exit (+ "no stderr" fallback)', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'mongo', type: 'mongo', container: 'm_1' });
    const { restic, docker } = makeMocks();
    docker.onExecStream = (argv) =>
      argv.includes('--oplog')
        ? { exitCode: 1, stderrTail: 'only works on replica sets' }
        : { exitCode: 4, stderrTail: '' };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/dumpFailed/);
  });

  it('mongo: does NOT retry when the failure is unrelated to --oplog', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'mongo', type: 'mongo', container: 'm_1' });
    const { restic, docker } = makeMocks();
    docker.onExecStream = () => ({ exitCode: 1, stderrTail: 'Authentication failed' });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    expect(docker.calls).toHaveLength(1); // no retry
  });

  it('mongo: a restic failure after a successful --oplog-dropped retry surfaces the restic error', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'mongo', type: 'mongo', container: 'm_1' });
    const { docker } = makeMocks();
    docker.onExecStream = (argv) =>
      argv.includes('--oplog') ? { exitCode: 1, stderrTail: 'replica sets' } : { exitCode: 0 };
    const restic: ResticRunner = {
      async init() {},
      async backup(_a, opts) {
        if (opts?.stdin) opts.stdin.resume();
        throw new Error('network down');
      },
      async snapshots() {
        return [];
      },
      async snapshotsDetailed() {
        return [];
      },
      async check() {},
      async restore() {},
      async dump(): Promise<never> {
        throw new Error('dump not stubbed');
      },
    };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/restic dump failed: network down/);
  });

  it('redis: forwards REDISCLI_AUTH via exec env and never puts it in argv', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.inspectEnv = ['REDIS_PASSWORD=hunter2'];
    const res = await runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker });
    expect(res.status).toBe('success');
    const save = docker.calls.find((c) => c.argv.includes('SAVE'));
    expect(save?.env).toEqual(['REDISCLI_AUTH=hunter2']);
    expect(save?.argv).toEqual(['redis-cli', 'SAVE']);
  });

  it('redis: a non-OK SAVE reply fails the layer (NOAUTH → never a stale backup)', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.onExecCollect = () => ({ exitCode: 0, stdout: 'NOAUTH Authentication required.' });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/SAVE did not return OK: NOAUTH/);
    expect(restic.calls).toHaveLength(0);
  });

  it('file-mode: a non-zero dump exit fails before the artifact read (+ "no stderr")', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.onExecCollect = () => ({ exitCode: 1, stdout: '', stderr: '' });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/dumpFailed/);
    // Only the SAVE ran — the cat artifact-read never fired.
    expect(docker.calls).toHaveLength(1);
  });

  it('file-mode: a non-zero artifact-read exit fails the layer (+ "no stderr")', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic, docker } = makeMocks();
    docker.onExecStream = () => ({ exitCode: 1, stderrTail: '' });
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/artifact read failed.*exit 1.*no stderr/);
  });

  it('file-mode: a restic failure on the artifact stream surfaces "restic dump failed"', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { docker } = makeMocks();
    const restic: ResticRunner = {
      async init() {},
      async backup(_a, opts) {
        if (opts?.stdin) opts.stdin.resume();
        throw new Error('repo locked');
      },
      async snapshots() {
        return [];
      },
      async snapshotsDetailed() {
        return [];
      },
      async check() {},
      async restore() {},
      async dump(): Promise<never> {
        throw new Error('dump not stubbed');
      },
    };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/restic dump failed: repo locked/);
  });

  it('file-mode: wraps a non-Error artifact-read setup rejection', async () => {
    const { userId, projectId } = await seedProject();
    await useDbLayer(projectId, { service: 'cache', type: 'redis', container: 'c_1' });
    const { restic } = makeMocks();
    const base = makeMocks().docker;
    const docker: DockerClient = {
      ...base,
      async execCollect() {
        return { exitCode: 0, stdout: 'OK', stderr: '' };
      },
      async execStream(): Promise<never> {
        throw 'raw cat failure';
      },
    };
    await expect(
      runBackup(projectId, userId, { resticRunner: restic, dockerClient: docker }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastError).toMatch(/artifact read failed for cache: raw cat failure/);
  });

  it('marks failed when the paths layer errors after a successful DB layer', async () => {
    const { userId, projectId } = await seedProject();
    const { docker } = makeMocks();
    let call = 0;
    const restic: ResticRunner = {
      async init() {},
      async backup(args, opts) {
        call += 1;
        if (opts?.stdin) opts.stdin.resume();
        if (call === 2) throw new Error('restic path fail');
      },
      async snapshots() {
        return [];
      },
      async snapshotsDetailed() {
        return [];
      },
      async check() {},
      async restore() {},
      async dump(): Promise<never> {
        throw new Error('dump not stubbed');
      },
    };
    await expect(
      runBackup(projectId, userId, {
        resticRunner: restic,
        dockerClient: docker,
      }),
    ).rejects.toMatchObject({ status: 500 });
    const persisted = await Project.findById(projectId);
    expect(persisted?.lastStatus).toBe('failed');
    expect(persisted?.lastError).toMatch(/restic path fail/);
  });

  it('bubbles a localized error when no adapter matches the inspected image', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    // The plan says type "postgres" but the running image is unrecognized —
    // the inspected image wins and matches nothing.
    docker.inspectImage = 'unknown';
    await expect(
      runBackup(projectId, userId, {
        resticRunner: restic,
        dockerClient: docker,
      }),
    ).rejects.toMatchObject({ status: 500 });
  });

  it('honours the disk-space probe and never touches docker/restic when low', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    await expect(
      runBackup(projectId, userId, {
        resticRunner: restic,
        dockerClient: docker,
        diskProbe: { freeBytes: async () => 1 },
        minFreeBytes: 1_000_000,
      }),
    ).rejects.toMatchObject({ status: 500 });
    expect(docker.calls).toHaveLength(0);
    expect(restic.calls).toHaveLength(0);
  });

  it('accepts the disk-space probe when free space is above the threshold', async () => {
    const { userId, projectId } = await seedProject();
    const { restic, docker } = makeMocks();
    const result = await runBackup(projectId, userId, {
      resticRunner: restic,
      dockerClient: docker,
      diskProbe: { freeBytes: async () => 10 ** 12 },
    });
    expect(result.status).toBe('success');
  });

  it('refuses to run when the caller does not own the project (404 cloaks existence)', async () => {
    const { projectId } = await seedProject();
    const stranger = await seedUser('c@test.com');
    const { restic, docker } = makeMocks();
    await expect(
      runBackup(projectId, stranger.id, {
        resticRunner: restic,
        dockerClient: docker,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('emits argv (never a shell string) and keeps a metacharacter password out of argv', async () => {
    const { userId, projectId } = await seedProject();
    // switch the enabled DB layer to mysql so we exercise the MYSQL_ROOT_PASSWORD path
    const p = await Project.findById(projectId);
    if (p) {
      p.plan.databases = [
        { service: 'my', type: 'mysql', container: 'my_1', enabled: true },
      ] as typeof p.plan.databases;
      await p.save();
    }
    const { restic, docker } = makeMocks();
    docker.inspectImage = 'mysql:8';
    docker.inspectEnv = ['MYSQL_ROOT_PASSWORD=$(rm -rf /);`id`'];
    const result = await runBackup(projectId, userId, {
      resticRunner: restic,
      dockerClient: docker,
    });
    expect(result.status).toBe('success');
    const call = docker.calls[0];
    const argv = call?.argv ?? [];
    expect(Array.isArray(argv)).toBe(true);
    expect(argv).toContain('mysqldump');
    expect(argv).not.toContain('sh');
    expect(argv).not.toContain('-c');
    // The password NEVER rides argv — it travels via MYSQL_PWD in the exec env,
    // where it is an inert env value (no shell ever interprets it).
    expect(argv.some((a) => a.includes('rm -rf'))).toBe(false);
    expect(argv).not.toContain('-p');
    expect(call?.env).toEqual(['MYSQL_PWD=$(rm -rf /);`id`']);
  });
});

describe('backups: HTTP routes (ownership + auth)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('requires auth on every route', async () => {
    const paths: Array<[string, string]> = [
      ['post', '/api/backups/scan'],
      ['post', '/api/backups'],
      ['get', '/api/backups'],
      ['get', '/api/backups/x'],
      ['patch', '/api/backups/x/plan'],
    ];
    const agent = request(app) as unknown as Record<string, (p: string) => request.Test>;
    for (const [method, url] of paths) {
      const fn = agent[method];
      if (!fn) throw new Error(`unknown method ${method}`);
      const res = await fn.call(agent, url);
      expect(res.status).toBe(401);
    }
  });

  it('POST /api/backups creates a project (repoPassword never echoed)', async () => {
    const { token } = await seedUser('a@test.com');
    const res = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({
        name: 'demo',
        path: '/var/www/demo',
        repoPassword: 'super-secret-pw',
      });
    expect(res.status).toBe(201);
    expect(res.body.project).toMatchObject({ name: 'demo', path: '/var/www/demo' });
    expect(JSON.stringify(res.body)).not.toContain('super-secret-pw');
  });

  it('rejects invalid path at the zod layer', async () => {
    const { token } = await seedUser('a@test.com');
    const res = await request(app)
      .post('/api/backups')
      .set('Authorization', `JWT ${token}`)
      .send({ name: 'x', path: '/etc/passwd', repoPassword: 'password1' });
    expect(res.status).toBe(400);
  });

  it('GET /:id cloaks existence for another user (404 not 403)', async () => {
    // Surface #2 / S2-01 — non-owned and non-existent must be indistinguishable.
    const a = await seedUser('a@test.com');
    const b = await seedUser('b@test.com');
    const created = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    const res = await request(app)
      .get(`/api/backups/${created._id.toString()}`)
      .set('Authorization', `JWT ${b.token}`);
    expect(res.status).toBe(404);

    // And a genuinely missing id returns the SAME 404 — no oracle.
    const missing = await request(app)
      .get(`/api/backups/507f1f77bcf86cd799439011`)
      .set('Authorization', `JWT ${b.token}`);
    expect(missing.status).toBe(404);
  });

  it('GET /:id returns the project to its owner', async () => {
    const a = await seedUser('a@test.com');
    const created = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    const res = await request(app)
      .get(`/api/backups/${created._id.toString()}`)
      .set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(created._id.toString());
  });

  it('GET / lists only the caller’s projects', async () => {
    const a = await seedUser('a@test.com');
    const b = await seedUser('b@test.com');
    await createProject(a.id, { name: 'pa', path: '/var/www/pa', repoPassword: 'password1' });
    await createProject(b.id, { name: 'pb', path: '/var/www/pb', repoPassword: 'password1' });
    const res = await request(app).get('/api/backups').set('Authorization', `JWT ${a.token}`);
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('pa');
  });

  it('PATCH /:id/plan updates the plan and returns it', async () => {
    const a = await seedUser('a@test.com');
    const created = await createProject(a.id, {
      name: 'p',
      path: '/var/www/p',
      repoPassword: 'password1',
    });
    const res = await request(app)
      .patch(`/api/backups/${created._id.toString()}/plan`)
      .set('Authorization', `JWT ${a.token}`)
      .send({
        plan: {
          paths: ['/var/www/p'],
          databases: [{ service: 'db', type: 'postgres', container: 'p_db_1' }],
          configs: ['/var/www/p/traefik.yml'],
        },
      });
    expect(res.status).toBe(200);
    expect(res.body.project.plan.databases).toHaveLength(1);
  });

  it('POST /scan surfaces a 400 when the compose file is missing', async () => {
    const { token } = await seedUser('a@test.com');
    const res = await request(app)
      .post('/api/backups/scan')
      .set('Authorization', `JWT ${token}`)
      .send({ path: '/var/www/nope-does-not-exist-really' });
    expect(res.status).toBe(400);
  });
});

describe('backups: i18n key parity', () => {
  it('every locale exposes the same backups.* keys and placeholders', () => {
    const result = verifyKeyParity();
    expect(result.ok).toBe(true);
  });
});
