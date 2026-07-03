import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import {
  assignAgentSchema,
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
  updateProjectAgent,
  updateProjectPlan,
} from './backups.service.js';
import {
  discoverContainers,
  discoverFolders,
  makeDiscoveryDockerClient,
} from './backups.discover.js';
import { serializeProject } from './backups.serialize.js';
import { assertMultiVpsAllowed } from '../billing/entitlements.service.js';
import { extractIp, recordAudit } from '../audit/index.js';

export const scan: RequestHandler = asyncHandler(async (req, res) => {
  const { path: projectPath } = scanProjectSchema.parse(req.body);
  const plan = await scanProjectPath(projectPath, { t: req.t });
  res.status(200).json({ plan });
});

export const listFolders: RequestHandler = asyncHandler(async (req, res) => {
  const folders = await discoverFolders({ t: req.t });
  res.status(200).json({ folders });
});

export const listContainers: RequestHandler = asyncHandler(async (req, res) => {
  const result = await discoverContainers({
    dockerClient: makeDiscoveryDockerClient(),
    t: req.t,
  });
  res.status(200).json(result);
});

export const create: RequestHandler = asyncHandler(async (req, res) => {
  const input = createProjectSchema.parse(req.body);
  const userId = requireUserId(req.user);
  // Assigning to a fleet agent at creation is a Business-tier operation.
  if (input.agentId) await assertMultiVpsAllowed(userId, { t: req.t });
  const project = await createProject(userId, input, { t: req.t });
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

export const patchAgent: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const { agentId } = assignAgentSchema.parse(req.body);
  const userId = requireUserId(req.user);
  // Assignment (and unassignment) is a Business-tier fleet operation.
  await assertMultiVpsAllowed(userId, { t: req.t });
  const project = await updateProjectAgent(projectId, userId, agentId, { t: req.t });
  await recordAudit({
    actorUserId: userId,
    action: 'agent.assign',
    targetType: 'project',
    targetId: projectId,
    ip: extractIp(req),
    metadata: { agentId },
  });
  res.status(200).json({ project: serializeProject(project) });
});
