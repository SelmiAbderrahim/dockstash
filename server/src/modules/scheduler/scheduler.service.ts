import { isValidObjectId } from 'mongoose';
import { logger } from '../../config/logger.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { allowedRootsForProject, loadOwnedProject } from '../backups/backups.service.js';
import { isAllowedProjectPath, isPathUnderRoots } from '../backups/backups.paths.js';
import { Schedule, type ScheduleHydrated, type JobKind } from './scheduler.model.js';
import type {
  Job,
  RestoreJobPayload,
  RetentionPolicy,
  SchedulerQueue,
} from './scheduler.boundaries.js';
import {
  CONTINUOUS_PRESET,
  type CreateScheduleInput,
  type EnqueueNowInput,
  type UpdateScheduleInput,
} from './scheduler.schema.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

export interface ServiceCtx {
  t?: Translator;
}

export async function createSchedule(
  userId: string,
  input: CreateScheduleInput,
  ctx: ServiceCtx = {},
): Promise<ScheduleHydrated> {
  const t = ctx.t ?? identityT;
  await loadOwnedProject(input.projectId, userId, { t });
  // `preset: 'continuous'` expands server-side; explicit cron/retention win
  // over the preset's values so a client can tweak the cadence it seeds.
  const cron = input.cron ?? CONTINUOUS_PRESET.cron;
  const retention =
    input.retention ??
    (input.preset === 'continuous' ? { ...CONTINUOUS_PRESET.retention } : { keepDaily: 7, keepWeekly: 4, keepMonthly: 6 });
  const schedule = await Schedule.create({
    project: input.projectId,
    owner: userId,
    kind: input.kind,
    cron,
    retention,
    enabled: input.enabled ?? true,
  });
  return schedule;
}

/** Cadence provisioned for projects created without an explicit schedule. */
export const DEFAULT_BACKUP_CRON = '0 3 * * *';

/**
 * Safe-by-default provisioning: give a freshly created project a daily backup
 * schedule unless one already exists. Never throws — a scheduling failure
 * returns null and project creation
 * proceeds; the heartbeat sweep remains the dead-man's-switch for projects
 * that end up unscheduled.
 */
export async function ensureDefaultBackupSchedule(
  userId: string,
  projectId: string,
  ctx: ServiceCtx = {},
): Promise<ScheduleHydrated | null> {
  try {
    const existing = await Schedule.findOne({
      project: projectId,
      owner: userId,
      kind: 'backup',
    });
    if (existing) return existing;
    return await createSchedule(
      userId,
      { projectId, kind: 'backup', cron: DEFAULT_BACKUP_CRON },
      ctx,
    );
  } catch (err) {
    logger.error(
      { err, projectId, userId },
      'scheduler: default backup schedule provisioning failed',
    );
    return null;
  }
}

export async function listSchedulesForUser(userId: string): Promise<ScheduleHydrated[]> {
  return Schedule.find({ owner: userId }).sort({ createdAt: -1 });
}

export async function loadOwnedSchedule(
  scheduleId: string,
  userId: string,
  ctx: ServiceCtx = {},
): Promise<ScheduleHydrated> {
  const t = ctx.t ?? identityT;
  // Owner scope AT QUERY TIME (surface #2 / S2-01): 404 for both non-existent
  // and non-owned so an attacker cannot iterate ObjectIds and enumerate every
  // tenant's schedules.
  if (!isValidObjectId(scheduleId)) {
    throw HttpError.notFound(t('scheduler.error.scheduleNotFound'));
  }
  const schedule = await Schedule.findOne({ _id: scheduleId, owner: userId });
  if (!schedule) throw HttpError.notFound(t('scheduler.error.scheduleNotFound'));
  return schedule;
}

export async function updateSchedule(
  scheduleId: string,
  userId: string,
  input: UpdateScheduleInput,
  ctx: ServiceCtx = {},
): Promise<ScheduleHydrated> {
  const schedule = await loadOwnedSchedule(scheduleId, userId, ctx);
  if (input.cron !== undefined) {
    schedule.cron = input.cron;
  }
  if (input.enabled !== undefined) {
    schedule.enabled = input.enabled;
  }
  if (input.retention !== undefined) {
    schedule.retention = {
      keepDaily: input.retention.keepDaily ?? schedule.retention.keepDaily,
      keepWeekly: input.retention.keepWeekly ?? schedule.retention.keepWeekly,
      keepMonthly: input.retention.keepMonthly ?? schedule.retention.keepMonthly,
      keepHourly: input.retention.keepHourly ?? schedule.retention.keepHourly,
      keepLast: input.retention.keepLast ?? schedule.retention.keepLast,
    } as ScheduleHydrated['retention'];
  }
  await schedule.save();
  return schedule;
}

export async function deleteSchedule(
  scheduleId: string,
  userId: string,
  ctx: ServiceCtx = {},
): Promise<void> {
  const schedule = await loadOwnedSchedule(scheduleId, userId, ctx);
  await schedule.deleteOne();
}

export interface EnqueueDeps extends ServiceCtx {
  queue: SchedulerQueue;
}

/**
 * `POST /enqueue` — enqueue a job now. Accepts either `{ scheduleId }` (use
 * the schedule's kind + retention) or `{ projectId, kind, retention? }`
 * (ad-hoc).
 */
export async function enqueueNow(
  userId: string,
  input: EnqueueNowInput,
  deps: EnqueueDeps,
): Promise<Job> {
  const t = deps.t ?? identityT;
  let projectId: string;
  let kind: JobKind;
  let retention: RetentionPolicy | undefined;
  let scheduleId: string | undefined;
  let payload: RestoreJobPayload | undefined;

  if ('scheduleId' in input) {
    const schedule = await loadOwnedSchedule(input.scheduleId, userId, { t });
    projectId = schedule.project.toString();
    kind = schedule.kind;
    retention = schedule.retention
      ? {
          keepDaily: schedule.retention.keepDaily,
          keepWeekly: schedule.retention.keepWeekly,
          keepMonthly: schedule.retention.keepMonthly,
          keepHourly: schedule.retention.keepHourly,
          keepLast: schedule.retention.keepLast,
        }
      : undefined;
    scheduleId = schedule._id.toString();
  } else {
    const project = await loadOwnedProject(input.projectId, userId, { t });
    projectId = input.projectId;
    kind = input.kind;
    retention = input.retention;
    if (kind === 'restore' && input.snapshotId && input.overwrite !== undefined) {
      // Belt-and-braces: the executor (local runRestore or the remote agent)
      // re-validates, but reject an out-of-allowlist target at enqueue time so
      // the operator sees a 400 instead of a failed job minutes later.
      if (!input.overwrite) {
        const roots = await allowedRootsForProject(project, userId, { t });
        const allowed = roots
          ? isPathUnderRoots(input.targetPath, roots)
          : isAllowedProjectPath(input.targetPath);
        if (!allowed) {
          throw HttpError.badRequest(
            t('backups.error.pathNotAllowed', { path: input.targetPath ?? '' }),
          );
        }
      }
      payload = {
        snapshotId: input.snapshotId,
        overwrite: input.overwrite,
        targetPath: input.targetPath,
      };
    }
  }

  // Reject a manual double-submit (double-click, double-tab) outright rather
  // than silently queueing a duplicate run behind the active one — cron
  // ticks go through scheduler.cron.ts, not this path, and are still meant
  // to queue behind a running job.
  const activeCount = await deps.queue.activeCountForProject(projectId);
  if (activeCount > 0) {
    throw HttpError.conflict(t('scheduler.error.repoBusy', { projectId }));
  }

  const job = await deps.queue.add({
    projectId,
    owner: userId,
    kind,
    retention,
    scheduleId,
    payload,
  });

  if (scheduleId) {
    await Schedule.findByIdAndUpdate(scheduleId, {
      lastEnqueuedAt: new Date(),
      lastRunStatus: 'queued',
    });
  }

  return job;
}
