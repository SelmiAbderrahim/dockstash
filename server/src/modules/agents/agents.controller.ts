import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import { assertMultiVpsAllowed } from '../billing/entitlements.service.js';
import { registerAgentSchema, agentIdParamsSchema } from './agents.schema.js';
import {
  computeFleet,
  heartbeatAgent,
  listAgentsForUser,
  registerAgent,
} from './agents.service.js';
import type { AgentHydrated } from './agents.model.js';

/** Multi-VPS fleet is a Business feature — gate every agent operation. */
function serializeAgent(agent: AgentHydrated) {
  return {
    id: String(agent._id),
    name: agent.name,
    host: agent.host,
    port: agent.port,
    status: agent.status,
    lastSeenAt: agent.lastSeenAt ? new Date(agent.lastSeenAt).toISOString() : null,
  };
}

export const registerAgentHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
  const input = registerAgentSchema.parse(req.body);
  const { agent, apiKey } = await registerAgent(userId, input);
  // apiKey returned once — the agent stores it; we keep only the ciphertext.
  res.status(201).json({ agent: serializeAgent(agent), apiKey });
});

export const listAgentsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
  const agents = await listAgentsForUser(userId);
  res.status(200).json({ agents: agents.map(serializeAgent) });
});

export const heartbeatAgentHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
  const { agentId } = agentIdParamsSchema.parse(req.params);
  const agent = await heartbeatAgent(agentId, userId, { t: req.t });
  res.status(200).json({ agent: serializeAgent(agent) });
});

export const fleetHandler: RequestHandler = asyncHandler(async (req, res) => {
  const userId = requireUserId(req.user);
  await assertMultiVpsAllowed(userId, { t: req.t });
  const fleet = await computeFleet(userId);
  res.status(200).json({ fleet });
});
