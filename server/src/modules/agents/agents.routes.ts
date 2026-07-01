import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  fleetHandler,
  heartbeatAgentHandler,
  listAgentsHandler,
  registerAgentHandler,
} from './agents.controller.js';

export const agentsRouter: Router = Router();

agentsRouter.use(requireAuth);
agentsRouter.get('/', listAgentsHandler);
agentsRouter.post('/', registerAgentHandler);
agentsRouter.get('/fleet', fleetHandler);
agentsRouter.post('/:agentId/heartbeat', heartbeatAgentHandler);
