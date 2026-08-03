// Kind dispatch + local retry loop — mirrors the server dispatcher's
// 3-attempt/backoff convention (scheduler.dispatcher.ts processJob), with
// `restic unlock` between attempts (recoverStaleLockIfOrphaned's intent).
import type { ResticRunnerExt } from './restic-runner.js';
import type { DockerClient } from './docker-client.js';
import { runBackupJob } from './backup.js';
import { runRestoreJob } from './restore.js';
import type { ClaimedJob, JobResult } from './types.js';

export interface ExecutorDeps {
  restic: ResticRunnerExt;
  docker: DockerClient;
  /** This agent's configured allowlist (config.DOCKSTASH_PROJECT_ROOTS). */
  roots: readonly string[];
  log(line: string): void;
  sleep?(ms: number): Promise<void>;
  baseBackoffMs?: number;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Retention policy → restic `forget --prune` argv (parity with pruneArgs). */
export function pruneArgs(retention: NonNullable<ClaimedJob['retention']>): string[] {
  return [
    'forget',
    '--prune',
    '--keep-daily',
    String(retention.keepDaily),
    '--keep-weekly',
    String(retention.keepWeekly),
    '--keep-monthly',
    String(retention.keepMonthly),
  ];
}

async function dispatchKind(job: ClaimedJob, deps: ExecutorDeps): Promise<JobResult> {
  switch (job.kind) {
    case 'backup': {
      const stats = await runBackupJob(job, deps);
      return { ok: true, stats };
    }
    case 'check': {
      await deps.restic.check(['check']);
      return { ok: true };
    }
    case 'prune': {
      if (!job.retention) {
        throw new Error('prune job missing retention policy');
      }
      await deps.restic.forget(pruneArgs(job.retention));
      return { ok: true };
    }
    case 'restore': {
      // NOTE: the retry loop below re-runs a destructive restore. The restore
      // plan steps are idempotent (mongorestore --drop, mysqldump's DROP TABLE
      // IF EXISTS replay, RDB staging file + atomic mv), so a retry converges
      // on the same end state.
      await runRestoreJob(job, deps);
      return { ok: true };
    }
  }
}

/**
 * Execute a claimed job with the local retry loop. The returned result is
 * final — the server treats the posted result as authoritative.
 */
export async function executeJob(job: ClaimedJob, deps: ExecutorDeps): Promise<JobResult> {
  const sleep = deps.sleep ?? defaultSleep;
  const baseBackoffMs = deps.baseBackoffMs ?? 200;
  const maxAttempts = job.maxAttempts;

  let lastErr: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1) {
        deps.log(`retry ${attempt}/${maxAttempts}: restic unlock`);
        await deps.restic.unlock().catch(() => {
          // best-effort — a dead lock is retried by the operation itself
        });
      }
      return await dispatchKind(job, deps);
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      deps.log(`attempt ${attempt}/${maxAttempts} failed: ${lastErr.message}`);
      if (attempt < maxAttempts) {
        await sleep(baseBackoffMs * 2 ** (attempt - 1));
      }
    }
  }
  return { ok: false, error: lastErr?.message ?? 'job failed' };
}
