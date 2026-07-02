import type { RequestHandler } from 'express';
import passport from 'passport';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { HttpError } from '../../shared/utils/http-error.js';
import { extractIp } from '../audit/index.js';
import { ROLE_SUPERADMIN, findUserById, toPublicUser } from '../users/index.js';
import {
  computeFingerprint,
  createLoginChallenge,
  isTrustedDevice,
  verifyLoginChallenge,
} from './login-otp.service.js';
import {
  forgotPasswordSchema,
  loginSchema,
  otpVerifySchema,
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
  if (!req.user) throw HttpError.unauthorized('errors.unauthorized');
  const user = await findUserById(req.user.id);
  /* c8 ignore next -- the JWT strategy already rejects deleted users upstream */
  if (!user) throw HttpError.unauthorized('errors.userNotFound');
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
        next(HttpError.unauthorized('errors.invalidCredentials'));
        return;
      }
      findUserById(user.id)
        .then(async (hydrated) => {
          /* c8 ignore start -- the user was just authenticated; it cannot vanish mid-request */
          if (!hydrated) {
            next(HttpError.unauthorized('errors.userNotFound'));
            return;
          }
          /* c8 ignore stop */
          // Superadmin accounts get a second factor from unknown devices:
          // known device/IP → normal login; unknown → email-OTP challenge,
          // no token issued until the code is verified.
          if (hydrated.role === ROLE_SUPERADMIN) {
            const ip = extractIp(req);
            const userAgent = req.headers['user-agent'];
            const fingerprint = computeFingerprint(ip, userAgent);
            const trusted = await isTrustedDevice(hydrated._id.toString(), fingerprint);
            if (!trusted) {
              const { challengeId } = await createLoginChallenge(hydrated, {
                ip,
                userAgent,
                locale: req.language,
              });
              res.status(200).json({
                otpRequired: true,
                challengeId,
                message: req.t('auth.otp.sent'),
              });
              return;
            }
          }
          res.status(200).json(issueLoginResponse(hydrated));
        })
        .catch(next);
    },
  )(req, res, next);
};

export const verifyOtp: RequestHandler = asyncHandler(async (req, res) => {
  const { challengeId, code } = otpVerifySchema.parse(req.body);
  const user = await verifyLoginChallenge(challengeId, code, {
    ip: extractIp(req),
    userAgent: req.headers['user-agent'],
  });
  // Identical response shape to a normal login.
  res.status(200).json(issueLoginResponse(user));
});

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
  if (!req.user) throw HttpError.unauthorized('errors.unauthorized');
  const user = await findUserById(req.user.id);
  if (!user) throw HttpError.unauthorized('errors.userNotFound');
  if (!user.emailVerified) {
    throw HttpError.forbidden('errors.emailNotVerified', { code: 'EMAIL_NOT_VERIFIED' });
  }
  next();
});
