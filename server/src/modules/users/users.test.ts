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
import { User, getRoleRank } from './users.model.js';
import { getUserProfile, toPublicUser, type PublicUser } from './users.service.js';
import type { UserHydrated } from './users.model.js';

const app = createApp();

describe('getRoleRank', () => {
  it('ranks known roles by privilege and defaults unknown/undefined to 0', () => {
    expect(getRoleRank('Admin')).toBeGreaterThan(getRoleRank('Member'));
    expect(getRoleRank('nope')).toBe(0);
    expect(getRoleRank(undefined)).toBe(0);
  });
});

describe('toPublicUser defaults', () => {
  it('fills empty name / false verification when fields are absent', () => {
    const bare = {
      _id: { toString: () => 'id1' },
      email: 'bare@example.com',
      role: 'Member',
    } as unknown as UserHydrated;
    const pub: PublicUser = toPublicUser(bare);
    expect(pub).toEqual({
      id: 'id1',
      email: 'bare@example.com',
      firstName: '',
      lastName: '',
      role: 'Member',
      emailVerified: false,
    });
  });
});

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

  it('getUserProfile throws 404 for a missing user id', async () => {
    await expect(getUserProfile('507f1f77bcf86cd799439011')).rejects.toMatchObject({
      status: 404,
    });
  });

  it('returns the profile of the authenticated user', async () => {
    const created = await User.create({
      email: 'profile@test.com',
      password: 'irrelevant-already-hashed',
      profile: { firstName: 'Pro', lastName: 'File' },
      emailVerified: true,
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
      emailVerified: true,
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
