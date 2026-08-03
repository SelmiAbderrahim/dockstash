import { Schedule, type ScheduleHydrated } from './scheduler.model.js';
import type { SchedulerCron, SchedulerQueue } from './scheduler.boundaries.js';

export interface ReconcileDeps {
  cron: SchedulerCron;
  queue: SchedulerQueue;
}

/**
 * Reconcile node-cron registrations against the `Schedule` collection: one
 * cron entry per enabled schedule. Disabled or deleted schedules are
 * unregistered. Safe to call on boot and after every schedule mutation —
 * `register` is idempotent (replaces in place).
 */
export async function reconcileCron(deps: ReconcileDeps): Promise<void> {
  const enabled: ScheduleHydrated[] = await Schedule.find({ enabled: true });
  const wantedIds = new Set<string>();
  for (const schedule of enabled) {
    const id = schedule._id.toString();
    wantedIds.add(id);
    deps.cron.register(id, schedule.cron, () => enqueueFromSchedule(schedule, deps));
  }
  for (const id of deps.cron.list()) {
    // `__`-prefixed ids are runtime system tasks (heartbeat, fleet sweeps,
    // the periodic reconcile itself) — never schedule-owned, never swept.
    if (id.startsWith('__')) continue;
    if (!wantedIds.has(id)) deps.cron.unregister(id);
  }
}

export async function enqueueFromSchedule(
  schedule: ScheduleHydrated,
  deps: Pick<ReconcileDeps, 'queue'>,
): Promise<void> {
  const owner = schedule.owner.toString();
  await deps.queue.add({
    projectId: schedule.project.toString(),
    owner,
    kind: schedule.kind,
    retention: schedule.retention
      ? {
          keepDaily: schedule.retention.keepDaily,
          keepWeekly: schedule.retention.keepWeekly,
          keepMonthly: schedule.retention.keepMonthly,
        }
      : undefined,
    scheduleId: schedule._id.toString(),
  });
  schedule.lastEnqueuedAt = new Date();
  schedule.lastRunStatus = 'queued';
  await schedule.save();
}
