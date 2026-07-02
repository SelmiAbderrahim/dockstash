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

describe('readServiceEnvAny (via mariadbAdapter)', () => {
  it('prefers MARIADB_ROOT_PASSWORD', () => {
    expect(
      mariadbAdapter.dumpCmd({ environment: { MARIADB_ROOT_PASSWORD: 'mm' } }),
    ).toEqual([
      'mariadb-dump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      '-pmm',
    ]);
  });

  it('falls back to the legacy MYSQL_ROOT_PASSWORD key', () => {
    const legacy = { environment: { MYSQL_ROOT_PASSWORD: 'm' } };
    expect(mariadbAdapter.dumpCmd(legacy)).toEqual([
      'mariadb-dump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      '-pm',
    ]);
    expect(mariadbAdapter.restoreCmd(legacy)).toEqual(['mariadb', '-uroot', '-pm']);
  });

  it('falls back to an empty password when neither key is present', () => {
    expect(mariadbAdapter.dumpCmd({})).toEqual([
      'mariadb-dump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      '-p',
    ]);
    expect(mariadbAdapter.restoreCmd({})).toEqual(['mariadb', '-uroot', '-p']);
  });
});

describe('postgresAdapter', () => {
  it('uses the configured POSTGRES_USER, defaulting to postgres', () => {
    expect(postgresAdapter.dumpCmd({ environment: { POSTGRES_USER: 'app' } })).toEqual([
      'pg_dumpall',
      '-U',
      'app',
    ]);
    expect(postgresAdapter.restoreCmd({ environment: { POSTGRES_USER: 'app' } })).toEqual([
      'psql',
      '-U',
      'app',
    ]);
    expect(postgresAdapter.dumpCmd({})).toEqual(['pg_dumpall', '-U', 'postgres']);
    expect(postgresAdapter.restoreCmd({})).toEqual(['psql', '-U', 'postgres']);
  });
});

describe('mysqlAdapter', () => {
  it('reads MYSQL_ROOT_PASSWORD, defaulting to empty', () => {
    expect(mysqlAdapter.dumpCmd({ environment: ['MYSQL_ROOT_PASSWORD=s3cret'] })).toEqual([
      'mysqldump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      '-ps3cret',
    ]);
    expect(mysqlAdapter.restoreCmd({ environment: ['MYSQL_ROOT_PASSWORD=s3cret'] })).toEqual([
      'mysql',
      '-uroot',
      '-ps3cret',
    ]);
    expect(mysqlAdapter.dumpCmd({})).toEqual([
      'mysqldump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      '-p',
    ]);
    expect(mysqlAdapter.restoreCmd({})).toEqual(['mysql', '-uroot', '-p']);
  });
});

describe('mongoAdapter', () => {
  it('dumps and restores via mongodump/mongorestore', () => {
    expect(mongoAdapter.dumpCmd({})).toEqual(['mongodump', '--archive', '--oplog']);
    expect(mongoAdapter.restoreCmd({})).toEqual([
      'mongorestore',
      '--archive',
      '--oplogReplay',
      '--drop',
    ]);
  });
});

describe('file-artifact adapters', () => {
  const fileAdapters: Array<{ a: FileAdapter; dump: string[]; artifact: string }> = [
    { a: redisAdapter, dump: ['redis-cli', 'SAVE'], artifact: '/data/dump.rdb' },
    { a: valkeyAdapter, dump: ['valkey-cli', 'SAVE'], artifact: '/data/dump.rdb' },
    {
      a: sqliteAdapter,
      dump: ['sqlite3', '/data/app.db', '.backup /backup/app-backup.db'],
      artifact: '/backup/app-backup.db',
    },
    {
      a: clickhouseAdapter,
      dump: [
        'clickhouse-client',
        '--query',
        "BACKUP DATABASE default TO Disk('backups', 'snapshot')",
      ],
      artifact: '/var/lib/clickhouse/backups/snapshot',
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
    },
    {
      a: rabbitmqAdapter,
      dump: ['rabbitmqctl', 'export_definitions', '/tmp/definitions.json'],
      artifact: '/tmp/definitions.json',
    },
    {
      a: minioAdapter,
      dump: ['mc', 'mirror', '--overwrite', 'local', '/backup/minio'],
      artifact: '/backup/minio',
    },
    {
      a: influxdbAdapter,
      dump: ['influx', 'backup', '/backup/influx'],
      artifact: '/backup/influx',
    },
    {
      a: neo4jAdapter,
      dump: ['neo4j-admin', 'database', 'dump', 'neo4j', '--to-path=/backup'],
      artifact: '/backup/neo4j.dump',
    },
  ];

  it('expose mode "file" + artifact path + argv-array commands', () => {
    for (const { a, dump, artifact } of fileAdapters) {
      expect(a.mode).toBe('file');
      expect(a.dumpCmd({})).toEqual(dump);
      expect(a.dumpArtifactPath({})).toBe(artifact);
      const restore = a.restoreCmd({});
      expect(Array.isArray(restore)).toBe(true);
      expect(restore.every((tok) => typeof tok === 'string' && !tok.includes('\0'))).toBe(true);
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
  it('contains exactly one adapter per DatabaseType, each with a working match/dumpCmd/restoreCmd', () => {
    expect(ADAPTER_REGISTRY).toHaveLength(13);
    const seen = new Set<string>();
    for (const adapter of ADAPTER_REGISTRY) {
      expect(seen.has(adapter.type)).toBe(false);
      seen.add(adapter.type);
      expect(typeof adapter.match('some-image:tag')).toBe('boolean');
      expect(Array.isArray(adapter.dumpCmd({}))).toBe(true);
      expect(Array.isArray(adapter.restoreCmd({}))).toBe(true);
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
