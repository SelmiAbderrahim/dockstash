import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from './users.model.js';

const app = createApp();

function signTestToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

describe('users module', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('returns 401 without a JWT', async () => {
    const res = await request(app).get('/api/users/507f1f77bcf86cd799439011');
    expect(res.status).toBe(401);
  });

  it('returns the profile of the authenticated user', async () => {
    const created = await User.create({
      email: 'profile@test.com',
      password: 'irrelevant-already-hashed',
      profile: { firstName: 'Pro', lastName: 'File' },
    });

    const token = signTestToken(created._id.toString());
    const res = await request(app)
      .get(`/api/users/${created._id.toString()}`)
      .set('Authorization', `JWT ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: created._id.toString(),
      email: 'profile@test.com',
      firstName: 'Pro',
      lastName: 'File',
    });
  });

  it('returns 401 when requesting a different user', async () => {
    const a = await User.create({
      email: 'a@test.com',
      password: 'pw',
      profile: { firstName: 'A', lastName: 'A' },
    });
    const b = await User.create({
      email: 'b@test.com',
      password: 'pw',
      profile: { firstName: 'B', lastName: 'B' },
    });

    const token = signTestToken(a._id.toString());
    const res = await request(app)
      .get(`/api/users/${b._id.toString()}`)
      .set('Authorization', `JWT ${token}`);

    expect(res.status).toBe(401);
  });
});
