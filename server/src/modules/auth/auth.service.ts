import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { HttpError } from '../../shared/utils/http-error.js';
import {
  deliverPasswordChangedEmail,
  deliverPasswordResetEmail,
} from '../communication/index.js';
import {
  ROLE_MEMBER,
  User,
  type PublicUser,
  type UserHydrated,
  toPublicUser,
} from '../users/index.js';

const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const SALT_ROUNDS = 10;

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

export async function registerUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<IssuedToken> {
  const existing = await User.findOne({ email: input.email });
  if (existing) {
    throw HttpError.conflict('That email address is already in use.');
  }

  const passwordHash = await hashPassword(input.password);
  const created = (await User.create({
    email: input.email,
    password: passwordHash,
    profile: { firstName: input.firstName, lastName: input.lastName },
    role: ROLE_MEMBER,
  })) as UserHydrated;

  const publicUser = toPublicUser(created);
  return { token: `JWT ${signToken(publicUser)}`, user: publicUser };
}

export async function authenticate(email: string, password: string): Promise<UserHydrated> {
  const user = await User.findOne({ email });
  if (!user) throw HttpError.unauthorized('Invalid email or password.');
  const ok = await verifyPassword(password, user.password);
  if (!ok) throw HttpError.unauthorized('Invalid email or password.');
  return user;
}

export function issueLoginResponse(user: UserHydrated): IssuedToken {
  const publicUser = toPublicUser(user);
  return { token: `JWT ${signToken(publicUser)}`, user: publicUser };
}

export async function generateResetToken(email: string): Promise<{ user: UserHydrated; token: string }> {
  const user = await User.findOne({ email });
  if (!user) {
    throw HttpError.badRequest('Your request could not be processed as entered.');
  }
  const token = randomBytes(48).toString('hex');
  user.resetPasswordToken = token;
  user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  await user.save();

  const resetUrl = `${env.CLIENT_URL.replace(/\/$/, '')}/reset-password/${token}`;
  // email failure is non-fatal; user can request another token
  await deliverPasswordResetEmail(user.email, resetUrl).catch((err) => {
    logger.error({ err, email: user.email }, 'failed to deliver reset email');
  });

  return { user, token };
}

export async function resetPasswordWithToken(token: string, newPassword: string): Promise<UserHydrated> {
  const user = await User.findOne({
    resetPasswordToken: token,
    resetPasswordExpires: { $gt: new Date() },
  });
  if (!user) {
    throw HttpError.badRequest('Your token has expired. Please attempt to reset your password again.');
  }
  user.password = await hashPassword(newPassword);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await deliverPasswordChangedEmail(user.email).catch((err) => {
    logger.error({ err, email: user.email }, 'failed to deliver password-changed email');
  });

  return user;
}
