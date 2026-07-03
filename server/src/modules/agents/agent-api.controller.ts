import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { env } from '../../config/env.js';
import type { AgentPrincipal } from '../../shared/middleware/require-agent-auth.js';
import {
  agentHeartbeatSchema,
  agentJobIdParamsSchema,
  agentJobLogsSchema,
  agentJobResultSchema,
} from './agent-api.schema.js';
import { effectiveAgentStatus, touchAgentHeartbeat } from './agents.service.js';
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
  const input = agentHeartbeatSchema.parse(req.body);
  const agent = await touchAgentHeartbeat(principal.id, {
    version: input.version,
    hostname: input.hostname,
    discovery: input.discovery,
  });
  /* c8 ignore next 3 -- unreachable: the principal was loaded by requireAgentAuth in this request */
  if (!agent) {
    throw HttpError.unauthorized(req.t('agents.error.unauthorized'));
  }
  res.status(200).json({
    agent: {
      id: String(agent._id),
      name: agent.name,
      status: effectiveAgentStatus(agent),
    },
    pollIntervalMs: 10_000,
    heartbeatIntervalMs: Math.floor((env.AGENT_OFFLINE_AFTER_SECONDS * 1000) / 3),
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
