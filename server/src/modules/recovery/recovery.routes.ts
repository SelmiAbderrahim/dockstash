import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  enableRecoveryCodes,
  exportConfig,
  importConfig,
  listSelfBackups,
  triggerSelfBackup,
} from './recovery.controller.js';

export const recoveryRouter: Router = Router();

recoveryRouter.use(requireAuth);
recoveryRouter.post('/export', exportConfig);
recoveryRouter.post('/import', importConfig);
recoveryRouter.post('/recovery-codes', enableRecoveryCodes);
recoveryRouter.post('/self-backup', triggerSelfBackup);
recoveryRouter.get('/self-backup', listSelfBackups);
