import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  exportConfig,
  importConfig,
  listSelfBackups,
  triggerSelfBackup,
} from './recovery.controller.js';

export const recoveryRouter: Router = Router();

recoveryRouter.use(requireAuth);
recoveryRouter.post('/export', exportConfig);
recoveryRouter.post('/import', importConfig);
recoveryRouter.post('/self-backup', triggerSelfBackup);
recoveryRouter.get('/self-backup', listSelfBackups);
