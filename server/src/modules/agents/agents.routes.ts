import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  deleteAgentHandler,
  fleetHandler,
  listAgentsHandler,
  registerAgentHandler,
  rotateAgentKeyHandler,
} from './agents.controller.js';

export const agentsRouter: Router = Router();

agentsRouter.use(requireAuth);
agentsRouter.get('/', listAgentsHandler);
agentsRouter.post('/', registerAgentHandler);
agentsRouter.get('/fleet', fleetHandler);
agentsRouter.post('/:agentId/rotate-key', rotateAgentKeyHandler);
agentsRouter.delete('/:agentId', deleteAgentHandler);
