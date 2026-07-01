import type { ScheduleHydrated } from './scheduler.model.js';

export interface PublicSchedule {
  id: string;
  projectId: string;
  kind: string;
  cron: string;
  enabled: boolean;
  retention: {
    keepDaily: number;
    keepWeekly: number;
    keepMonthly: number;
  };
  lastRunStatus: string;
  lastEnqueuedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeSchedule(schedule: ScheduleHydrated): PublicSchedule {
  const doc = schedule.toObject({ virtuals: false });
  return {
    id: schedule._id.toString(),
    projectId: schedule.project.toString(),
    kind: schedule.kind,
    cron: schedule.cron,
    enabled: schedule.enabled,
    retention: {
      keepDaily: schedule.retention.keepDaily,
      keepWeekly: schedule.retention.keepWeekly,
      keepMonthly: schedule.retention.keepMonthly,
    },
    lastRunStatus: schedule.lastRunStatus,
    lastEnqueuedAt: schedule.lastEnqueuedAt
      ? new Date(schedule.lastEnqueuedAt).toISOString()
      : null,
    createdAt: (doc.createdAt as Date).toISOString(),
    updatedAt: (doc.updatedAt as Date).toISOString(),
  };
}
