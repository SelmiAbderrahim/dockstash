import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import {
  alertsConfigSchema,
  assignAgentSchema,
  createProjectSchema,
  mirrorConfigSchema,
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
  updateProjectAlerts,
  updateProjectMirror,
  updateProjectPlan,
} from './backups.service.js';
import {
  discoverContainers,
  discoverFolders,
  makeDiscoveryDockerClient,
} from './backups.discover.js';
import { serializeProject } from './backups.serialize.js';
import {
  assertAlertsAllowed,
  assertMirrorAllowed,
  reserveProjectSlot,
  releaseProjectSlot,
} from '../billing/entitlements.service.js';
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
  // Pointing a project at a fleet agent is owner-scoped only — createProject →
  // loadOwnedAgent 404s a foreign/unknown agentId. The agent cap was paid at
  // registration time, so no per-project plan gate here.
  // Reserve a slot BEFORE creating the record — the atomic counter closes the
  // TOCTOU window between countDocuments and Project.create (S3-01/S3-03).
  await reserveProjectSlot(userId, { t: req.t });
  try {
    const project = await createProject(userId, input, { t: req.t });
    res.status(201).json({ project: serializeProject(project) });
  } catch (err) {
    // Rollback the reservation if createProject failed.
    await releaseProjectSlot(userId);
    throw err;
  }
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

/** Per-project outbound alert webhook (Pro+ — same tier as email alerts). */
export const patchAlerts: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const { webhookUrl } = alertsConfigSchema.parse(req.body);
  const userId = requireUserId(req.user);
  await assertAlertsAllowed(userId, { t: req.t });
  const project = await updateProjectAlerts(projectId, userId, webhookUrl, {
    t: req.t,
  });
  res.status(200).json({ project: serializeProject(project) });
});

/** One-way mirror config (Business tier). */
export const patchMirror: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const input = mirrorConfigSchema.parse(req.body);
  const userId = requireUserId(req.user);
  await assertMirrorAllowed(userId, { t: req.t });
  const project = await updateProjectMirror(projectId, userId, input, { t: req.t });
  res.status(200).json({ project: serializeProject(project) });
});

export const patchAgent: RequestHandler = asyncHandler(async (req, res) => {
  const { projectId } = projectIdParamsSchema.parse(req.params);
  const { agentId } = assignAgentSchema.parse(req.body);
  const userId = requireUserId(req.user);
  // Assignment is owner-scoped only: updateProjectAgent → loadOwnedAgent 404s a
  // foreign agentId. The cap was already paid when the agent was registered.
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
