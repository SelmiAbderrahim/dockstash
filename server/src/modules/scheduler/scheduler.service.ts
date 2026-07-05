import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { allowedRootsForProject, loadOwnedProject } from '../backups/backups.service.js';
import { isAllowedProjectPath, isPathUnderRoots } from '../backups/backups.paths.js';
import {
  assertScheduleAllowed,
  classifyCron,
} from '../billing/entitlements.service.js';
import { Schedule, type ScheduleHydrated, type JobKind } from './scheduler.model.js';
import type {
  EntitlementChecker,
  Job,
  RestoreJobPayload,
  RetentionPolicy,
  SchedulerQueue,
} from './scheduler.boundaries.js';
import type {
  CreateScheduleInput,
  EnqueueNowInput,
  UpdateScheduleInput,
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
  await assertScheduleAllowed(userId, {
    t,
    frequency: classifyCron(input.cron),
  });
  const schedule = await Schedule.create({
    project: input.projectId,
    owner: userId,
    kind: input.kind,
    cron: input.cron,
    retention: input.retention ?? {},
    enabled: input.enabled ?? true,
  });
  return schedule;
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
  const schedule = await Schedule.findById(scheduleId);
  if (!schedule) throw HttpError.notFound(t('scheduler.error.scheduleNotFound'));
  if (schedule.owner.toString() !== userId) {
    throw HttpError.forbidden(t('scheduler.error.notOwner'));
  }
  return schedule;
}

export async function updateSchedule(
  scheduleId: string,
  userId: string,
  input: UpdateScheduleInput,
  ctx: ServiceCtx = {},
): Promise<ScheduleHydrated> {
  const schedule = await loadOwnedSchedule(scheduleId, userId, ctx);
  if (input.cron !== undefined) schedule.cron = input.cron;
  if (input.enabled !== undefined) schedule.enabled = input.enabled;
  if (input.retention !== undefined) {
    schedule.retention = {
      keepDaily: input.retention.keepDaily ?? schedule.retention.keepDaily,
      keepWeekly: input.retention.keepWeekly ?? schedule.retention.keepWeekly,
      keepMonthly: input.retention.keepMonthly ?? schedule.retention.keepMonthly,
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
  entitlements: EntitlementChecker;
}

/**
 * `POST /enqueue` — enqueue a job now. Accepts either `{ scheduleId }` (use
 * the schedule's kind + retention) or `{ projectId, kind, retention? }`
 * (ad-hoc). Runs the entitlement hook before enqueue; returns 403 on deny.
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

  const allowed = await deps.entitlements.canEnqueue(userId, kind);
  if (!allowed) throw HttpError.forbidden(t('scheduler.error.entitlementDenied'));

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
