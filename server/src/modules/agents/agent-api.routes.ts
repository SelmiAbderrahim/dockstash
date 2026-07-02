import { Router } from 'express';
import { requireAgentAuth } from '../../shared/middleware/require-agent-auth.js';
import {
  agentClaimJobHandler,
  agentHeartbeatHandler,
  agentJobLogsHandler,
  agentJobResultHandler,
} from './agent-api.controller.js';

/**
 * Machine surface for fleet agent daemons. Self-authenticating via the
 * composite Bearer token — no JWT, no CSRF (Authorization-header exempt),
 * CORS irrelevant (non-browser clients).
 */
export const agentApiRouter: Router = Router();

agentApiRouter.use(requireAgentAuth);
agentApiRouter.post('/heartbeat', agentHeartbeatHandler);
agentApiRouter.post('/jobs/claim', agentClaimJobHandler);
agentApiRouter.post('/jobs/:jobId/logs', agentJobLogsHandler);
agentApiRouter.post('/jobs/:jobId/result', agentJobResultHandler);
