import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireCsrf } from '../../shared/middleware/csrf.js';
import { deleteMyAccount, exportMyData } from './legal.controller.js';

export const legalRouter: Router = Router();

legalRouter.post('/export', requireAuth, exportMyData);
legalRouter.post('/delete-account', requireAuth, requireCsrf, deleteMyAccount);
