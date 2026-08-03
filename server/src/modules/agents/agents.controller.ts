import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { extractIp, recordAudit } from '../audit/index.js';
import {
  registerAgentSchema,
  agentIdParamsSchema,
  listJobsQuerySchema,
} from './agents.schema.js';
import { loadOwnedProject } from '../backups/backups.service.js';
import { AgentJob, type AgentJobHydrated } from './agent-jobs.model.js';
import {
  computeFleet,
  deleteAgent,
  effectiveAgentStatus,
  isAgentOutdated,
  listAgentsForUser,
  loadOwnedAgent,
  registerAgent,
  requestDiscoveryRefresh,
  rotateAgentKey,
} from './agents.service.js';
import type { AgentHydrated } from './agents.model.js';
import { buildAgentDiscoveryView, type StoredSnapshot } from './agents.discovery.js';

/** Public shape of a fleet agent — never the API-key hash. */
function serializeAgent(agent: AgentHydrated) {
  return {
    id: String(agent._id),
    name: agent.name,
    host: agent.host,
    port: agent.port,
    status: effectiveAgentStatus(agent),
    lastSeenAt: agent.lastSeenAt ? new Date(agent.lastSeenAt).toISOString() : null,
    agentVersion: agent.agentVersion,
    outdated: isAgentOutdated(agent),
  };
}

export const registerAgentHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const input = registerAgentSchema.parse(req.body);
  const { agent, token } = await registerAgent(userId, input, { t: req.t });
  await recordAudit({
    actorUserId: userId,
    action: 'agent.register',
    targetType: 'agent',
    targetId: String(agent._id),
    ip: extractIp(req),
    metadata: { host: agent.host },
  });
  // token returned once — the agent stores it; we keep only the HMAC.
  res.status(201).json({ agent: serializeAgent(agent), token });
});

export const listAgentsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const agents = await listAgentsForUser(userId);
  res.status(200).json({ agents: agents.map(serializeAgent) });
});

export const rotateAgentKeyHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const { agentId } = agentIdParamsSchema.parse(req.params);
  const { agent, token } = await rotateAgentKey(agentId, userId, { t: req.t });
  await recordAudit({
    actorUserId: userId,
    action: 'agent.rotateKey',
    targetType: 'agent',
    targetId: agentId,
    ip: extractIp(req),
    metadata: {},
  });
  res.status(200).json({ agent: serializeAgent(agent), token });
});

export const deleteAgentHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const { agentId } = agentIdParamsSchema.parse(req.params);
  await deleteAgent(agentId, userId, { t: req.t });
  await recordAudit({
    actorUserId: userId,
    action: 'agent.delete',
    targetType: 'agent',
    targetId: agentId,
    ip: extractIp(req),
    metadata: {},
  });
  res.status(204).end();
});

export const fleetHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const fleet = await computeFleet(userId);
  res.status(200).json({ fleet });
});

const JOB_HISTORY_LIMIT = 50;

/** Public shape of a fleet job for the owner's history view — never secrets. */
function serializeAgentJob(job: AgentJobHydrated) {
  return {
    id: String(job._id),
    kind: job.kind,
    status: job.status,
    createdAt: new Date(job.createdAt).toISOString(),
    startedAt: job.claimedAt ? new Date(job.claimedAt).toISOString() : null,
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    error: job.error,
    restore: job.restorePayload
      ? {
          snapshotId: job.restorePayload.snapshotId,
          overwrite: job.restorePayload.overwrite,
          targetPath: job.restorePayload.targetPath ?? null,
        }
      : null,
    logTail: [...job.logTail],
  };
}

/**
 * Owner-scoped job history for one project. Deliberately NOT gated by the
 * fleet surface — seeing what ran against your own project is basic
 * observability, not a fleet feature. Local (agent-less) projects have no
 * persisted jobs, so this returns [] for them.
 */
export const listProjectJobsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const { projectId } = listJobsQuerySchema.parse(req.query);
  await loadOwnedProject(projectId, userId, { t: req.t });
  // Defense in depth: even though loadOwnedProject already proved ownership,
  // scope the child query by owner too (surface #2 / S2-03) — a stale AgentJob
  // that survives an ownership transfer or a projectId collision cannot leak.
  const jobs = await AgentJob.find({ project: projectId, owner: userId })
    .sort({ createdAt: -1 })
    .limit(JOB_HISTORY_LIMIT);
  res.status(200).json({ jobs: jobs.map(serializeAgentJob) });
});

export const agentDiscoveryHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  const { agentId } = agentIdParamsSchema.parse(req.params);
  const agent = await loadOwnedAgent(agentId, userId, { t: req.t });
  const view = buildAgentDiscoveryView(
    (agent.discovery ?? null) as unknown as StoredSnapshot | null,
  );
  res.status(200).json(view);
});

export const requestAgentDiscoveryRefreshHandler: RequestHandler = asyncHandler(
  async (req, res) => {
    const userId = requireUserId(req.user);
    const { agentId } = agentIdParamsSchema.parse(req.params);
    await requestDiscoveryRefresh(agentId, userId, { t: req.t });
    res.status(204).end();
  },
);
