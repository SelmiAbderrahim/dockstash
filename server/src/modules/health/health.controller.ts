import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { Project } from '../backups/backups.model.js';
import { runHealthCheck, type HealthDeps } from './health.service.js';

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
