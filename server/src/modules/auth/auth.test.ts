import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';

const app = createApp();

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

    it('creates a user and returns a token', async () => {
      const res = await request(app).post('/api/auth/signup').send(validUser);
      expect(res.status).toBe(201);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.token.startsWith('JWT ')).toBe(true);
      expect(res.body.user).toMatchObject({
        email: validUser.email,
        firstName: validUser.firstName,
        lastName: validUser.lastName,
      });
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

    it('logs in with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: validUser.email, password: validUser.password });
      expect(res.status).toBe(200);
      expect(typeof res.body.token).toBe('string');
      expect(res.body.user.email).toBe(validUser.email);
    });
  });

  describe('GET /api/protected', () => {
    it('returns 401 without a token', async () => {
      const res = await request(app).get('/api/protected');
      expect(res.status).toBe(401);
    });

    it('returns 200 with a valid token', async () => {
      await request(app).post('/api/auth/signup').send(validUser).expect(201);
      const loginRes = await request(app).post('/api/auth/login').send({
        email: validUser.email,
        password: validUser.password,
      });
      const token = loginRes.body.token.replace(/^JWT /, '');

      const res = await request(app)
        .get('/api/protected')
        .set('Authorization', `JWT ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.content).toContain('protected');
    });
  });
});
