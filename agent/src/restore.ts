// Lean reimplementation of the server's restore flow
// (server/src/modules/backups/backups.restore.service.ts) — keep semantics in
// sync. Same shape as backup.ts: no i18n, no Mongo; errors are plain English
// strings that flow verbatim into the job result → dashboard + failure email.
import { isAllowedProjectPath } from './paths.js';
import type { DockerClient } from './docker-client.js';
import type { ResticRunnerExt } from './restic-runner.js';
import type { ComposeService } from './adapters.js';
import {
  buildDbRestorePlan,
  classifySnapshot,
  performDbRestore,
  type PlanDatabase,
} from './restore-plan.js';
import type { ClaimedJob } from './types.js';

export interface RestoreDeps {
  restic: ResticRunnerExt;
  docker: DockerClient;
  /** This agent's configured allowlist (config.DOCKSTASH_PROJECT_ROOTS). */
  roots: readonly string[];
  log(line: string): void;
}

/**
 * A restic snapshot id is a hex id or the alias `latest`. Validate before it
 * enters the restic argv so a value like `--flag` cannot be parsed as an option.
 */
export const SNAPSHOT_ID_RE = /^([0-9a-f]{8,64}|latest)$/i;

/** Snapshot record subset (`restic snapshots --json`) restore needs. */
interface SnapshotRecord {
  id: string;
  short_id: string;
  time: string;
  tags?: string[];
  paths?: string[];
}

/** `latest` → newest by time; otherwise short-id or full-id prefix match. */
export function resolveSnapshot(
  snapshots: SnapshotRecord[],
  snapshotId: string,
): SnapshotRecord | undefined {
  if (snapshotId.toLowerCase() === 'latest') {
    return [...snapshots].sort((a, b) => a.time.localeCompare(b.time)).at(-1);
  }
  const wanted = snapshotId.toLowerCase();
  return snapshots.find(
    (s) =>
      s.short_id.toLowerCase() === wanted || s.id.toLowerCase().startsWith(wanted),
  );
}

/**
 * Run one restore job. Non-overwrite restores materialize files at the
 * allowed target path (every snapshot kind). Overwrite restores branch on the
 * snapshot class: path snapshots go back to their original absolute paths
 * (`--target /`, pre-flighted against the agent's roots so a foreign or
 * artifact snapshot can never write into the agent container fs); DB dump
 * snapshots are streamed back into the running database container via the
 * per-engine restore plan.
 */
export async function runRestoreJob(job: ClaimedJob, deps: RestoreDeps): Promise<void> {
  if (!job.restore) {
    throw new Error('restore job missing payload');
  }
  if (!SNAPSHOT_ID_RE.test(job.restore.snapshotId)) {
    throw new Error(`invalid snapshot id: ${job.restore.snapshotId}`);
  }

  if (!job.restore.overwrite) {
    const targetPath = job.restore.targetPath;
    if (!targetPath || !isAllowedProjectPath(targetPath, deps.roots)) {
      throw new Error(`restore target not allowed: ${targetPath ?? ''}`);
    }
    deps.log(`restoring ${job.restore.snapshotId} to ${targetPath}`);
    await deps.restic.restore(['restore', job.restore.snapshotId, '--target', targetPath]);
    return;
  }

  const snapshots = await deps.restic.snapshotsDetailed();
  const snapshot = resolveSnapshot(snapshots, job.restore.snapshotId);
  if (!snapshot) {
    throw new Error(`snapshot ${job.restore.snapshotId} not found in the repository`);
  }

  const databases: PlanDatabase[] = job.plan.databases;
  const cls = classifySnapshot(snapshot, databases);

  if (cls.kind === 'paths') {
    // Pre-flight: every recorded path must sit inside this agent's roots —
    // only those are bind-mounted, so anything else would silently restore
    // into the agent container fs (or fail like the /redis-dump.rdb case).
    for (const p of snapshot.paths ?? []) {
      if (!isAllowedProjectPath(p, deps.roots)) {
        throw new Error(
          `snapshot path ${p} is outside the agent project roots — restore to a new location instead`,
        );
      }
    }
    deps.log(`restoring ${snapshot.short_id} over original paths`);
    // Restic snapshots store absolute paths; `--target /` puts them back.
    await deps.restic.restore(['restore', snapshot.id, '--target', '/']);
    return;
  }

  const inspected = await deps.docker.inspect(cls.db.container);
  if (!inspected.running) {
    throw new Error(`container ${cls.db.container} is not running — start it and retry`);
  }
  const svc: ComposeService = {
    image: inspected.image || cls.db.type,
    environment: inspected.env,
  };
  // UnsupportedRestoreError propagates as-is — its message already tells the
  // user to restore-to-path instead.
  const plan = buildDbRestorePlan(cls.db, svc);
  await performDbRestore(snapshot.id, cls.artifactPath, plan, {
    restic: deps.restic,
    docker: deps.docker,
    log: deps.log,
  });
}
