import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { assertMultiVpsAllowed } from '../billing/entitlements.service.js';
import { extractIp, recordAudit } from '../audit/index.js';
import { registerAgentSchema, agentIdParamsSchema } from './agents.schema.js';
import {
  computeFleet,
  deleteAgent,
  effectiveAgentStatus,
  listAgentsForUser,
  loadOwnedAgent,
  registerAgent,
  rotateAgentKey,
} from './agents.service.js';
import type { AgentHydrated } from './agents.model.js';
import { buildAgentDiscoveryView, type StoredSnapshot } from './agents.discovery.js';

/** Multi-VPS fleet is a Business feature — gate every agent operation. */
function serializeAgent(agent: AgentHydrated) {
  return {
    id: String(agent._id),
    name: agent.name,
    host: agent.host,
    port: agent.port,
    status: effectiveAgentStatus(agent),
    lastSeenAt: agent.lastSeenAt ? new Date(agent.lastSeenAt).toISOString() : null,
  };
}

export const registerAgentHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
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
  await assertMultiVpsAllowed(userId, { t: req.t });
  const agents = await listAgentsForUser(userId);
  res.status(200).json({ agents: agents.map(serializeAgent) });
});

export const rotateAgentKeyHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
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
  await assertMultiVpsAllowed(userId, { t: req.t });
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
  await assertMultiVpsAllowed(userId, { t: req.t });
  const fleet = await computeFleet(userId);
  res.status(200).json({ fleet });
});

export const agentDiscoveryHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
  const { agentId } = agentIdParamsSchema.parse(req.params);
  const agent = await loadOwnedAgent(agentId, userId, { t: req.t });
  const view = buildAgentDiscoveryView(
    (agent.discovery ?? null) as unknown as StoredSnapshot | null,
  );
  res.status(200).json(view);
});
