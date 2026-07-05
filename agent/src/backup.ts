// Lean reimplementation of the server's runBackup layer loop
// (server/src/modules/backups/backups.service.ts:198-247) — keep semantics in sync.
import path from 'node:path';
import { matchAdapter, type ComposeService, type FileAdapter } from './adapters.js';
import type { DockerClient } from './docker-client.js';
import type { ResticRunnerExt } from './restic-runner.js';
import { isAllowedProjectPath } from './paths.js';
import type { ClaimedJob, JobResultStats } from './types.js';

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
 * Consume a container-exec stream to completion (file-artifact adapters only
 * need the dump command to finish before restic backs up the produced path).
 */
export function drainStream(stream: NodeJS.ReadableStream): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    stream.on('error', reject);
    stream.on('end', resolve);
    stream.resume();
  });
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
    const svc: ComposeService = { image: db.type };
    const adapter = matchAdapter(db.type);
    if (!adapter) {
      throw new Error(`no adapter matched service ${db.service}`);
    }
    const argv = adapter.dumpCmd(svc);
    assertArgvSafe(argv);
    deps.log(`dumping ${db.service} (${db.type}) from ${db.container}`);
    let stream: NodeJS.ReadableStream;
    try {
      stream = await deps.docker.exec(db.container, argv);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`dump failed for ${db.service}: ${message}`);
    }
    try {
      if (adapter.mode === 'file') {
        // The dump wrote its artifact INSIDE the container; restic runs
        // host-side and cannot read that path (a bare `restic backup <path>`
        // fails "<path> does not exist, skipping"). Wait for the dump, then
        // stream the artifact OUT via a second exec into restic --stdin.
        await drainStream(stream);
        const { readArgv, stdinFilename } = artifactReadPlan(adapter, svc, db.service);
        assertArgvSafe(readArgv);
        const artifact = await deps.docker.exec(db.container, readArgv);
        await deps.restic.backup(
          ['backup', '--stdin', '--stdin-filename', stdinFilename],
          { stdin: artifact as never },
        );
      } else {
        await deps.restic.backup(
          ['backup', '--stdin', '--stdin-filename', `${db.service}.dump`],
          { stdin: stream as never },
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`restic dump failed: ${message}`);
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
      throw new Error(`restic paths failed: ${message}`);
    }
  }

  return collectStats(deps.restic);
}
