import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  forgotPassword,
  login,
  refresh,
  requireRole,
  resetPassword,
  signup,
} from './auth.controller.js';
import { ROLE_ADMIN } from '../users/index.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/refresh', requireAuth, refresh);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password/:token', resetPassword);

export const protectedRouter: Router = Router();

protectedRouter.get('/protected', requireAuth, (_req, res) => {
  res.json({ content: 'The protected test route is functional!' });
});

protectedRouter.get('/admins-only', requireAuth, requireRole(ROLE_ADMIN), (_req, res) => {
  res.json({ content: 'Admin dashboard is working.' });
});
