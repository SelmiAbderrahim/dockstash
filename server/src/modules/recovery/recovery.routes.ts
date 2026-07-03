import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireRole } from '../../shared/middleware/require-role.js';
import { ROLE_SUPERADMIN } from '../users/index.js';
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
// Self-backup is a PLATFORM-wide operation (dumps the whole Dockstash DB into
// the reserved self-backup repo) and its listing returns global rows — gate it
// to superadmins, not any authenticated tenant.
recoveryRouter.post('/self-backup', requireRole(ROLE_SUPERADMIN), triggerSelfBackup);
recoveryRouter.get('/self-backup', requireRole(ROLE_SUPERADMIN), listSelfBackups);
