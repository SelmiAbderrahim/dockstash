import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import mongoose from 'mongoose';
import { HttpError } from '../../shared/utils/http-error.js';
import type { SupportedLocale } from '../../shared/i18n/index.js';
import { deliverLoginOtpEmail } from '../communication/index.js';
import { recordAudit } from '../audit/index.js';
import { findUserById, type UserHydrated } from '../users/index.js';
import {
  LoginChallenge,
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
} from './login-challenge.model.js';
import { DEVICE_TRUST_MS, TrustedDevice } from './trusted-device.model.js';

function sha256hex(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function hashUserAgent(userAgent: string | undefined): string {
  return sha256hex(userAgent ?? '');
}

export function computeFingerprint(ip: string, userAgent: string | undefined): string {
  return `${ip}:${hashUserAgent(userAgent)}`;
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtp(secret: string, code: string): string {
  return sha256hex(`${secret}:${code}`);
}

export async function isTrustedDevice(userId: string, fingerprint: string): Promise<boolean> {
  const device = await TrustedDevice.findOne({
    userId,
    fingerprint,
    // TTL reaping is lazy (~60s cadence) — enforce expiry at query time.
    expiresAt: { $gt: new Date() },
  });
  return device !== null;
}

export async function trustDevice(
  userId: string,
  fingerprint: string,
  ip: string,
  uaHash: string,
): Promise<void> {
  const now = new Date();
  await TrustedDevice.findOneAndUpdate(
    { userId, fingerprint },
    {
      $set: {
        ip,
        uaHash,
        lastSeenAt: now,
        expiresAt: new Date(now.getTime() + DEVICE_TRUST_MS),
      },
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
}

export interface ChallengeContext {
  ip: string;
  userAgent?: string;
  // Always provided by the login controller (language middleware guarantees
  // req.language), so no default here.
  locale: SupportedLocale;
}

export async function createLoginChallenge(
  user: UserHydrated,
  ctx: ChallengeContext,
): Promise<{ challengeId: string }> {
  const code = generateOtpCode();
  const secret = randomBytes(16).toString('hex');
  const uaHash = hashUserAgent(ctx.userAgent);
  const challenge = await LoginChallenge.create({
    userId: user._id,
    codeHash: hashOtp(secret, code),
    secret,
    ip: ctx.ip,
    uaHash,
    expiresAt: new Date(Date.now() + OTP_TTL_MS),
  });
  // `sendEmail` swallows transport errors internally, so this never rejects.
  await deliverLoginOtpEmail(user.email, code, ctx.locale);
  const userId = user._id.toString();
  await recordAudit({
    actorUserId: userId,
    action: 'auth.otp.challenge',
    targetType: 'user',
    targetId: userId,
    ip: ctx.ip,
    metadata: { uaHash },
  });
  return { challengeId: challenge._id.toString() };
}

export async function verifyLoginChallenge(
  challengeId: string,
  code: string,
  ctx: { ip: string; userAgent?: string },
): Promise<UserHydrated> {
  if (!mongoose.Types.ObjectId.isValid(challengeId)) {
    throw HttpError.unauthorized('auth.otp.invalid');
  }
  const challenge = await LoginChallenge.findOne({
    _id: challengeId,
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!challenge) {
    throw HttpError.unauthorized('auth.otp.invalid');
  }
  const userId = challenge.userId.toString();
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
    throw HttpError.unauthorized('auth.otp.tooManyAttempts');
  }
  const expected = Buffer.from(challenge.codeHash, 'hex');
  const actual = Buffer.from(hashOtp(challenge.secret, code), 'hex');
  // Digests are fixed-length by construction, so lengths always match.
  if (!timingSafeEqual(expected, actual)) {
    challenge.attempts += 1;
    await challenge.save();
    await recordAudit({
      actorUserId: userId,
      action: 'auth.otp.failure',
      targetType: 'user',
      targetId: userId,
      ip: ctx.ip,
      metadata: { attempts: challenge.attempts },
    });
    throw HttpError.unauthorized('auth.otp.invalid');
  }
  challenge.consumedAt = new Date();
  await challenge.save();

  const user = await findUserById(userId);
  if (!user) {
    throw HttpError.unauthorized('errors.userNotFound');
  }
  // Trust the device that completed the OTP (fingerprint from the verify
  // request, not the original login attempt — correct when IP shifts mid-flow).
  const uaHash = hashUserAgent(ctx.userAgent);
  const fingerprint = computeFingerprint(ctx.ip, ctx.userAgent);
  await trustDevice(userId, fingerprint, ctx.ip, uaHash);
  await recordAudit({
    actorUserId: userId,
    action: 'auth.otp.success',
    targetType: 'user',
    targetId: userId,
    ip: ctx.ip,
    metadata: { uaHash },
  });
  await recordAudit({
    actorUserId: userId,
    action: 'auth.newDevice',
    targetType: 'user',
    targetId: userId,
    ip: ctx.ip,
    metadata: { fingerprint },
  });
  return user;
}
