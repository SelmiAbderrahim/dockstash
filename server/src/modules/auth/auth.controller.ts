import type { RequestHandler } from 'express';
import passport from 'passport';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { findUserById, getRoleRank, toPublicUser } from '../users/index.js';
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordParamsSchema,
  resetPasswordSchema,
} from './auth.schema.js';
import {
  generateResetToken,
  issueLoginResponse,
  registerUser,
  resetPasswordWithToken,
  signToken,
} from './auth.service.js';

export const signup: RequestHandler = asyncHandler(async (req, res) => {
  const input = registerSchema.parse(req.body);
  const result = await registerUser(input);
  res.status(201).json(result);
});

export const refresh: RequestHandler = asyncHandler(async (req, res) => {
  if (!req.user) throw HttpError.unauthorized('Authentication required.');
  const user = await findUserById(req.user.id);
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
      if (err) {
        next(err);
        return;
      }
      if (!user) {
        next(HttpError.unauthorized('Invalid email or password.'));
        return;
      }
      findUserById(user.id)
        .then((hydrated) => {
          if (!hydrated) {
            next(HttpError.unauthorized('User no longer exists.'));
            return;
          }
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

export function requireRole(role: string): RequestHandler {
  return asyncHandler(async (req, _res, next) => {
    if (!req.user) throw HttpError.unauthorized('Authentication required.');
    const user = await findUserById(req.user.id);
    if (!user) throw HttpError.unauthorized('No user was found.');
    if (getRoleRank(user.role) < getRoleRank(role)) {
      throw HttpError.forbidden('You are not authorized to view this content.');
    }
    next();
  });
}
