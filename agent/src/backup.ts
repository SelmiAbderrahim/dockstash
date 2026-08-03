// Lean reimplementation of the server's runBackup layer loop
// (server/src/modules/backups/backups.service.ts:198-247) — keep semantics in sync.
import path from 'node:path';
import {
  matchAdapter,
  type ComposeService,
  type FileAdapter,
  type StdinAdapter,
} from './adapters.js';
import { dbSnapshotTag } from './restore-plan.js';
import type { DockerClient, DockerExecStream } from './docker-client.js';
import type { ResticRunnerExt } from './restic-runner.js';
import { isAllowedProjectPath } from './paths.js';
import type { ClaimedJob, JobResultStats } from './types.js';

type DbLayer = ClaimedJob['plan']['databases'][number];

export interface BackupDeps {
  restic: ResticRunnerExt;
  docker: DockerClient;
  /** This agent's configured allowlist (config.DOCKSTASH_PROJECT_ROOTS). */
  roots: readonly string[];
  log(line: string): void;
}

/** Same command-injection guard as the server: argv tokens, never a shell. */
export function assertArgvSafe(argv: string[]): void {
  for (const token of argv) {
    if (token.includes('\0')) {
      throw new Error('argv token contains NUL byte');
    }
  }
}

function assertAllowedPath(p: string, roots: readonly string[]): void {
  if (!isAllowedProjectPath(p, roots)) {
    throw new Error(`path not allowed: ${p}`);
  }
}

/**
 * restic `backup` exit code 3: the snapshot was created but some source files
 * could not be read (e.g. permission denied). Matches the error format the
 * restic-runner produces (`restic backup exit 3: <stderr>`). Kept in sync with
 * server/src/modules/backups/backups.service.ts.
 */
export function isPartialReadFailure(message: string): boolean {
  return /^restic backup exit 3:/.test(message);
}

/**
 * Pipe a streaming exec's stdout into `restic backup --stdin`, then read the
 * dump's OWN exit code and stderr tail. restic will happily snapshot an empty
 * or truncated stdin and report success — the dump exit code is the only
 * signal that the source command actually produced a complete dump.
 */
async function streamIntoRestic(
  es: DockerExecStream,
  resticArgs: string[],
  deps: BackupDeps,
): Promise<{ exitCode: number; stderrTail: string; resticErr?: string }> {
  let resticErr: string | undefined;
  try {
    await deps.restic.backup(resticArgs, { stdin: es.stream as never });
  } catch (err) {
    resticErr = err instanceof Error ? err.message : String(err);
  }
  const { exitCode, stderrTail } = await es.exit();
  return { exitCode, stderrTail, resticErr };
}

/** One stdin-dump attempt: open the exec, stream it into restic, report the dump exit. */
async function runStdinDumpAttempt(
  db: DbLayer,
  adapter: StdinAdapter,
  argv: string[],
  env: string[] | undefined,
  deps: BackupDeps,
): Promise<{ exitCode: number; stderrTail: string; resticErr?: string }> {
  assertArgvSafe(argv);
  let es: DockerExecStream;
  try {
    es = await deps.docker.execStream(db.container, argv, { env });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`dump failed for ${db.service}: ${message}`);
  }
  return streamIntoRestic(
    es,
    [
      'backup',
      '--stdin',
      '--stdin-filename',
      `${db.service}.dump`,
      '--tag',
      dbSnapshotTag(db.service, adapter.type),
    ],
    deps,
  );
}

/**
 * stdin-adapter layer. A clean dump (exit 0) that restic then fails on is a
 * real restic error (network/disk/lock). A non-zero dump exit is the dump's
 * own failure — surfaced with its stderr, or retried ONCE if the adapter
 * offers a fallback argv (mongodump dropping `--oplog` on standalone mongo).
 */
async function backupStdinLayer(
  db: DbLayer,
  adapter: StdinAdapter,
  svc: ComposeService,
  deps: BackupDeps,
): Promise<void> {
  const env = adapter.dumpEnv?.(svc);
  const first = await runStdinDumpAttempt(db, adapter, adapter.dumpCmd(svc), env, deps);
  if (first.exitCode === 0) {
    if (first.resticErr) throw new Error(`restic dump failed: ${first.resticErr}`);
    return;
  }
  const alt = adapter.fallbackDumpCmd?.(svc, first.stderrTail) ?? null;
  if (alt) {
    deps.log(`retrying ${db.service} dump without incompatible options`);
    const retry = await runStdinDumpAttempt(db, adapter, alt, env, deps);
    if (retry.exitCode === 0) {
      if (retry.resticErr) throw new Error(`restic dump failed: ${retry.resticErr}`);
      return;
    }
    throw new Error(
      `dump failed for ${db.service} (exit ${retry.exitCode}): ${retry.stderrTail || 'no stderr'}`,
    );
  }
  throw new Error(
    `dump failed for ${db.service} (exit ${first.exitCode}): ${first.stderrTail || 'no stderr'}`,
  );
}

/**
 * file-adapter layer. The dump writes an artifact INSIDE the container; run it
 * to completion (execCollect gives the exit code + both channels), assert it
 * succeeded (and pass any adapter `verifyDump`, e.g. redis SAVE must reply OK —
 * redis-cli exits 0 even on NOAUTH), THEN stream the artifact out — checking
 * that read's exit too so a missing artifact is a clear error, not "no data".
 */
async function backupFileLayer(
  db: DbLayer,
  adapter: FileAdapter,
  svc: ComposeService,
  deps: BackupDeps,
): Promise<void> {
  const argv = adapter.dumpCmd(svc);
  assertArgvSafe(argv);
  let res;
  try {
    res = await deps.docker.execCollect(db.container, argv, adapter.dumpEnv?.(svc));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`dump failed for ${db.service}: ${message}`);
  }
  if (res.exitCode !== 0) {
    throw new Error(
      `dump failed for ${db.service} (exit ${res.exitCode}): ${res.stderr.trim() || 'no stderr'}`,
    );
  }
  adapter.verifyDump?.(res);

  const { readArgv, stdinFilename } = artifactReadPlan(adapter, svc, db.service);
  assertArgvSafe(readArgv);
  let es: DockerExecStream;
  try {
    es = await deps.docker.execStream(db.container, readArgv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`artifact read failed for ${db.service}: ${message}`);
  }
  const { exitCode, stderrTail, resticErr } = await streamIntoRestic(
    es,
    [
      'backup',
      '--stdin',
      '--stdin-filename',
      stdinFilename,
      '--tag',
      dbSnapshotTag(db.service, adapter.type),
    ],
    deps,
  );
  if (exitCode !== 0) {
    throw new Error(
      `artifact read failed for ${db.service} (exit ${exitCode}): ${stderrTail || 'no stderr'}`,
    );
  }
  if (resticErr) throw new Error(`restic dump failed: ${resticErr}`);
}

/**
 * A file-mode dump writes its artifact INSIDE the container; restic runs on the
 * host and cannot read it there. Build the command to stream the artifact back
 * out — `cat` for a single file, `tar` for a directory — plus the filename it
 * lands under in the restic snapshot.
 */
export function artifactReadPlan(
  adapter: FileAdapter,
  svc: ComposeService,
  service: string,
): { readArgv: string[]; stdinFilename: string } {
  const artifactPath = adapter.dumpArtifactPath(svc);
  if (adapter.artifactType === 'directory') {
    return {
      readArgv: ['tar', '-cf', '-', '-C', artifactPath, '.'],
      stdinFilename: `${service}.tar`,
    };
  }
  return {
    readArgv: ['cat', artifactPath],
    stdinFilename: `${service}-${path.posix.basename(artifactPath)}`,
  };
}

/** Collect repo metering after a successful backup — feeds the job result. */
export async function collectStats(restic: ResticRunnerExt): Promise<JobResultStats> {
  const stats: JobResultStats = {};
  const repo = await restic.stats();
  if (typeof repo.total_size === 'number') stats.totalRepoBytes = repo.total_size;
  const snapshots = await restic.snapshotsDetailed();
  stats.snapshotCount = snapshots.length;
  const last = snapshots[snapshots.length - 1];
  const processed = last?.summary?.total_bytes_processed;
  if (typeof processed === 'number') stats.lastBackupBytes = processed;
  return stats;
}

/**
 * Run one backup job: per enabled DB layer exec the adapter dump inside the
 * target container (stdin-piped into restic or file-artifact), then back up
 * plan paths + configs, then collect repo stats.
 */
export async function runBackupJob(
  job: ClaimedJob,
  deps: BackupDeps,
): Promise<JobResultStats> {
  for (const p of job.plan.paths) assertAllowedPath(p, deps.roots);
  // `configs` join the restic argv alongside `paths` (see below), so they must
  // clear the same project-roots allowlist — a server-trusted job must never
  // carry an out-of-tree config path.
  for (const c of job.plan.configs) assertAllowedPath(c, deps.roots);
  await deps.restic.init();

  for (const db of job.plan.databases) {
    if (!db.enabled) continue;
    // Read the container's real image/env/cmd — the credential source the
    // dump adapters need (POSTGRES_USER, MONGO creds, redis requirepass). A
    // stopped container can never dump, so fail fast with an actionable hint
    // rather than a cryptic exec error. Mirrors restore.ts's inspect step.
    const inspected = await deps.docker.inspect(db.container);
    if (!inspected.running) {
      throw new Error(
        `container ${db.container} is not running — start it or disable this database layer`,
      );
    }
    const svc: ComposeService = {
      image: inspected.image || db.type,
      environment: inspected.env,
      command: inspected.cmd,
    };
    const adapter = matchAdapter(svc.image);
    if (!adapter) {
      throw new Error(`no adapter matched service ${db.service}`);
    }
    deps.log(`dumping ${db.service} (${db.type}) from ${db.container}`);
    if (adapter.mode === 'file') {
      await backupFileLayer(db, adapter, svc, deps);
    } else {
      await backupStdinLayer(db, adapter, svc, deps);
    }
    deps.log(`layer ${db.service} done`);
  }

  const pathArgs = [...job.plan.paths, ...job.plan.configs];
  if (pathArgs.length > 0) {
    deps.log(`backing up ${pathArgs.length} path(s)`);
    try {
      await deps.restic.backup(['backup', ...pathArgs]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // restic exit 3 = snapshot WAS created but some source files were
      // unreadable. Warn and keep the (partial) snapshot instead of failing
      // the job — a hard fail here pressures operators into chmod'ing their
      // project trees, which is worse than a flagged partial backup.
      if (isPartialReadFailure(message)) {
        deps.log(`warning: snapshot created but some files were unreadable: ${message}`);
      } else {
        throw new Error(`restic paths failed: ${message}`);
      }
    }
  }

  return collectStats(deps.restic);
}
