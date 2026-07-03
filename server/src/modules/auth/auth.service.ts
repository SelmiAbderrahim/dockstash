import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { HttpError } from '../../shared/utils/http-error.js';
import {
  deliverPasswordChangedEmail,
  deliverPasswordResetEmail,
  deliverVerificationEmail,
} from '../communication/index.js';
import { DEFAULT_LOCALE, type SupportedLocale } from '../../shared/i18n/index.js';
import {
  ROLE_MEMBER,
  User,
  type PublicUser,
  type UserHydrated,
  toPublicUser,
} from '../users/index.js';

const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const SALT_ROUNDS = 10;

function verifyUrlFor(token: string): string {
  return `${env.CLIENT_URL.replace(/\/$/, '')}/verify-email/${token}`;
}

/**
 * Hash single-use email tokens (password-reset + email-verification) before
 * they touch the DB. The raw token is emailed to the user; only its SHA-256
 * digest is stored, so a DB read (dump, backup, replica) cannot be replayed to
 * hijack a reset or forge a verification. Mirrors how OTP codes and agent API
 * secrets are already hashed at rest. Tokens are 96 hex chars of CSPRNG entropy,
 * so a plain (unsalted) SHA-256 is sufficient — there is nothing to brute-force.
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

async function issueVerificationToken(
  user: UserHydrated,
  locale: SupportedLocale,
): Promise<void> {
  const token = randomBytes(48).toString('hex');
  user.emailVerificationToken = hashToken(token);
  user.emailVerificationExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  await user.save();
  // `sendEmail` swallows transport errors internally (logs + returns), so this
  // never rejects — a missing/failed email just means the user resends.
  await deliverVerificationEmail(user.email, verifyUrlFor(token), locale);
}

export type IssuedToken = {
  token: string;
  user: PublicUser;
};

export function signToken(user: PublicUser): string {
  return jwt.sign(
    { _id: user.id, id: user.id, email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: JWT_TTL_SECONDS },
  );
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hashed: string): Promise<boolean> {
  return bcrypt.compare(plain, hashed);
}

export async function registerUser(
  input: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  },
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<IssuedToken> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw HttpError.conflict('errors.emailAlreadyRegistered');
  }

  const passwordHash = await hashPassword(input.password);
  const created = (await User.create({
    email: input.email,
    password: passwordHash,
    profile: { firstName: input.firstName, lastName: input.lastName },
    role: ROLE_MEMBER,
    language: locale,
  })) as UserHydrated;

  // New accounts start unverified; issue the first verification link. The
  // account is still logged in (token below) but product routes are gated by
  // requireVerified until the email is confirmed.
  await issueVerificationToken(created, locale);

  const publicUser = toPublicUser(created);
  return { token: `JWT ${signToken(publicUser)}`, user: publicUser };
}

/**
 * Consume a verification token: flips `emailVerified` and clears the token.
 * Mirrors {@link resetPasswordWithToken}.
 */
export async function verifyEmailWithToken(token: string): Promise<UserHydrated> {
  const user = await User.findOne({
    emailVerificationToken: hashToken(token),
    emailVerificationExpires: { $gt: new Date() },
  });
  if (!user) {
    throw HttpError.badRequest('auth.verify.tokenInvalid');
  }
  user.emailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save();
  return user;
}

/**
 * Resend a verification email. Idempotent and non-enumerating: an already
 * verified account short-circuits, an unknown email is reported the same way
 * to the caller (controller returns a generic message either way).
 */
export async function resendVerification(
  email: string,
  locale: SupportedLocale = DEFAULT_LOCALE,
): Promise<{ status: 'sent' | 'alreadyVerified' | 'unknown' }> {
  const user = await User.findOne({ email });
  if (!user) return { status: 'unknown' };
  if (user.emailVerified) return { status: 'alreadyVerified' };
  await issueVerificationToken(user, locale);
  return { status: 'sent' };
}

export async function authenticate(email: string, password: string): Promise<UserHydrated> {
  const user = await User.findOne({ email });
  if (!user) throw HttpError.unauthorized('errors.invalidCredentials');
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw HttpError.unauthorized('errors.invalidCredentials');
  return user;
}

export function issueLoginResponse(user: UserHydrated): IssuedToken {
  const publicUser = toPublicUser(user);
  return { token: `JWT ${signToken(publicUser)}`, user: publicUser };
}

export async function generateResetToken(
  email: string,
): Promise<{ user: UserHydrated; token: string } | null> {
  // Non-enumerating: an unknown email returns null (the controller still
  // responds with the same generic 200) so an attacker cannot distinguish
  // registered from unregistered addresses by status code. Mirrors
  // `resendVerification`.
  const user = await User.findOne({ email });
  if (!user) {
    return null;
  }
  const token = randomBytes(48).toString('hex');
  // Store only the hash; the raw token goes out in the email (see hashToken).
  user.resetPasswordToken = hashToken(token);
  user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password/${token}`;
  // `sendEmail` swallows transport errors internally, so this never rejects.
  await deliverPasswordResetEmail(user.email, resetUrl);

  return { user, token };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<UserHydrated> {
  const user = await User.findOne({
    resetPasswordToken: hashToken(token),
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) {
    throw HttpError.badRequest('auth.reset.tokenInvalid');
  }
  user.password = await hashPassword(newPassword);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await deliverPasswordChangedEmail(user.email);

  return user;
}
