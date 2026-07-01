import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { projectIdParamsSchema, runCheckSchema } from './backups.schema.js';
import {
  runResticCheck,
  runRestoreDrill,
  type RunCheckDeps,
  type RunDrillDeps,
} from './backups.verify.service.js';
import { loadOwnedProject } from './backups.service.js';
import { serializeProject } from './backups.serialize.js';
import { assertRestoreDrillAllowed } from '../billing/entitlements.service.js';

/**
 * Boundary implementations for check/drill are supplied by the scheduler layer
 * (prompt 05). The HTTP endpoints exist so an operator can trigger a run on
 * demand; the factories are pulled out here so tests can override them without
 * monkey-patching.
 */
export interface VerifyControllerDeps {
  makeCheckDeps: () => Omit<RunCheckDeps, 't' | 'readDataSubset'>;
  makeDrillDeps: () => Omit<RunDrillDeps, 't'>;
}

let controllerDeps: VerifyControllerDeps | null = null;

export function configureVerifyController(deps: VerifyControllerDeps): void {
  controllerDeps = deps;
}

export function resetVerifyController(): void {
  controllerDeps = null;
}

function assertConfigured(): VerifyControllerDeps {
  if (!controllerDeps) {
    throw HttpError.internal('verify controller not configured');
  }
  return controllerDeps;
}

export const check: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  /* c8 ignore next -- strict body-parser always yields an object body, so the ?? {} fallback never fires */
  const { readDataSubset } = runCheckSchema.parse(req.body ?? {});
  const cfg = assertConfigured();
  const base = cfg.makeCheckDeps();
  const result = await runResticCheck(projectId, requireUserId(req.user), {
    ...base,
    t: req.t,
    readDataSubset,
  });
  const project = await loadOwnedProject(projectId, requireUserId(req.user), {
    t: req.t,
  });
  res.status(200).json({ result, project: serializeProject(project) });
});

export const drill: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const userId = requireUserId(req.user);
  // Automated restore-drill verification is a Pro+ feature.
  await assertRestoreDrillAllowed(userId, { t: req.t });
  const cfg = assertConfigured();
  const base = cfg.makeDrillDeps();
  const result = await runRestoreDrill(projectId, requireUserId(req.user), {
    ...base,
    t: req.t,
  });
  const project = await loadOwnedProject(projectId, requireUserId(req.user), {
    t: req.t,
  });
  res.status(200).json({ result, project: serializeProject(project) });
});
