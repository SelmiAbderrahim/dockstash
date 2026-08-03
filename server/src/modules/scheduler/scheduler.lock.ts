import type { Job, ResticRunnerExt, SchedulerQueue } from './scheduler.boundaries.js';

export interface LockRecoveryDeps {
  queue: SchedulerQueue;
  resticRunner: ResticRunnerExt;
}

/**
 * Restic leaves a lock on the repo when a run crashes. Before a retry, if no
 * *other* live job holds this repo, the lock is orphaned and we can safely
 * `restic unlock`. Never unlock while a real concurrent run is active — the
 * per-repo serialization in the queue means this should always be the case,
 * but we still guard defensively.
 *
 * `active` counts this job itself, so `<= 1` means "only me → safe to unlock".
 */
export async function recoverStaleLockIfOrphaned(
  job: Job,
  deps: LockRecoveryDeps,
): Promise<{ unlocked: boolean }> {
  const active = await deps.queue.activeCountForProject(job.data.projectId);
  if (active <= 1) {
    try {
      await deps.resticRunner.unlock();
      return { unlocked: true };
    } catch {
      return { unlocked: false };
    }
  }
  return { unlocked: false };
}
