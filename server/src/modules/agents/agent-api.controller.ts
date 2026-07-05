import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import type { AgentPrincipal } from '../../shared/middleware/require-agent-auth.js';
import {
  agentHeartbeatCoreSchema,
  agentDiscoveryInput,
  type AgentDiscoveryInput,
  agentJobIdParamsSchema,
  agentJobLogsSchema,
  agentJobResultSchema,
} from './agent-api.schema.js';
import {
  EXPECTED_AGENT_VERSION,
  consumeDiscoveryRefreshRequest,
  effectiveAgentStatus,
  touchAgentHeartbeat,
} from './agents.service.js';
import { appendJobLogs, claimNextJob, completeJob } from './agent-jobs.service.js';

/** The middleware always sets req.agent on this surface; guard for typing. */
function requireAgent(agent: AgentPrincipal | undefined): AgentPrincipal {
  /* c8 ignore next 3 -- unreachable behind requireAgentAuth; typing guard */
  if (!agent) {
    throw HttpError.unauthorized('agents.error.unauthorized');
  }
  return agent;
}

export const agentHeartbeatHandler: RequestHandler = asyncHandler(async (req, res) => {
  const principal = requireAgent(req.agent);
  // Liveness fields are parsed on their own so a malformed discovery snapshot can
  // never reject the heartbeat and flap the agent offline.
  const core = agentHeartbeatCoreSchema.parse(req.body);
  const rawDiscovery = (req.body as { discovery?: unknown } | undefined)?.discovery;
  let discovery: AgentDiscoveryInput | undefined;
  if (rawDiscovery !== undefined) {
    const parsed = agentDiscoveryInput.safeParse(rawDiscovery);
    if (parsed.success) {
      discovery = parsed.data;
    } else {
      // Keep the agent online; just skip this snapshot and tell the operator why.
      logger.warn(
        { agentId: principal.id, issues: parsed.error.issues },
        'agent discovery payload rejected; recording heartbeat without discovery',
      );
    }
  }
  const agent = await touchAgentHeartbeat(principal.id, {
    version: core.version,
    hostname: core.hostname,
    discovery,
  });
  /* c8 ignore next 3 -- unreachable: the principal was loaded by requireAgentAuth in this request */
  if (!agent) {
    throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
  }
  const refreshDiscovery = await consumeDiscoveryRefreshRequest(principal.id);
  res.status(200).json({
    agent: {
      id: String(agent._id),
      name: agent.name,
      status: effectiveAgentStatus(agent),
    },
    pollIntervalMs: 10_000,
    heartbeatIntervalMs: Math.floor((env.AGENT_OFFLINE_AFTER_SECONDS * 1000) / 3),
    // Lets a stale daemon warn in its own logs (see agent/src/poller.ts).
    latestVersion: EXPECTED_AGENT_VERSION,
    ...(refreshDiscovery ? { refreshDiscovery: true } : {}),
  });
});

export const agentClaimJobHandler: RequestHandler = asyncHandler(async (req, res) => {
  const principal = requireAgent(req.agent);
  const job = await claimNextJob(principal, { t: req.t });
  if (!job) {
    res.status(204).end();
    return;
  }
  res.status(200).json({ job });
});

export const agentJobLogsHandler: RequestHandler = asyncHandler(async (req, res) => {
  const principal = requireAgent(req.agent);
  const { jobId } = agentJobIdParamsSchema.parse(req.params);
  const { lines } = agentJobLogsSchema.parse(req.body);
  await appendJobLogs(principal, jobId, lines, { t: req.t });
  res.status(204).end();
});

export const agentJobResultHandler: RequestHandler = asyncHandler(async (req, res) => {
  const principal = requireAgent(req.agent);
  const { jobId } = agentJobIdParamsSchema.parse(req.params);
  const input = agentJobResultSchema.parse(req.body);
  const job = await completeJob(principal, jobId, input, { t: req.t });
  res.status(200).json({ status: job.status });
});
