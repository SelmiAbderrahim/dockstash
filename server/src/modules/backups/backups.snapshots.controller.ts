import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { pitrQuerySchema, projectIdParamsSchema } from './backups.schema.js';
import { loadOwnedProject } from './backups.service.js';
import { serializeSnapshot } from './backups.serialize.js';
import { pickNearestSnapshot } from './backups.pitr.js';
import type { ResticSnapshotDetail } from './backups.restic-runner.js';
import { ProcessResticRunner } from './backups.restic-runner.js';
import { resolveProjectRunner } from './backups.runner-factory.js';

/** Boundary: list raw restic snapshot records for an (owned) project repo. */
export interface SnapshotsControllerDeps {
  listSnapshots(projectId: string, owner: string): Promise<ResticSnapshotDetail[]>;
}

let deps: SnapshotsControllerDeps | null = null;

/** Wire the controller to a live snapshot lister (called at boot). */
export function configureSnapshotsController(next: SnapshotsControllerDeps): void {
  deps = next;
}

/** For tests: forget the wiring so a fresh boot can re-configure. */
export function resetSnapshotsController(): void {
  deps = null;
}

/**
 * Production lister: resolve the project's concrete runner and read
 * `snapshots --json`. Detailed records come from the process runner; any
 * other runner degrades to the narrow id/time shape.
 */
export function makeProductionSnapshotLister(): SnapshotsControllerDeps {
  return {
    async listSnapshots(projectId, owner) {
      const runner = await resolveProjectRunner(projectId, owner);
      /* c8 ignore start -- defensive: production always resolves a ProcessResticRunner */
      if (!(runner instanceof ProcessResticRunner)) {
        const narrow = await runner.snapshots();
        return narrow.map((s) => ({ id: s.id, short_id: s.id, time: s.time }));
      }
      /* c8 ignore stop */
      return runner.snapshotsDetailed();
    },
  };
}

export const listProjectSnapshots: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const userId = requireUserId(req.user);
  // Ownership check first — 404/403 before any storage access.
  await loadOwnedProject(projectId, userId, { t: req.t });
  if (!deps) {
    throw new HttpError(503, req.t('backups.error.runnerUnavailable'));
  }
  let records: ResticSnapshotDetail[];
  try {
    records = await deps.listSnapshots(projectId, userId);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, req.t('backups.error.snapshotsFailed', { message }));
  }
  res.status(200).json({
    snapshots: records.map((s) => serializeSnapshot(s, projectId)),
  });
});

/**
 * Point-in-time resolver (Pro+): newest snapshot at or before `?ts=`. The
 * client confirms the resolution, then enqueues a normal restore with the
 * returned snapshot id — this endpoint never mutates anything.
 */
export const resolvePitr: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const { ts } = pitrQuerySchema.parse(req.query);
  const userId = requireUserId(req.user);
  // Ownership check first — 404/403 before any storage access.
  await loadOwnedProject(projectId, userId, { t: req.t });
  if (!deps) {
    throw new HttpError(503, req.t('backups.error.runnerUnavailable'));
  }
  let records: ResticSnapshotDetail[];
  try {
    records = await deps.listSnapshots(projectId, userId);
  } catch (err) {
    if (err instanceof HttpError) throw err;
    const message = err instanceof Error ? err.message : String(err);
    throw new HttpError(502, req.t('backups.error.snapshotsFailed', { message }));
  }
  const target = new Date(ts);
  const resolved = pickNearestSnapshot(records, target);
  if (!resolved) {
    throw HttpError.notFound(req.t('backups.error.noSnapshotBeforeTs', { ts }));
  }
  res.status(200).json({
    target: target.toISOString(),
    gapSeconds: resolved.gapSeconds,
    snapshot: serializeSnapshot(resolved.snapshot, projectId),
  });
});
