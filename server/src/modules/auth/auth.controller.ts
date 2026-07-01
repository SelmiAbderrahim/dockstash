import type { RequestHandler } from 'express';
import passport from 'passport';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { findUserById, toPublicUser } from '../users/index.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema,
  verifyEmailParamsSchema,
} from './auth.schema.js';
import {
  generateResetToken,
  issueLoginResponse,
  registerUser,
  resendVerification as resendVerificationService,
  resetPasswordWithToken,
  signToken,
  verifyEmailWithToken,
} from './auth.service.js';

export const signup: RequestHandler = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input, req.language);
  res.status(201).json(result);
});

export const verifyEmail: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = verifyEmailParamsSchema.parse(req.params);
  await verifyEmailWithToken(token);
  res.status(200).json({ message: req.t('auth.verify.success') });
});

export const resendVerification: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = resendVerificationSchema.parse(req.body);
  await resendVerificationService(email, req.language);
  // Generic response regardless of account state — no account enumeration.
  res.status(200).json({ message: req.t('auth.verify.resent') });
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  /* c8 ignore next -- requireAuth guarantees req.user before this handler runs */
  if (!req.user) throw HttpError.unauthorized('Authentication required.');
  const user = await findUserById(req.user.id);
  /* c8 ignore next -- the JWT strategy already rejects deleted users upstream */
  if (!user) throw HttpError.unauthorized('User no longer exists.');
  const publicUser = toPublicUser(user);
  res.status(200).json({ token: `JWT ${signToken(publicUser)}`, user: publicUser });
});

export const login: RequestHandler = (req, res, next) => {
  // Validate shape first; passport-local needs both fields.
  loginSchema.parse(req.body);
  passport.authenticate(
    'local',
    { session: false },
    (err: unknown, user: Express.User | false) => {
      /* c8 ignore start -- passport-local only errors on an internal DB fault */
      if (err) {
        next(err);
        return;
      }
      /* c8 ignore stop */
      if (!user) {
        next(HttpError.unauthorized('Invalid email or password.'));
        return;
      }
      findUserById(user.id)
        .then((hydrated) => {
          /* c8 ignore start -- the user was just authenticated; it cannot vanish mid-request */
          if (!hydrated) {
            next(HttpError.unauthorized('User no longer exists.'));
            return;
          }
          /* c8 ignore stop */
          res.status(200).json(issueLoginResponse(hydrated));
        })
        .catch(next);
    },
  )(req, res, next);
};

export const forgotPassword: RequestHandler = asyncHandler(async (req, res) => {
  const { email } = forgotPasswordSchema.parse(req.body);
  await generateResetToken(email);
  res.status(200).json({
    message: 'Please check your email for the link to reset your password.',
  });
});

export const resetPassword: RequestHandler = asyncHandler(async (req, res) => {
  const { token } = resetPasswordParamsSchema.parse(req.params);
  const { password } = resetPasswordSchema.parse(req.body);
  await resetPasswordWithToken(token, password);
  res.status(200).json({
    message: 'Password changed successfully. Please login with your new password.',
  });
});

/**
 * Hard gate: an authenticated user whose email is not verified is blocked from
 * product routes. Runs after `requireAuth`. The `code` in details lets the
 * client branch on the machine-readable reason rather than translated text.
 */
export const requireVerified: RequestHandler = asyncHandler(async (req, _res, next) => {
  if (!req.user) throw HttpError.unauthorized('Authentication required.');
  const user = await findUserById(req.user.id);
  if (!user) throw HttpError.unauthorized('No user was found.');
  if (!user.emailVerified) {
    throw HttpError.forbidden('errors.emailNotVerified', { code: 'EMAIL_NOT_VERIFIED' });
  }
  next();
});
