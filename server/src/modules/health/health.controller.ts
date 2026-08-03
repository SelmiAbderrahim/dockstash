import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { Project } from '../backups/backups.model.js';
import { projectIdParamsSchema } from '../backups/backups.schema.js';
import { runHealthCheck, type HealthDeps } from './health.service.js';
import {
  getHealthOverview,
  getProjectHealth,
  listAlerts,
  markAlertsRead,
} from './health.backup-health.service.js';
import { listAlertsQuerySchema, markAlertsReadSchema } from './health.schema.js';

let healthDeps: HealthDeps = {};

export function configureHealthController(deps: HealthDeps): void {
  healthDeps = deps;
}

export function resetHealthController(): void {
  healthDeps = {};
}

export const health: RequestHandler = asyncHandler(async (_req, res) => {
  const result = await runHealthCheck(healthDeps);
  res.status(result.status === 'ok' ? 200 : 503).json(result);
});

export const metrics: RequestHandler = asyncHandler(async (_req, res) => {
  const totalProjects = await Project.countDocuments({});
  const failedProjects = await Project.countDocuments({ lastStatus: 'failed' });
  const successfulProjects = await Project.countDocuments({ lastStatus: 'success' });
  res.status(200).json({
    projects: {
      total: totalProjects,
      failed: failedProjects,
      succeeded: successfulProjects,
    },
    timestamp: new Date().toISOString(),
  });
});

/** Backup-health dashboard snapshot: per-project verdicts + unread count. */
export const overview: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const result = await getHealthOverview(userId);
  res.status(200).json(result);
});

/** Single-project health verdict (404/403 like the backups module). */
export const projectHealthDetail: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const userId = requireUserId(req.user);
  const project = await getProjectHealth(projectId, userId, { t: req.t });
  res.status(200).json({ project });
});

/** Alert-center feed (newest first, capped page). `?unread=true` filters. */
export const alerts: RequestHandler = asyncHandler(async (req, res) => {
  const { unread } = listAlertsQuerySchema.parse(req.query);
  const userId = requireUserId(req.user);
  const rows = await listAlerts(userId, { unreadOnly: unread });
  res.status(200).json({ alerts: rows });
});

/** Mark alerts read; empty body = mark all unread for the owner. */
export const markRead: RequestHandler = asyncHandler(async (req, res) => {
  /* c8 ignore next -- strict body-parser always yields an object body */
  const { ids } = markAlertsReadSchema.parse(req.body ?? {});
  const userId = requireUserId(req.user);
  const marked = await markAlertsRead(userId, ids);
  res.status(200).json({ marked });
});

export const projectHealth: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const projects = await Project.find({ owner: userId }).select(
    'name lastStatus lastRunAt lastSuccessAt lastDrillAt lastDrillStatus lastCheckAt lastCheckStatus',
  );
  res.status(200).json({
    projects: projects.map((project) => ({
      id: String(project._id),
      name: project.name,
      lastStatus: project.lastStatus,
      lastRunAt: project.lastRunAt ? project.lastRunAt.toISOString() : null,
      lastSuccessAt: project.lastSuccessAt
        ? project.lastSuccessAt.toISOString()
        : null,
      lastDrillAt: project.lastDrillAt ? project.lastDrillAt.toISOString() : null,
      lastDrillStatus: project.lastDrillStatus,
      lastCheckAt: project.lastCheckAt ? project.lastCheckAt.toISOString() : null,
      lastCheckStatus: project.lastCheckStatus,
    })),
  });
});
