import { describe, expect, it } from 'vitest';
import {
  ADAPTER_REGISTRY,
  clickhouseAdapter,
  elasticsearchAdapter,
  influxdbAdapter,
  mariadbAdapter,
  matchAdapter,
  minioAdapter,
  mongoAdapter,
  mysqlAdapter,
  neo4jAdapter,
  postgresAdapter,
  rabbitmqAdapter,
  readServiceEnv,
  redisAdapter,
  sqliteAdapter,
  valkeyAdapter,
  type FileAdapter,
} from './adapters.js';

describe('readServiceEnv', () => {
  it('array form: finds a matching KEY=VALUE entry', () => {
    expect(readServiceEnv({ environment: ['A=B', 'C=D'] }, 'C')).toBe('D');
  });

  it('array form: skips non-string entries', () => {
    expect(readServiceEnv({ environment: [42 as unknown as string] }, 'X')).toBeUndefined();
  });

  it('array form: ignores entries without an "="', () => {
    expect(readServiceEnv({ environment: ['badentry'] }, 'X')).toBeUndefined();
  });

  it('array form: returns undefined when no entry matches the key', () => {
    expect(readServiceEnv({ environment: ['A=B'] }, 'X')).toBeUndefined();
  });

  it('object form: returns a matching string value', () => {
    expect(readServiceEnv({ environment: { A: 'B' } }, 'A')).toBe('B');
  });

  it('object form: returns undefined for a non-string value', () => {
    expect(readServiceEnv({ environment: { A: 1 as unknown as string } }, 'A')).toBeUndefined();
  });

  it('returns undefined when environment is absent', () => {
    expect(readServiceEnv({}, 'X')).toBeUndefined();
  });
});

const MARIADB_ARGV = [
  'mariadb-dump',
  '--single-transaction',
  '--routines',
  '--triggers',
  '--all-databases',
  '-uroot',
];
const MYSQL_ARGV = [
  'mysqldump',
  '--single-transaction',
  '--routines',
  '--triggers',
  '--all-databases',
  '-uroot',
];

describe('mariadbAdapter password (via MYSQL_PWD env, never argv)', () => {
  it('argv carries no password token in any case', () => {
    expect(mariadbAdapter.dumpCmd({ environment: { MARIADB_ROOT_PASSWORD: 'mm' } })).toEqual(
      MARIADB_ARGV,
    );
    expect(mariadbAdapter.dumpCmd({})).toEqual(MARIADB_ARGV);
  });

  it('prefers MARIADB_ROOT_PASSWORD, falls back to legacy MYSQL_ROOT_PASSWORD', () => {
    expect(mariadbAdapter.dumpEnv?.({ environment: { MARIADB_ROOT_PASSWORD: 'mm' } })).toEqual([
      'MYSQL_PWD=mm',
    ]);
    expect(mariadbAdapter.dumpEnv?.({ environment: { MYSQL_ROOT_PASSWORD: 'm' } })).toEqual([
      'MYSQL_PWD=m',
    ]);
  });

  it('emits no env when neither password key is present (no bare -p prompt)', () => {
    expect(mariadbAdapter.dumpEnv?.({})).toEqual([]);
  });
});

describe('postgresAdapter', () => {
  it('uses the configured POSTGRES_USER, defaulting to postgres', () => {
    expect(postgresAdapter.dumpCmd({ environment: { POSTGRES_USER: 'app' } })).toEqual([
      'pg_dumpall',
      '--clean',
      '--if-exists',
      '-U',
      'app',
    ]);
    expect(postgresAdapter.dumpCmd({})).toEqual([
      'pg_dumpall',
      '--clean',
      '--if-exists',
      '-U',
      'postgres',
    ]);
  });

  it('does NOT match pooler/API sidecars whose image name contains "postgres"', () => {
    expect(postgresAdapter.match('postgrest/postgrest:v12')).toBe(false);
    expect(postgresAdapter.match('mycorp/postgres-pgbouncer')).toBe(false);
    expect(postgresAdapter.match('postgres:15-alpine')).toBe(true);
  });
});

describe('mysqlAdapter password (via MYSQL_PWD env, never argv)', () => {
  it('argv carries no password token; env carries MYSQL_PWD when set', () => {
    expect(mysqlAdapter.dumpCmd({ environment: ['MYSQL_ROOT_PASSWORD=s3cret'] })).toEqual(
      MYSQL_ARGV,
    );
    expect(mysqlAdapter.dumpEnv?.({ environment: ['MYSQL_ROOT_PASSWORD=s3cret'] })).toEqual([
      'MYSQL_PWD=s3cret',
    ]);
    expect(mysqlAdapter.dumpCmd({})).toEqual(MYSQL_ARGV);
    expect(mysqlAdapter.dumpEnv?.({})).toEqual([]);
  });
});

describe('mongoAdapter', () => {
  it('dumps via mongodump --archive --oplog when no root creds are set', () => {
    expect(mongoAdapter.dumpCmd({})).toEqual(['mongodump', '--archive', '--oplog']);
  });

  it('appends root credentials from MONGO_INITDB_ROOT_* env', () => {
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

  it('offers an --oplog-dropped fallback only for oplog/replica-set failures', () => {
    const dropped = mongoAdapter.fallbackDumpCmd?.({}, 'error: --oplog mode only works on replica sets');
    expect(dropped).toEqual(['mongodump', '--archive']);
    expect(mongoAdapter.fallbackDumpCmd?.({}, 'Authentication failed')).toBeNull();
  });
});

describe('redis/valkey credentials + SAVE verification', () => {
  it('redis: REDISCLI_AUTH from REDIS_PASSWORD env, else --requirepass in Cmd', () => {
    expect(redisAdapter.dumpEnv?.({ environment: ['REDIS_PASSWORD=pw'] })).toEqual([
      'REDISCLI_AUTH=pw',
    ]);
    expect(
      redisAdapter.dumpEnv?.({ command: ['redis-server', '--requirepass', 'cmdpw'] }),
    ).toEqual(['REDISCLI_AUTH=cmdpw']);
    expect(redisAdapter.dumpEnv?.({})).toEqual([]);
  });

  it('valkey: ships both VALKEYCLI_AUTH and REDISCLI_AUTH', () => {
    expect(valkeyAdapter.dumpEnv?.({ environment: ['VALKEY_PASSWORD=vp'] })).toEqual([
      'VALKEYCLI_AUTH=vp',
      'REDISCLI_AUTH=vp',
    ]);
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
    // Neither stdout nor stderr → the "empty reply" fallback.
    expect(() =>
      redisAdapter.verifyDump?.({ exitCode: 0, stdout: '', stderr: '' }),
    ).toThrow(/redis-cli SAVE did not return OK: empty reply/);
  });

  it('valkey: reads --requirepass from Cmd when no env password is set', () => {
    expect(
      valkeyAdapter.dumpEnv?.({ command: ['valkey-server', '--requirepass', 'vp'] }),
    ).toEqual(['VALKEYCLI_AUTH=vp', 'REDISCLI_AUTH=vp']);
  });
});

describe('file-artifact adapters', () => {
  const fileAdapters: Array<{
    a: FileAdapter;
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

  it('expose mode "file" + artifactType + artifact path + argv-array commands', () => {
    for (const { a, dump, artifact, kind } of fileAdapters) {
      expect(a.mode).toBe('file');
      expect(a.artifactType).toBe(kind);
      expect(a.dumpCmd({})).toEqual(dump);
      expect(a.dumpArtifactPath({})).toBe(artifact);
    }
  });

  it('stdin adapters are never file adapters', () => {
    expect(postgresAdapter.mode).toBe('stdin');
    expect(mysqlAdapter.mode).toBe('stdin');
    expect(mariadbAdapter.mode).toBe('stdin');
    expect(mongoAdapter.mode).toBe('stdin');
  });
});

describe('ADAPTER_REGISTRY', () => {
  it('contains exactly one adapter per DatabaseType, each with a working match/dumpCmd', () => {
    expect(ADAPTER_REGISTRY).toHaveLength(13);
    const seen = new Set<string>();
    for (const adapter of ADAPTER_REGISTRY) {
      expect(seen.has(adapter.type)).toBe(false);
      seen.add(adapter.type);
      expect(typeof adapter.match('some-image:tag')).toBe('boolean');
      const dump = adapter.dumpCmd({});
      expect(Array.isArray(dump)).toBe(true);
      expect(dump.every((tok) => typeof tok === 'string' && !tok.includes('\0'))).toBe(true);
      if (adapter.mode === 'file') {
        expect(typeof adapter.dumpArtifactPath({})).toBe('string');
      }
    }
  });

  it('match matrix covers positive/negative cases per adapter', () => {
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
      ['opensearchproject/opensearch:2', ['elasticsearch']],
      ['rabbitmq:3.13-management', ['rabbitmq']],
      ['minio/minio:latest', ['minio']],
      ['influxdb:2.7', ['influxdb']],
      ['neo4j:5', ['neo4j']],
      ['node:20', []],
      // pooler/API sidecars whose name resembles postgres must match nothing.
      ['postgrest/postgrest:v12', []],
      ['mycorp/postgres-pgbouncer', []],
    ];
    for (const [img, expected] of cases) {
      const matched = ADAPTER_REGISTRY.filter((a) => a.match(img)).map((a) => a.type);
      expect(matched).toEqual(expected);
    }
  });

  it('places mariadb ahead of mysql so mariadb images never fall through', () => {
    const mariadbIndex = ADAPTER_REGISTRY.indexOf(mariadbAdapter);
    const mysqlIndex = ADAPTER_REGISTRY.indexOf(mysqlAdapter);
    expect(mariadbIndex).toBeLessThan(mysqlIndex);
    expect(matchAdapter('mariadb:11')?.type).toBe('mariadb');
  });
});

describe('matchAdapter', () => {
  it('returns undefined for undefined, null, and empty-string images', () => {
    expect(matchAdapter(undefined)).toBeUndefined();
    expect(matchAdapter(null)).toBeUndefined();
    expect(matchAdapter('')).toBeUndefined();
  });

  it('returns undefined when no adapter matches', () => {
    expect(matchAdapter('node:20')).toBeUndefined();
  });

  it('returns the matching adapter', () => {
    expect(matchAdapter('postgres:16')?.type).toBe('postgres');
    expect(matchAdapter('redis:7')?.type).toBe('redis');
  });
});
