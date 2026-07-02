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
import {
  getUserProfile,
  toPublicUser,
  updateUserPreferences,
  updateUserProfile,
  type PublicUser,
} from './users.service.js';
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
      guideMe: true,
    });
  });

  it('preserves an explicit guideMe=false', () => {
    const bare = {
      _id: { toString: () => 'id2' },
      email: 'off@example.com',
      role: 'Member',
      guideMe: false,
    } as unknown as UserHydrated;
    expect(toPublicUser(bare).guideMe).toBe(false);
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

  it('exposes guideMe=true for a fresh user and for legacy docs lacking the field', async () => {
    const fresh = await User.create({
      email: 'fresh@test.com',
      password: 'pw',
      profile: { firstName: 'F', lastName: 'F' },
      emailVerified: true,
    });
    const token = signTestToken(fresh._id.toString());

    const res = await request(app)
      .get(`/api/users/${fresh._id.toString()}`)
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user.guideMe).toBe(true);

    // Simulate a pre-guideMe document.
    await User.collection.updateOne({ _id: fresh._id }, { $unset: { guideMe: '' } });
    const legacy = await request(app)
      .get(`/api/users/${fresh._id.toString()}`)
      .set('Authorization', `JWT ${token}`);
    expect(legacy.status).toBe(200);
    expect(legacy.body.user.guideMe).toBe(true);
  });

  it('PATCH /preferences toggles guideMe and persists it', async () => {
    const user = await User.create({
      email: 'prefs@test.com',
      password: 'pw',
      profile: { firstName: 'P', lastName: 'P' },
      emailVerified: true,
    });
    const token = signTestToken(user._id.toString());

    const off = await request(app)
      .patch(`/api/users/${user._id.toString()}/preferences`)
      .set('Authorization', `JWT ${token}`)
      .send({ guideMe: false });
    expect(off.status).toBe(200);
    expect(off.body.user.guideMe).toBe(false);

    const stored = await User.findById(user._id);
    expect(stored?.guideMe).toBe(false);

    const on = await request(app)
      .patch(`/api/users/${user._id.toString()}/preferences`)
      .set('Authorization', `JWT ${token}`)
      .send({ guideMe: true });
    expect(on.status).toBe(200);
    expect(on.body.user.guideMe).toBe(true);
  });

  it('PATCH /preferences returns 401 without a JWT', async () => {
    const res = await request(app)
      .patch('/api/users/507f1f77bcf86cd799439011/preferences')
      .send({ guideMe: false });
    expect(res.status).toBe(401);
  });

  it("PATCH /preferences rejects another user's id", async () => {
    const a = await User.create({
      email: 'pa@test.com',
      password: 'pw',
      profile: { firstName: 'A', lastName: 'A' },
      emailVerified: true,
    });
    const b = await User.create({
      email: 'pb@test.com',
      password: 'pw',
      profile: { firstName: 'B', lastName: 'B' },
    });
    const token = signTestToken(a._id.toString());

    const res = await request(app)
      .patch(`/api/users/${b._id.toString()}/preferences`)
      .set('Authorization', `JWT ${token}`)
      .send({ guideMe: false });
    expect(res.status).toBe(401);
  });

  it('updateUserPreferences throws 404 for a missing user id', async () => {
    await expect(
      updateUserPreferences('507f1f77bcf86cd799439011', { guideMe: false }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PATCH /preferences rejects an invalid body with 400', async () => {
    const user = await User.create({
      email: 'invalid@test.com',
      password: 'pw',
      profile: { firstName: 'I', lastName: 'I' },
      emailVerified: true,
    });
    const token = signTestToken(user._id.toString());

    const res = await request(app)
      .patch(`/api/users/${user._id.toString()}/preferences`)
      .set('Authorization', `JWT ${token}`)
      .send({ guideMe: 'yes' });
    expect(res.status).toBe(400);
  });

  it('PATCH /:userId updates firstName/lastName and persists it', async () => {
    const user = await User.create({
      email: 'name@test.com',
      password: 'pw',
      profile: { firstName: 'Old', lastName: 'Name' },
      emailVerified: true,
    });
    const token = signTestToken(user._id.toString());

    const res = await request(app)
      .patch(`/api/users/${user._id.toString()}`)
      .set('Authorization', `JWT ${token}`)
      .send({ firstName: 'New', lastName: 'Name' });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ firstName: 'New', lastName: 'Name' });

    const stored = await User.findById(user._id);
    expect(stored?.profile?.firstName).toBe('New');
    expect(stored?.profile?.lastName).toBe('Name');
  });

  it('PATCH /:userId returns 401 without a JWT', async () => {
    const res = await request(app)
      .patch('/api/users/507f1f77bcf86cd799439011')
      .send({ firstName: 'A', lastName: 'B' });
    expect(res.status).toBe(401);
  });

  it("PATCH /:userId rejects another user's id", async () => {
    const a = await User.create({
      email: 'na@test.com',
      password: 'pw',
      profile: { firstName: 'A', lastName: 'A' },
      emailVerified: true,
    });
    const b = await User.create({
      email: 'nb@test.com',
      password: 'pw',
      profile: { firstName: 'B', lastName: 'B' },
    });
    const token = signTestToken(a._id.toString());

    const res = await request(app)
      .patch(`/api/users/${b._id.toString()}`)
      .set('Authorization', `JWT ${token}`)
      .send({ firstName: 'X', lastName: 'Y' });
    expect(res.status).toBe(401);
  });

  it('updateUserProfile throws 404 for a missing user id', async () => {
    await expect(
      updateUserProfile('507f1f77bcf86cd799439011', { firstName: 'A', lastName: 'B' }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('PATCH /:userId rejects an invalid body with 400', async () => {
    const user = await User.create({
      email: 'invalidname@test.com',
      password: 'pw',
      profile: { firstName: 'I', lastName: 'I' },
      emailVerified: true,
    });
    const token = signTestToken(user._id.toString());

    const res = await request(app)
      .patch(`/api/users/${user._id.toString()}`)
      .set('Authorization', `JWT ${token}`)
      .send({ firstName: '', lastName: 'Valid' });
    expect(res.status).toBe(400);
  });

  it('PATCH /:userId trims whitespace-only names to a 400', async () => {
    const user = await User.create({
      email: 'whitespace@test.com',
      password: 'pw',
      profile: { firstName: 'I', lastName: 'I' },
      emailVerified: true,
    });
    const token = signTestToken(user._id.toString());

    const res = await request(app)
      .patch(`/api/users/${user._id.toString()}`)
      .set('Authorization', `JWT ${token}`)
      .send({ firstName: '   ', lastName: 'Valid' });
    expect(res.status).toBe(400);
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
