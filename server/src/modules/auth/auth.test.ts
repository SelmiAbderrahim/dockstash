import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { NextFunction, Request, Response } from 'express';
import { User } from '../users/index.js';
import {
  authenticate,
  generateResetToken,
  getAuthTimingPadMs,
  resendVerification,
  setAuthTimingPadMs,
} from './auth.service.js';
import { requireVerified } from './auth.controller.js';
import { registerStrategies } from './passport.strategies.js';
import { env } from '../../config/env.js';
import { setResendTransport } from '../communication/mailers/resend.js';

// Single-use email tokens are hashed at rest (see auth.service hashToken), so
// the raw token only exists in the outbound email. Capture emails through the
// transport spy and pull the raw token out of the URL.
const sentEmails: Array<{ to: string; subject: string; text: string }> = [];

function rawTokenFrom(pathSegment: string): string {
  for (let i = sentEmails.length - 1; i >= 0; i--) {
    const m = sentEmails[i]!.text.match(new RegExp(`/${pathSegment}/([a-f0-9]+)`));
    if (m) return m[1]!;
  }
  return '';
}
const rawVerifyToken = (): string => rawTokenFrom('verify-email');
const rawResetToken = (): string => rawTokenFrom('reset-password');

/** Drives an asyncHandler-wrapped middleware and resolves with the value passed to next(). */
function invokeHandler(
  handler: (req: Request, res: Response, next: NextFunction) => void,
  req: Partial<Request>,
): Promise<unknown> {
  return new Promise((resolve) => {
    handler(req as Request, {} as unknown as Response, ((err?: unknown) => resolve(err)) as NextFunction);
  });
}

const app = createApp();

async function tokenFromDb(email: string): Promise<string> {
  const user = await User.findOne({ email });
  return user?.emailVerificationToken ?? '';
}

const validUser = {
  email: 'johndoe@example.com',
  password: 'hunter2hunter2',
  firstName: 'John',
  lastName: 'Doe',
};

describe('auth module', () => {
  const prevResendKey = env.RESEND_API_KEY;
  const prevResendFrom = env.RESEND_FROM;
  const prevPadMs = getAuthTimingPadMs();

  beforeAll(async () => {
    await startMemoryMongo();
    // Route outbound email to a capturing spy so tests can read the raw
    // (unhashed) reset/verify tokens that only exist in the email body.
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = 'test-key';
    (env as { RESEND_FROM?: string }).RESEND_FROM = 'no-reply@dockstash.test';
    setResendTransport(async (msg) => {
      sentEmails.push({ to: msg.to, subject: msg.subject, text: msg.text });
      return { delivered: true };
    });
    // Keep the anti-enumeration pad small in tests so the suite stays fast;
    // dedicated cases restore a real pad to prove the floor. See S1-03.
    setAuthTimingPadMs(5);
  });

  afterAll(async () => {
    await stopMemoryMongo();
    setResendTransport(null);
    (env as { RESEND_API_KEY?: string }).RESEND_API_KEY = prevResendKey;
    (env as { RESEND_FROM?: string }).RESEND_FROM = prevResendFrom;
    setAuthTimingPadMs(prevPadMs);
  });

  beforeEach(async () => {
    await clearCollections();
    sentEmails.length = 0;
  });

  describe('POST /api/auth/signup', () => {
    it('rejects when no body is sent', async () => {
      const res = await request(app).post('/api/auth/signup').send({});
      expect(res.status).toBe(400);
    });

    it('rejects when password is missing', async () => {
      const res = await request(app).post('/api/auth/signup').send({
        email: 'a@b.com',
        firstName: 'A',
        lastName: 'B',
      });
      expect(res.status).toBe(400);
    });

    it('creates an unverified user and returns a token', async () => {
      const res = await request(app).post('/api/auth/signup').send(validUser);
      expect(res.status).toBe(201);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.startsWith('JWT ')).toBe(true);
      expect(res.body.user).toMatchObject({
        email: validUser.email,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
        emailVerified: false,
      });
      // A verification token is persisted so the email link works.
      expect(await tokenFromDb(validUser.email)).not.toBe('');
    });

    it('accepts signup with only email + password', async () => {
      const res = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'minimal@example.com', password: 'hunter2hunter2' });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('minimal@example.com');
    });

    it('rejects duplicate emails', async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
      const res = await request(app).post('/api/auth/signup').send(validUser);
      expect(res.status).toBe(409);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
    });

    it('rejects with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: 'wrongwrong' });
      expect(res.status).toBe(401);
    });

    it('rejects an unknown email (local strategy user-not-found)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'whatever12' });
      expect(res.status).toBe(401);
    });

    it('refreshes a token for an authenticated user', async () => {
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
      const token = login.body.token.replace(/^JWT /, '');
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.email).toBe(validUser.email);
    });

    it('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.email).toBe(validUser.email);
    });
  });

  describe('authenticate() service', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
    });

    it('returns the user for valid credentials', async () => {
      const user = await authenticate(validUser.email, validUser.password);
      expect(user.email).toBe(validUser.email);
    });

    it('throws for an unknown email', async () => {
      await expect(authenticate('nobody@example.com', 'x')).rejects.toMatchObject({
        status: 401,
      });
    });

    it('throws for a wrong password', async () => {
      await expect(authenticate(validUser.email, 'wrongwrong')).rejects.toMatchObject({
        status: 401,
      });
    });
  });

  describe('POST /api/auth/forgot-password + reset-password', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
    });

    it('issues a reset token for a known email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: validUser.email });
      expect(res.status).toBe(200);
      const user = await User.findOne({ email: validUser.email });
      expect(user?.resetPasswordToken).toBeTruthy();
      // Stored token is hashed at rest — never the raw token emailed to the user.
      const rawToken = rawResetToken();
      expect(rawToken).not.toBe('');
      expect(user?.resetPasswordToken).not.toBe(rawToken);
      expect(user?.resetPasswordToken).toHaveLength(64); // sha256 hex
    });

    it('responds generically for an unknown email (no enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });
      // Same 200 as a known email — status must not leak account existence.
      expect(res.status).toBe(200);
      // And nothing was sent for the unknown address.
      expect(rawResetToken()).toBe('');
    });

    it('resets the password with a valid token then blocks reuse of the old password', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: validUser.email })
        .expect(200);
      const token = rawResetToken();
      expect(token).not.toBe('');
      const res = await request(app)
        .post(`/api/auth/reset-password/${token}`)
        .send({ password: 'brandnewpass9' });
      expect(res.status).toBe(200);
      // Old password no longer works.
      const login = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
      expect(login.status).toBe(401);
    });

    it('rejects an invalid/expired reset token', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password/not-real')
        .send({ password: 'brandnewpass9' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/verify-email/:token', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
    });

    it('verifies the account with a valid token', async () => {
      const token = rawVerifyToken();
      const res = await request(app).post(`/api/auth/verify-email/${token}`);
      expect(res.status).toBe(200);
      const user = await User.findOne({ email: validUser.email });
      expect(user?.emailVerified).toBe(true);
      expect(user?.emailVerificationToken).toBeUndefined();
    });

    it('rejects an invalid or expired token', async () => {
      const res = await request(app).post('/api/auth/verify-email/not-a-real-token');
      expect(res.status).toBe(400);
    });

    it('rejects a token that was already consumed', async () => {
      const token = rawVerifyToken();
      await request(app).post(`/api/auth/verify-email/${token}`).expect(200);
      const res = await request(app).post(`/api/auth/verify-email/${token}`);
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/resend-verification', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
    });

    it('re-issues a verification token for an unverified account', async () => {
      const first = await tokenFromDb(validUser.email);
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: validUser.email });
      expect(res.status).toBe(200);
      const next = await tokenFromDb(validUser.email);
      expect(next).not.toBe('');
      expect(next).not.toBe(first);
    });

    it('responds generically for an unknown email (no enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: 'nobody@example.com' });
      expect(res.status).toBe(200);
    });

    it('responds generically for an already-verified account', async () => {
      const token = rawVerifyToken();
      await request(app).post(`/api/auth/verify-email/${token}`).expect(200);
      const res = await request(app)
        .post('/api/auth/resend-verification')
        .send({ email: validUser.email });
      expect(res.status).toBe(200);
    });
  });

  describe('JWT strategy rejections', () => {
    it('rejects a token whose payload has no id', async () => {
      const token = jwt.sign({ email: 'x@example.com' }, env.JWT_SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/users/507f1f77bcf86cd799439011')
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects a token signed with a non-HS256 algorithm (alg pinning)', async () => {
      const token = jwt.sign(
        { id: '507f1f77bcf86cd799439011' },
        env.JWT_SECRET,
        { algorithm: 'HS512', expiresIn: '1h' },
      );
      const res = await request(app)
        .get('/api/users/507f1f77bcf86cd799439011')
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(401);
    });

    it('rejects a token for a user that no longer exists', async () => {
      const token = jwt.sign(
        { id: '507f1f77bcf86cd799439011' },
        env.JWT_SECRET,
        { expiresIn: '1h' },
      );
      const res = await request(app)
        .get('/api/users/507f1f77bcf86cd799439011')
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(401);
    });
  });

  describe('email-verification gate on product routes', () => {
    async function signupAndLogin(): Promise<{ token: string; id: string }> {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
      const loginRes = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password,
      });
      const user = await User.findOne({ email: validUser.email });
      return { token: loginRes.body.token.replace(/^JWT /, ''), id: String(user?._id) };
    }

    it('blocks an unverified user with 403 EMAIL_NOT_VERIFIED', async () => {
      const { token, id } = await signupAndLogin();
      const res = await request(app)
        .get(`/api/users/${id}`)
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.details.code).toBe('EMAIL_NOT_VERIFIED');
    });

    it('allows the user through once verified', async () => {
      const { token, id } = await signupAndLogin();
      const verifyToken = rawVerifyToken();
      await request(app).post(`/api/auth/verify-email/${verifyToken}`).expect(200);
      const res = await request(app)
        .get(`/api/users/${id}`)
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(200);
    });

    it('requireVerified rejects a request with no authenticated user (401)', async () => {
      const err = await invokeHandler(requireVerified, {});
      expect(err).toMatchObject({ status: 401 });
    });

    it('requireVerified rejects when the token user no longer exists (401)', async () => {
      const missingId = new mongoose.Types.ObjectId().toString();
      const err = await invokeHandler(requireVerified, { user: { id: missingId } as Express.User });
      expect(err).toMatchObject({ status: 401 });
    });
  });

  /**
   * S1-03 — Timing enumeration on forgot-password / resend-verification.
   * Both hit and miss branches must pad up to `authTimingPadMs` so an attacker
   * cannot cluster response-latency samples into "known" vs "unknown" pools.
   * Pre-fix: the miss branch short-circuited synchronously and always returned
   * well under the pad; these expectations would fail.
   */
  describe('non-enumerating timing pad (S1-03)', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
    });

    it('padAuthTiming: raising the pad above elapsed schedules a setTimeout', async () => {
      setAuthTimingPadMs(60);
      try {
        const start = Date.now();
        const miss = await generateResetToken('nobody-pad@example.com');
        const elapsed = Date.now() - start;
        expect(miss).toBeNull();
        expect(elapsed).toBeGreaterThanOrEqual(50);
      } finally {
        setAuthTimingPadMs(5);
      }
    });

    it('padAuthTiming: setting the pad to 0 skips the setTimeout branch', async () => {
      setAuthTimingPadMs(0);
      try {
        // Elapsed will always exceed 0 by the time padAuthTiming runs, so the
        // `remaining > 0` guard is false — this exercises the fast-path branch.
        const res = await resendVerification('another-pad@example.com');
        expect(res).toEqual({ status: 'unknown' });
      } finally {
        setAuthTimingPadMs(5);
      }
    });

    it('service: generateResetToken miss and hit both return with pad floor', async () => {
      setAuthTimingPadMs(40);
      try {
        const start1 = Date.now();
        const miss = await generateResetToken('unknown@example.com');
        const missDur = Date.now() - start1;
        expect(miss).toBeNull();
        expect(missDur).toBeGreaterThanOrEqual(30);

        const start2 = Date.now();
        const hit = await generateResetToken(validUser.email);
        const hitDur = Date.now() - start2;
        expect(hit).not.toBeNull();
        expect(hitDur).toBeGreaterThanOrEqual(30);
      } finally {
        setAuthTimingPadMs(5);
      }
    });

    it('service: resendVerification miss / already-verified / sent all hit the pad floor', async () => {
      setAuthTimingPadMs(40);
      try {
        const missStart = Date.now();
        const miss = await resendVerification('ghost@example.com');
        expect(miss.status).toBe('unknown');
        expect(Date.now() - missStart).toBeGreaterThanOrEqual(30);

        const sentStart = Date.now();
        const sent = await resendVerification(validUser.email);
        expect(sent.status).toBe('sent');
        expect(Date.now() - sentStart).toBeGreaterThanOrEqual(30);

        // Flip the account to verified and check the alreadyVerified branch too.
        await User.updateOne({ email: validUser.email }, { $set: { emailVerified: true } });
        const verifStart = Date.now();
        const alreadyVerified = await resendVerification(validUser.email);
        expect(alreadyVerified.status).toBe('alreadyVerified');
        expect(Date.now() - verifStart).toBeGreaterThanOrEqual(30);
      } finally {
        setAuthTimingPadMs(5);
      }
    });

    it('setter/getter round-trip the pad value', () => {
      const prev = getAuthTimingPadMs();
      setAuthTimingPadMs(123);
      expect(getAuthTimingPadMs()).toBe(123);
      setAuthTimingPadMs(prev);
      expect(getAuthTimingPadMs()).toBe(prev);
    });
  });
});

describe('registerStrategies idempotency', () => {
  it('returns early when passport strategies are already registered', () => {
    // createApp() has already registered strategies; these calls hit the guard.
    expect(() => {
      registerStrategies();
      registerStrategies();
    }).not.toThrow();
  });
});
