import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireCsrf } from '../../shared/middleware/csrf.js';
import { createExportRateLimiter } from '../../shared/middleware/rate-limit.js';
import { deleteMyAccount, exportMyData } from './legal.controller.js';

export const legalRouter: Router = Router();

legalRouter.post('/export', createExportRateLimiter(), requireAuth, exportMyData);
legalRouter.post('/delete-account', requireAuth, requireCsrf, deleteMyAccount);
