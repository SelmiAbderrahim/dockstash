import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  forgotPassword,
  login,
  refresh,
  resendVerification,
  resetPassword,
  signup,
  verifyEmail,
} from './auth.controller.js';
import { oauthCallback, oauthProviders, oauthStart } from './oauth/oauth.controller.js';

export const authRouter: Router = Router();

// Capability probe, mounted separately BEFORE the rate-limited authRouter
// (see app.ts) — fetched on every login/register render.
export const oauthPublicRouter: Router = Router();
oauthPublicRouter.get('/providers', oauthProviders);

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/refresh', requireAuth, refresh);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password/:token', resetPassword);
authRouter.post('/verify-email/:token', verifyEmail);
authRouter.post('/resend-verification', resendVerification);
// OAuth sign-in. Provider validation happens in the controller (unknown or
// unconfigured providers 404) so the routes stay plain-path.
authRouter.get('/:provider/start', oauthStart);
authRouter.get('/:provider/callback', oauthCallback);
