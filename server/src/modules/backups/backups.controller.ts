import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import {
  createProjectSchema,
  projectIdParamsSchema,
  scanProjectSchema,
  updatePlanSchema,
} from './backups.schema.js';
import {
  createProject,
  listProjectsForUser,
  loadOwnedProject,
  scanProjectPath,
  updateProjectPlan,
} from './backups.service.js';
import { serializeProject } from './backups.serialize.js';

export const scan: RequestHandler = asyncHandler(async (req, res) => {
  const { path: projectPath } = scanProjectSchema.parse(req.body);
  const plan = await scanProjectPath(projectPath, { t: req.t });
  res.status(200).json({ plan });
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const input = createProjectSchema.parse(req.body);
  const project = await createProject(requireUserId(req.user), input, { t: req.t });
  res.status(201).json({ project: serializeProject(project) });
});

export const list: RequestHandler = asyncHandler(async (req, res) => {
  const projects = await listProjectsForUser(requireUserId(req.user));
  res.status(200).json({ projects: projects.map(serializeProject) });
});

export const get: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const project = await loadOwnedProject(projectId, requireUserId(req.user), { t: req.t });
  res.status(200).json({ project: serializeProject(project) });
});

export const patchPlan: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const { plan } = updatePlanSchema.parse(req.body);
  const project = await updateProjectPlan(
    projectId,
    requireUserId(req.user),
    { paths: plan.paths, databases: plan.databases.map((d) => ({ ...d, enabled: d.enabled ?? true })), configs: plan.configs },
    { t: req.t },
  );
  res.status(200).json({ project: serializeProject(project) });
});
