import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { allowAllEntitlements } from './scheduler.entitlements.js';
import type { EntitlementChecker, SchedulerQueue } from './scheduler.boundaries.js';
import {
  createSchedule,
  deleteSchedule,
  enqueueNow,
  listSchedulesForUser,
  loadOwnedSchedule,
  updateSchedule,
} from './scheduler.service.js';
import {
  createScheduleSchema,
  enqueueNowSchema,
  scheduleIdParamsSchema,
  updateScheduleSchema,
} from './scheduler.schema.js';
import { serializeSchedule } from './scheduler.serialize.js';
import { extractIp, recordAudit } from '../audit/index.js';
import type { AuditAction } from '../audit/index.js';

export interface ControllerDeps {
  queue: SchedulerQueue;
  entitlements: EntitlementChecker;
}

let deps: ControllerDeps | null = null;

/** Wire the controller to a live queue + entitlement checker (called at boot). */
export function configureSchedulerController(next: ControllerDeps): void {
  deps = next;
}

/** For tests: forget the wiring so a fresh boot can re-configure. */
export function resetSchedulerController(): void {
  deps = null;
}

function requireDeps(): ControllerDeps {
  if (!deps) {
    throw HttpError.internal(
      'scheduler controller not configured — call configureSchedulerController() first',
    );
  }
  return deps;
}

/** Default wiring used when app.ts mounts routes without an explicit configure. */
export function ensureConfigured(fallback: Partial<ControllerDeps> = {}): void {
  if (deps) return;
  const entitlements = fallback.entitlements ?? allowAllEntitlements;
  const queue =
    fallback.queue ??
    ({
      async add() {
        throw HttpError.internal(
          'scheduler queue not configured — starting scheduler runtime failed',
        );
      },
      /* c8 ignore start -- unreachable stubs: no handler queries the fallback queue */
      async activeCountForProject() {
        return 0;
      },
      async waitIdle() {},
      async close() {},
      /* c8 ignore stop */
    } satisfies SchedulerQueue);
  deps = { queue, entitlements };
}

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const input = createScheduleSchema.parse(req.body);
  const schedule = await createSchedule(requireUserId(req.user), input, { t: req.t });
  res.status(201).json({ schedule: serializeSchedule(schedule) });
});

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const schedules = await listSchedulesForUser(requireUserId(req.user));
  res.status(200).json({ schedules: schedules.map(serializeSchedule) });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const { scheduleId } = scheduleIdParamsSchema.parse(req.params);
  const schedule = await loadOwnedSchedule(scheduleId, requireUserId(req.user), {
    t: req.t,
  });
  res.status(200).json({ schedule: serializeSchedule(schedule) });
});

export const patch: RequestHandler = asyncHandler(async (req, res) => {
  const { scheduleId } = scheduleIdParamsSchema.parse(req.params);
  const input = updateScheduleSchema.parse(req.body);
  const schedule = await updateSchedule(scheduleId, requireUserId(req.user), input, {
    t: req.t,
  });
  res.status(200).json({ schedule: serializeSchedule(schedule) });
});

export const remove: RequestHandler = asyncHandler(async (req, res) => {
  const { scheduleId } = scheduleIdParamsSchema.parse(req.params);
  const userId = requireUserId(req.user);
  await deleteSchedule(scheduleId, userId, { t: req.t });
  await recordAudit({
    actorUserId: userId,
    action: 'backup.delete',
    targetType: 'project',
    targetId: scheduleId,
    ip: extractIp(req),
    metadata: { scope: 'schedule' },
  });
  res.status(204).end();
});

function actionForKind(kind: string): AuditAction {
  return kind === 'drill' ? 'backup.restore' : 'backup.run';
}

export const enqueue: RequestHandler = asyncHandler(async (req, res) => {
  const input = enqueueNowSchema.parse(req.body);
  const { queue, entitlements } = requireDeps();
  const userId = requireUserId(req.user);
  const job = await enqueueNow(userId, input, {
    t: req.t,
    queue,
    entitlements,
  });
  await recordAudit({
    actorUserId: userId,
    action: actionForKind(job.data.kind),
    targetType: 'project',
    targetId: job.data.projectId,
    ip: extractIp(req),
    metadata: { jobId: job.id, kind: job.data.kind },
  });
  res.status(202).json({ job: { id: job.id, kind: job.data.kind } });
});
