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
import { authenticate } from './auth.service.js';
import { requireVerified } from './auth.controller.js';
import { registerStrategies } from './passport.strategies.js';
import { env } from '../../config/env.js';

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
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
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
    });

    it('rejects an unknown email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nobody@example.com' });
      expect(res.status).toBe(400);
    });

    it('resets the password with a valid token then blocks reuse of the old password', async () => {
      await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: validUser.email })
        .expect(200);
      const user = await User.findOne({ email: validUser.email });
      const token = user?.resetPasswordToken ?? '';
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
      const token = await tokenFromDb(validUser.email);
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
      const token = await tokenFromDb(validUser.email);
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
      const token = await tokenFromDb(validUser.email);
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
      const verifyToken = await tokenFromDb(validUser.email);
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
