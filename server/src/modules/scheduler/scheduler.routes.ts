import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  create,
  enqueue,
  ensureConfigured,
  get,
  list,
  patch,
  remove,
} from './scheduler.controller.js';

ensureConfigured();

export const schedulerRouter: Router = Router();

schedulerRouter.use(requireAuth);
schedulerRouter.post('/schedules', create);
schedulerRouter.get('/schedules', list);
schedulerRouter.get('/schedules/:scheduleId', get);
schedulerRouter.patch('/schedules/:scheduleId', patch);
schedulerRouter.delete('/schedules/:scheduleId', remove);
schedulerRouter.post('/enqueue', enqueue);
