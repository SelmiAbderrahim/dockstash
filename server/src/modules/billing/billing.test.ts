import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { hashPassword, signToken } from '../auth/index.js';
import { toPublicUser, User } from '../users/index.js';

const app = createApp();

describe('billing module', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
  });

  it('rejects subscription creation without auth', async () => {
    const res = await request(app)
      .post('/api/billing/customer')
      .send({ plan: 'price_basic', stripeToken: 'tok_visa', lastFour: '4242' });
    expect(res.status).toBe(401);
  });

  it('returns 500 when stripe is not configured', async () => {
    const passwordHash = await hashPassword('hunter2hunter2');
    const user = await User.create({
      email: 'pay@example.com',
      password: passwordHash,
      profile: { firstName: 'Pay', lastName: 'Er' },
    });
    const token = signToken(toPublicUser(user));

    const res = await request(app)
      .post('/api/billing/customer')
      .set('Authorization', `JWT ${token}`)
      .send({ plan: 'price_basic', stripeToken: 'tok_visa', lastFour: '4242' });

    // STRIPE_SECRET_KEY is unset in tests, so the service throws an HttpError.
    expect(res.status).toBe(500);
    expect(res.body.error.message).toMatch(/stripe is not configured/i);
  });

  it('rejects an invalid lastFour', async () => {
    const passwordHash = await hashPassword('hunter2hunter2');
    const user = await User.create({
      email: 'pay2@example.com',
      password: passwordHash,
      profile: { firstName: 'Pay', lastName: 'Er' },
    });
    const token = signToken(toPublicUser(user));

    const res = await request(app)
      .post('/api/billing/customer')
      .set('Authorization', `JWT ${token}`)
      .send({ plan: 'price_basic', stripeToken: 'tok_visa', lastFour: 'abcd' });

    expect(res.status).toBe(400);
  });
});
