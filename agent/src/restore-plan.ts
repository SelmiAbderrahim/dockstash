// Vendored from server/src/modules/backups/backups.restore-plan.ts — keep in sync manually.
// Per-engine database restore planning + orchestration.
//
// Backups store DB dumps as single stdin artifacts in the restic snapshot
// (`/<service>.dump` for stdin engines, `/<service>-<basename>` for file
// engines — see artifactReadPlan in backup.ts). Restoring one is NOT
// a filesystem restore: the dump must be streamed back INTO the database
// container (`restic dump … | docker exec -i …`), with per-engine sequencing.
import path from 'node:path';
import { Readable } from 'node:stream';
import {
  matchAdapter,
  readServiceEnv,
  type ComposeService,
} from './adapters.js';

export interface PlanDatabase {
  service: string;
  type: string;
  container: string;
  enabled: boolean;
}

export type SnapshotClass =
  | { kind: 'paths' }
  | { kind: 'db'; db: PlanDatabase; artifactPath: string };

/** Tag stamped on DB-layer backups: `db:<service>:<type>`. */
export const DB_SNAPSHOT_TAG_RE = /^db:([^:]+):(.+)$/;

export function dbSnapshotTag(service: string, type: string): string {
  return `db:${service}:${type}`;
}

/**
 * The root-level artifact filename a backup of `db` produces in its snapshot,
 * derived from the adapter registry (mirrors artifactReadPlan). `null` when no
 * adapter matches the plan's type.
 */
export function expectedArtifactName(db: PlanDatabase): string | null {
  const adapter = matchAdapter(db.type);
  if (!adapter) return null;
  if (adapter.mode === 'stdin') return `${db.service}.dump`;
  if (adapter.artifactType === 'directory') return `${db.service}.tar`;
  const artifactPath = adapter.dumpArtifactPath({ image: db.type });
  return `${db.service}-${path.posix.basename(artifactPath)}`;
}

/**
 * Decide whether a snapshot is a plain filesystem snapshot or a DB dump
 * artifact belonging to one of the project's plan databases.
 *
 * Priority: (1) a `db:<service>:<type>` tag naming a known plan service
 * (stamped on new backups); (2) heuristic for pre-tag snapshots — exactly one
 * root-level path equal to the artifact name the adapter registry predicts.
 */
export function classifySnapshot(
  snapshot: { paths?: string[]; tags?: string[] },
  databases: readonly PlanDatabase[],
): SnapshotClass {
  for (const tag of snapshot.tags ?? []) {
    const m = DB_SNAPSHOT_TAG_RE.exec(tag);
    if (!m) continue;
    const db = databases.find((d) => d.service === m[1]);
    if (db) {
      const name = expectedArtifactName(db);
      if (name) return { kind: 'db', db, artifactPath: `/${name}` };
    }
  }
  const paths = snapshot.paths ?? [];
  if (paths.length === 1 && /^\/[^/]+$/.test(paths[0] as string)) {
    const name = (paths[0] as string).slice(1);
    for (const db of databases) {
      if (expectedArtifactName(db) === name) {
        return { kind: 'db', db, artifactPath: `/${name}` };
      }
    }
  }
  return { kind: 'paths' };
}

/**
 * One step of a DB restore. `exec`/`exec-guard` must exit 0; `exec-stdin`
 * receives the `restic dump` stream on stdin and must exit 0; `restart`
 * bounces the container via the Docker API.
 */
export type RestoreStep =
  | { kind: 'exec'; argv: string[] }
  | { kind: 'exec-guard'; argv: string[]; failIfStdoutMatches: string; error: string }
  | { kind: 'exec-stdin'; argv: string[] }
  | { kind: 'exec-stdin-text'; argv: string[]; text: string }
  | { kind: 'restart' };

export interface DbRestorePlan {
  service: string;
  type: string;
  container: string;
  steps: RestoreStep[];
}

/** Overwrite restore is not implemented for this engine — restore-to-path instead. */
export class UnsupportedRestoreError extends Error {
  readonly code = 'unsupportedEngine';
  constructor(readonly engine: string) {
    super(
      `overwrite restore is not supported for ${engine} yet — restore to a new location instead`,
    );
    this.name = 'UnsupportedRestoreError';
  }
}

/**
 * Build the ordered restore steps for one plan database. `svc.environment`
 * should carry the LIVE container env (`docker inspect` Config.Env) so
 * credentials resolve to what the running database actually uses.
 *
 * Redis/valkey sequencing (write-then-restart, NOT stop-then-write): you
 * cannot exec into a stopped container, so everything is staged while the
 * server is live. `CONFIG SET save ''` + `CONFIG SET appendonly no` first, so
 * neither a background BGSAVE/AOF-rewrite nor the SIGTERM shutdown-save can
 * clobber the placed files before the restart; both settings are in-memory
 * only and revert to the container's static config on restart. Staging file +
 * `mv -f` (atomic rename) so a torn `restic dump` stream can never become the
 * live artifact.
 *
 * AOF handling (empirically verified against redis:7-alpine): when the server
 * restarts with `appendonly yes`, it loads ONLY the AOF — a placed `dump.rdb`
 * is ignored, and a missing appendonlydir means an EMPTY dataset, not an RDB
 * fallback. So the plan also materializes a fresh multi-part AOF whose BASE
 * file IS the snapshot RDB (`appendonly.aof.1.base.rdb` + a one-line
 * manifest) and swaps it in as `appendonlydir`. Whichever persistence mode
 * the container boots with, it loads the restored dataset: AOF on → manifest
 * base RDB; AOF off → `dump.rdb`. Redis < 7 has no multi-part AOF (single
 * RESP-format appendonly.aof), so the guard refuses AOF-enabled targets older
 * than 7 up-front instead of silently wiping them.
 */
export function buildDbRestorePlan(db: PlanDatabase, svc: ComposeService): DbRestorePlan {
  const adapter = matchAdapter(svc.image ?? db.type) ?? matchAdapter(db.type);
  const type = adapter?.type ?? db.type;
  const steps = restoreSteps(type, svc);
  if (!steps) throw new UnsupportedRestoreError(type);
  return { service: db.service, type, container: db.container, steps };
}

function restoreSteps(type: string, svc: ComposeService): RestoreStep[] | null {
  switch (type) {
    case 'postgres': {
      const user = readServiceEnv(svc, 'POSTGRES_USER') ?? 'postgres';
      // pg_dumpall output is plain SQL replayed through psql against the
      // maintenance DB; dumps taken with --clean --if-exists drop-and-recreate.
      return [{ kind: 'exec-stdin', argv: ['psql', '-U', user, '-d', 'postgres'] }];
    }
    case 'mysql': {
      const pw = readServiceEnv(svc, 'MYSQL_ROOT_PASSWORD') ?? '';
      return [{ kind: 'exec-stdin', argv: ['mysql', '-uroot', `-p${pw}`] }];
    }
    case 'mariadb': {
      const pw =
        readServiceEnv(svc, 'MARIADB_ROOT_PASSWORD') ??
        readServiceEnv(svc, 'MYSQL_ROOT_PASSWORD') ??
        '';
      return [{ kind: 'exec-stdin', argv: ['mariadb', '-uroot', `-p${pw}`] }];
    }
    case 'mongo':
      return [
        {
          kind: 'exec-stdin',
          argv: ['mongorestore', '--archive', '--oplogReplay', '--drop'],
        },
      ];
    case 'redis':
      return rdbRestoreSteps('redis-cli');
    case 'valkey':
      return rdbRestoreSteps('valkey-cli');
    case 'sqlite':
      return [
        { kind: 'exec-stdin', argv: ['dd', 'of=/backup/app-restore.db'] },
        // sqlite's online-backup API swaps the DB safely under the live app —
        // no restart needed.
        { kind: 'exec', argv: ['sqlite3', '/data/app.db', '.restore /backup/app-restore.db'] },
        { kind: 'exec', argv: ['rm', '-f', '/backup/app-restore.db'] },
      ];
    default:
      return null;
  }
}

function rdbRestoreSteps(cli: 'redis-cli' | 'valkey-cli'): RestoreStep[] {
  const stagedDir = '/data/appendonlydir.dockstash-restore';
  return [
    {
      kind: 'exec-guard',
      // INFO prints redis_version (Server section) before aof_enabled
      // (Persistence section) — one exec covers the combined check.
      argv: [cli, 'INFO'],
      failIfStdoutMatches: 'redis_version:[0-6]\\.[\\s\\S]*aof_enabled:1',
      error:
        'AOF persistence is enabled on a pre-7 server — the RDB restore cannot be loaded safely; disable appendonly or upgrade to redis/valkey 7+',
    },
    { kind: 'exec', argv: [cli, 'CONFIG', 'SET', 'save', ''] },
    { kind: 'exec', argv: [cli, 'CONFIG', 'SET', 'appendonly', 'no'] },
    { kind: 'exec-stdin', argv: ['dd', 'of=/data/dump.rdb.dockstash-restore'] },
    { kind: 'exec', argv: ['mv', '-f', '/data/dump.rdb.dockstash-restore', '/data/dump.rdb'] },
    { kind: 'exec', argv: ['mkdir', '-p', stagedDir] },
    { kind: 'exec', argv: ['cp', '/data/dump.rdb', `${stagedDir}/appendonly.aof.1.base.rdb`] },
    {
      kind: 'exec-stdin-text',
      argv: ['dd', `of=${stagedDir}/appendonly.aof.manifest`],
      text: 'file appendonly.aof.1.base.rdb seq 1 type b\n',
    },
    { kind: 'exec', argv: ['rm', '-rf', '/data/appendonlydir'] },
    { kind: 'exec', argv: ['mv', '-f', stagedDir, '/data/appendonlydir'] },
    { kind: 'restart' },
  ];
}

export interface RestoreExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/** Narrow docker surface the orchestrator needs — both real clients satisfy it. */
export interface DbRestoreDocker {
  execCollect(container: string, argv: string[]): Promise<RestoreExecResult>;
  execWithStdin(
    container: string,
    argv: string[],
    stdin: Readable,
  ): Promise<{ exitCode: number; stderr: string }>;
  restart(container: string): Promise<void>;
}

export interface DbRestoreRestic {
  dump(args: string[]): Promise<{ stream: Readable; done: Promise<void> }>;
}

export interface DbRestoreDeps {
  restic: DbRestoreRestic;
  docker: DbRestoreDocker;
  log(line: string): void;
}

const STDERR_TAIL = 500;

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function tail(text: string): string {
  const trimmed = text.trim();
  return trimmed.length > STDERR_TAIL ? trimmed.slice(-STDERR_TAIL) : trimmed;
}

/**
 * Execute a DB restore plan step by step. Every step logs a line (feeds the
 * job logTail / server logs); any failure throws with a
 * `restore <service> (<type>) in <container>` prefix — that message is what
 * lands in the failure-alert email.
 */
export async function performDbRestore(
  snapshotId: string,
  artifactPath: string,
  plan: DbRestorePlan,
  deps: DbRestoreDeps,
): Promise<void> {
  const prefix = `restore ${plan.service} (${plan.type}) in ${plan.container}`;
  for (const step of plan.steps) {
    switch (step.kind) {
      case 'exec': {
        deps.log(`${prefix}: ${step.argv.join(' ')}`);
        const res = await deps.docker.execCollect(plan.container, step.argv);
        if (res.exitCode !== 0) {
          throw new Error(
            `${prefix}: ${step.argv[0]} exit ${res.exitCode}: ${tail(res.stderr || res.stdout)}`,
          );
        }
        break;
      }
      case 'exec-guard': {
        deps.log(`${prefix}: ${step.argv.join(' ')}`);
        const res = await deps.docker.execCollect(plan.container, step.argv);
        if (res.exitCode !== 0) {
          throw new Error(
            `${prefix}: ${step.argv[0]} exit ${res.exitCode}: ${tail(res.stderr || res.stdout)}`,
          );
        }
        if (new RegExp(step.failIfStdoutMatches).test(res.stdout)) {
          throw new Error(`${prefix}: ${step.error}`);
        }
        break;
      }
      case 'exec-stdin': {
        deps.log(`${prefix}: restic dump ${artifactPath} | ${step.argv.join(' ')}`);
        const dumped = await deps.restic.dump(['dump', snapshotId, artifactPath]);
        // Run the container-side consumer and the restic producer together so
        // a restic failure mid-stream fails the step even when the consumer
        // (e.g. `dd`) exits 0 on early EOF. allSettled: if one side rejects,
        // the other side's rejection must not become an unhandled rejection.
        const [execSettled, doneSettled] = await Promise.allSettled([
          deps.docker.execWithStdin(plan.container, step.argv, dumped.stream),
          dumped.done,
        ]);
        const errors: string[] = [];
        if (execSettled.status === 'rejected') {
          errors.push(errText(execSettled.reason));
        } else if (execSettled.value.exitCode !== 0) {
          errors.push(
            `${step.argv[0]} exit ${execSettled.value.exitCode}: ${tail(execSettled.value.stderr)}`,
          );
        }
        if (doneSettled.status === 'rejected') {
          errors.push(errText(doneSettled.reason));
        }
        if (errors.length > 0) {
          throw new Error(`${prefix}: ${errors.join('; ')}`);
        }
        break;
      }
      case 'exec-stdin-text': {
        deps.log(`${prefix}: ${step.argv.join(' ')} <<literal`);
        const res = await deps.docker.execWithStdin(
          plan.container,
          step.argv,
          Readable.from([step.text]),
        );
        if (res.exitCode !== 0) {
          throw new Error(
            `${prefix}: ${step.argv[0]} exit ${res.exitCode}: ${tail(res.stderr)}`,
          );
        }
        break;
      }
      case 'restart': {
        deps.log(`${prefix}: restarting container`);
        await deps.docker.restart(plan.container);
        break;
      }
    }
  }
  deps.log(`${prefix}: done`);
}
