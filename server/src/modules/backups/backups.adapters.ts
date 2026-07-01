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

export interface Adapter {
  readonly type: DatabaseType;
  match(image: string): boolean;
  dumpCmd(svc: ComposeService): string[];
  restoreCmd(svc: ComposeService): string[];
}

/**
 * Every adapter returns an **argument array**, never a shell string. The
 * orchestration layer feeds these arrays directly to `dockerode.exec` (which
 * accepts an argv array — no shell parsing). This is the command-injection
 * guard from IDEA.md §1: even a compose env value like `$(rm -rf /)` becomes
 * a literal argv token — the shell never sees it.
 */
export const postgresAdapter: Adapter = {
  type: 'postgres',
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

export const mysqlAdapter: Adapter = {
  type: 'mysql',
  match: (image) => /mysql/i.test(image) && !/mariadb/i.test(image),
  dumpCmd: (svc) => {
    const pw = readServiceEnv(svc, 'MYSQL_ROOT_PASSWORD') ?? '';
    return [
      'mysqldump',
      '--single-transaction',
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

export const mariadbAdapter: Adapter = {
  type: 'mariadb',
  match: (image) => /mariadb/i.test(image),
  dumpCmd: (svc) => {
    const pw = readServiceEnv(svc, 'MYSQL_ROOT_PASSWORD') ?? '';
    return [
      'mysqldump',
      '--single-transaction',
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

export const mongoAdapter: Adapter = {
  type: 'mongo',
  match: (image) => /mongo/i.test(image),
  dumpCmd: () => ['mongodump', '--archive', '--oplog'],
  restoreCmd: () => ['mongorestore', '--archive', '--oplog', '--drop'],
};

/** Order matters: mariadb before mysql so a `mariadb:*` image reports `mariadb`. */
export const ADAPTER_REGISTRY: readonly Adapter[] = [
  postgresAdapter,
  mariadbAdapter,
  mysqlAdapter,
  mongoAdapter,
];

export function matchAdapter(image: string | undefined | null): Adapter | undefined {
  if (typeof image !== 'string' || image.length === 0) return undefined;
  for (const adapter of ADAPTER_REGISTRY) {
    if (adapter.match(image)) return adapter;
  }
  return undefined;
}
