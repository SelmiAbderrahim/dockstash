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
  verifyOtp,
} from './auth.controller.js';

export const authRouter: Router = Router();

authRouter.post('/signup', signup);
authRouter.post('/login', login);
authRouter.post('/otp/verify', verifyOtp);
authRouter.post('/refresh', requireAuth, refresh);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password/:token', resetPassword);
authRouter.post('/verify-email/:token', verifyEmail);
authRouter.post('/resend-verification', resendVerification);
