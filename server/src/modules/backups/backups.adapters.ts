import type { DatabaseType } from './backups.model.js';

/**
 * A compose service, narrowed to the fields the adapters actually read.
 * `environment` may be either an array (`FOO=bar`) or a keyed object.
 */
export interface ComposeService {
  image?: string;
  container_name?: string;
  environment?: Record<string, string> | string[];
}

export function readServiceEnv(svc: ComposeService, key: string): string | undefined {
  const env = svc.environment;
  if (!env) return undefined;
  if (Array.isArray(env)) {
    for (const entry of env) {
      if (typeof entry !== 'string') continue;
      const idx = entry.indexOf('=');
      if (idx < 0) continue;
      if (entry.slice(0, idx) === key) return entry.slice(idx + 1);
    }
    return undefined;
  }
  const value = env[key];
  return typeof value === 'string' ? value : undefined;
}

/** First defined env value among `keys`, else `fallback`. */
function readServiceEnvAny(
  svc: ComposeService,
  keys: string[],
  fallback: string,
): string {
  for (const key of keys) {
    const v = readServiceEnv(svc, key);
    if (typeof v === 'string') return v;
  }
  return fallback;
}

/**
 * How an adapter's dump reaches restic:
 *  - `'stdin'`: `dumpCmd` writes the dump to stdout; the orchestrator streams it
 *    straight into `restic backup --stdin` (never buffered to disk).
 *  - `'file'`: `dumpCmd` produces an artifact (file or directory) inside the
 *    container at `dumpArtifactPath`; the orchestrator restic-backs-up that path
 *    after the command exits. Used by engines that cannot dump to stdout
 *    consistently (RDB snapshots, snapshot-API stores, mirror/export tools).
 */
export type AdapterMode = 'stdin' | 'file';

interface AdapterBase {
  readonly type: DatabaseType;
  match(image: string): boolean;
  dumpCmd(svc: ComposeService): string[];
  restoreCmd(svc: ComposeService): string[];
}

/** Dump streams to stdout → piped straight into `restic backup --stdin`. */
export interface StdinAdapter extends AdapterBase {
  readonly mode: 'stdin';
}

/**
 * Dump produces an artifact at `dumpArtifactPath` INSIDE the container. restic
 * runs host-side, so it cannot read that path directly — the orchestrator
 * streams the artifact out with a second `docker exec` (`cat` for a file,
 * `tar` for a directory) into `restic backup --stdin`. `artifactType` tells it
 * which reader to use.
 */
export interface FileAdapter extends AdapterBase {
  readonly mode: 'file';
  readonly artifactType: 'file' | 'directory';
  dumpArtifactPath(svc: ComposeService): string;
}

/**
 * Discriminated on `mode`: narrowing to `mode: 'file'` guarantees
 * `dumpArtifactPath` exists, so the orchestrator needs no runtime null-check.
 */
export type Adapter = StdinAdapter | FileAdapter;

/**
 * Every adapter returns an **argument array**, never a shell string. The
 * orchestration layer feeds these arrays directly to `dockerode.exec` (which
 * accepts an argv array — no shell parsing). This is the command-injection
 * guard from IDEA.md §1: even a compose env value like `$(rm -rf /)` becomes
 * a literal argv token — the shell never sees it. Tokens may themselves
 * contain spaces (e.g. a ClickHouse `--query` SQL statement); that is safe
 * precisely because there is no shell to re-split them.
 */
export const postgresAdapter: StdinAdapter = {
  type: 'postgres',
  mode: 'stdin',
  match: (image) => /postgres/i.test(image),
  dumpCmd: (svc) => {
    const user = readServiceEnv(svc, 'POSTGRES_USER') ?? 'postgres';
    return ['pg_dumpall', '-U', user];
  },
  restoreCmd: (svc) => {
    const user = readServiceEnv(svc, 'POSTGRES_USER') ?? 'postgres';
    return ['psql', '-U', user];
  },
};

export const mysqlAdapter: StdinAdapter = {
  type: 'mysql',
  mode: 'stdin',
  match: (image) => /mysql/i.test(image) && !/mariadb/i.test(image),
  // --routines --triggers so stored procedures and triggers are included — a
  // default mysqldump silently drops them, a common "restored but broken" bug.
  dumpCmd: (svc) => {
    const pw = readServiceEnv(svc, 'MYSQL_ROOT_PASSWORD') ?? '';
    return [
      'mysqldump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      `-p${pw}`,
    ];
  },
  restoreCmd: (svc) => {
    const pw = readServiceEnv(svc, 'MYSQL_ROOT_PASSWORD') ?? '';
    return ['mysql', '-uroot', `-p${pw}`];
  },
};

export const mariadbAdapter: StdinAdapter = {
  type: 'mariadb',
  mode: 'stdin',
  match: (image) => /mariadb/i.test(image),
  // Recent MariaDB images ship `mariadb-dump` (mysqldump is a compat symlink);
  // accept either MARIADB_ROOT_PASSWORD or the legacy MYSQL_ROOT_PASSWORD key.
  dumpCmd: (svc) => {
    const pw = readServiceEnvAny(
      svc,
      ['MARIADB_ROOT_PASSWORD', 'MYSQL_ROOT_PASSWORD'],
      '',
    );
    return [
      'mariadb-dump',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--all-databases',
      '-uroot',
      `-p${pw}`,
    ];
  },
  restoreCmd: (svc) => {
    const pw = readServiceEnvAny(
      svc,
      ['MARIADB_ROOT_PASSWORD', 'MYSQL_ROOT_PASSWORD'],
      '',
    );
    return ['mariadb', '-uroot', `-p${pw}`];
  },
};

export const mongoAdapter: StdinAdapter = {
  type: 'mongo',
  mode: 'stdin',
  match: (image) => /mongo/i.test(image),
  dumpCmd: () => ['mongodump', '--archive', '--oplog'],
  // Restore replays the captured oplog — the flag is `--oplogReplay`, not
  // `--oplog` (which is dump-only), so the snapshot is point-in-time consistent.
  restoreCmd: () => ['mongorestore', '--archive', '--oplogReplay', '--drop'],
};

// ── File-artifact adapters ────────────────────────────────────────────────
// These engines cannot stream a consistent dump to stdout. Each produces an
// artifact inside the container at `dumpArtifactPath`, which the orchestrator
// restic-backs-up once the command exits.

export const redisAdapter: FileAdapter = {
  type: 'redis',
  mode: 'file',
  artifactType: 'file',
  match: (image) => /redis/i.test(image),
  // SAVE forks a synchronous point-in-time RDB to /data/dump.rdb; we back up
  // the finished file, never the live in-memory state.
  dumpCmd: () => ['redis-cli', 'SAVE'],
  dumpArtifactPath: () => '/data/dump.rdb',
  // Restore is file-placement: stop without overwriting the placed RDB, then
  // the container reloads it on next start.
  restoreCmd: () => ['redis-cli', 'SHUTDOWN', 'NOSAVE'],
};

export const valkeyAdapter: FileAdapter = {
  type: 'valkey',
  mode: 'file',
  artifactType: 'file',
  match: (image) => /valkey/i.test(image),
  dumpCmd: () => ['valkey-cli', 'SAVE'],
  dumpArtifactPath: () => '/data/dump.rdb',
  restoreCmd: () => ['valkey-cli', 'SHUTDOWN', 'NOSAVE'],
};

export const sqliteAdapter: FileAdapter = {
  type: 'sqlite',
  mode: 'file',
  artifactType: 'file',
  match: (image) => /sqlite/i.test(image),
  // The .backup dot-command uses SQLite's online backup API (WAL-safe) to
  // produce a consistent copy while the app keeps writing.
  dumpCmd: () => ['sqlite3', '/data/app.db', '.backup /backup/app-backup.db'],
  dumpArtifactPath: () => '/backup/app-backup.db',
  restoreCmd: () => ['sqlite3', '/data/app.db', '.restore /backup/app-backup.db'],
};

export const clickhouseAdapter: FileAdapter = {
  type: 'clickhouse',
  mode: 'file',
  artifactType: 'directory',
  match: (image) => /clickhouse/i.test(image),
  // Native BACKUP statement snapshots table parts consistently to a backup disk.
  dumpCmd: () => [
    'clickhouse-client',
    '--query',
    "BACKUP DATABASE default TO Disk('backups', 'snapshot')",
  ],
  dumpArtifactPath: () => '/var/lib/clickhouse/backups/snapshot',
  restoreCmd: () => [
    'clickhouse-client',
    '--query',
    "RESTORE DATABASE default FROM Disk('backups', 'snapshot')",
  ],
};

export const elasticsearchAdapter: FileAdapter = {
  type: 'elasticsearch',
  mode: 'file',
  artifactType: 'directory',
  match: (image) => /elasticsearch|opensearch/i.test(image),
  // Snapshot API writes a consistent, incremental snapshot into the registered
  // filesystem repository; we restic that repo directory.
  dumpCmd: () => [
    'curl',
    '-fsS',
    '-X',
    'PUT',
    'http://localhost:9200/_snapshot/dockstash/snapshot?wait_for_completion=true',
  ],
  dumpArtifactPath: () => '/usr/share/elasticsearch/snapshots',
  restoreCmd: () => [
    'curl',
    '-fsS',
    '-X',
    'POST',
    'http://localhost:9200/_snapshot/dockstash/snapshot/_restore',
  ],
};

export const rabbitmqAdapter: FileAdapter = {
  type: 'rabbitmq',
  mode: 'file',
  artifactType: 'file',
  match: (image) => /rabbitmq/i.test(image),
  // Broker definitions (vhosts, exchanges, queues, bindings, users, policies)
  // export cleanly as JSON — the durable, restorable part of RabbitMQ.
  dumpCmd: () => ['rabbitmqctl', 'export_definitions', '/tmp/definitions.json'],
  dumpArtifactPath: () => '/tmp/definitions.json',
  restoreCmd: () => ['rabbitmqctl', 'import_definitions', '/tmp/definitions.json'],
};

export const minioAdapter: FileAdapter = {
  type: 'minio',
  mode: 'file',
  artifactType: 'directory',
  match: (image) => /minio/i.test(image),
  // mc mirror copies objects through the S3 API (each object atomically),
  // preserving metadata — safer than a raw /data copy.
  dumpCmd: () => ['mc', 'mirror', '--overwrite', 'local', '/backup/minio'],
  dumpArtifactPath: () => '/backup/minio',
  restoreCmd: () => ['mc', 'mirror', '--overwrite', '/backup/minio', 'local'],
};

export const influxdbAdapter: FileAdapter = {
  type: 'influxdb',
  mode: 'file',
  artifactType: 'directory',
  match: (image) => /influxdb/i.test(image),
  // `influx backup` snapshots TSM shards + metadata consistently through the
  // engine (v2 HTTP API). v1 uses `influxd backup -portable` (see the guide).
  dumpCmd: () => ['influx', 'backup', '/backup/influx'],
  dumpArtifactPath: () => '/backup/influx',
  restoreCmd: () => ['influx', 'restore', '/backup/influx'],
};

export const neo4jAdapter: FileAdapter = {
  type: 'neo4j',
  mode: 'file',
  artifactType: 'file',
  match: (image) => /neo4j/i.test(image),
  // neo4j-admin dump is a consistent offline dump of the database store.
  dumpCmd: () => [
    'neo4j-admin',
    'database',
    'dump',
    'neo4j',
    '--to-path=/backup',
  ],
  dumpArtifactPath: () => '/backup/neo4j.dump',
  restoreCmd: () => [
    'neo4j-admin',
    'database',
    'load',
    'neo4j',
    '--from-path=/backup',
    '--overwrite-destination=true',
  ],
};

/**
 * Order matters: more specific matchers precede generic ones.
 *  - `mariadb` before `mysql` so a `mariadb:*` image reports `mariadb`.
 *  - `valkey` before `redis` (a `valkey/valkey` image never matches `/redis/i`,
 *    but keep the intent explicit).
 */
export const ADAPTER_REGISTRY: readonly Adapter[] = [
  postgresAdapter,
  mariadbAdapter,
  mysqlAdapter,
  mongoAdapter,
  valkeyAdapter,
  redisAdapter,
  sqliteAdapter,
  clickhouseAdapter,
  elasticsearchAdapter,
  rabbitmqAdapter,
  minioAdapter,
  influxdbAdapter,
  neo4jAdapter,
];

export function matchAdapter(image: string | undefined | null): Adapter | undefined {
  if (typeof image !== 'string' || image.length === 0) return undefined;
  for (const adapter of ADAPTER_REGISTRY) {
    if (adapter.match(image)) return adapter;
  }
  return undefined;
}
