import { Router } from 'express';
import {
  changeRole,
  deleteUser,
  getAudit,
  getBilling,
  getStats,
  getSystem,
  listUsersHandler,
  updateLegalHold,
  verifyUser,
} from './superadmin.controller.js';

// Auth gating (requireAuth + requireVerified + requireRole(Superadmin)) is
// applied at the mount point in app.ts.
export const superadminRouter: Router = Router();

superadminRouter.get('/stats', getStats);
superadminRouter.get('/users', listUsersHandler);
superadminRouter.patch('/users/:id/role', changeRole);
superadminRouter.post('/users/:id/verify', verifyUser);
superadminRouter.patch('/users/:id/legal-hold', updateLegalHold);
superadminRouter.delete('/users/:id', deleteUser);
superadminRouter.get('/billing', getBilling);
superadminRouter.get('/audit', getAudit);
superadminRouter.get('/system', getSystem);
