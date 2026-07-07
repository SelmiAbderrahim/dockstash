import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { User } from '../users/index.js';
import { UsageCounter } from './usage-counter.model.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import { reserveProjectSlot, reserveAgentSlot } from './entitlements.service.js';

// Covers the defensive first-attempt "at cap" throw in each reservation helper
// (reserveProjectSlot / reserveAgentSlot). With a real MongoDB + `upsert:true`,
// a filter miss always either inserts (upsertedCount>0) or raises E11000, so
// the `matchedCount==0 && upsertedCount==0 && no-throw` branch is only
// reachable by forcing that driver result. Mock updateOne to return it.

const __prevProvider = env.PAYMENT_PROVIDER;
beforeAll(async () => {
  await startMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
});
afterAll(async () => {
  await stopMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevProvider;
});
beforeEach(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
  __setPaymentProviderForTests(null);
  await clearCollections();
});
afterEach(() => vi.restoreAllMocks());

async function freeUser() {
  // No subscription → free tier → finite caps (projects 1, agents 1), so the
  // reservation reaches the atomic updateOne rather than the infinite-tier
  // early return.
  return User.create({
    email: 'reserve@example.com',
    password: 'x'.repeat(60),
    profile: { firstName: 'R', lastName: 'S' },
    emailVerified: true,
  });
}

const AT_CAP_RESULT = {
  acknowledged: true,
  matchedCount: 0,
  modifiedCount: 0,
  upsertedCount: 0,
  upsertedId: null,
} as never;

describe('reservation first-attempt at-cap throw', () => {
  it('reserveProjectSlot rejects projectLimitReached', async () => {
    const u = await freeUser();
    vi.spyOn(UsageCounter, 'updateOne').mockResolvedValueOnce(AT_CAP_RESULT);
    await expect(reserveProjectSlot(String(u._id))).rejects.toMatchObject({
      status: 403,
      details: { reason: 'projectLimitReached' },
    });
  });

  it('reserveAgentSlot rejects agentLimitReached', async () => {
    const u = await freeUser();
    vi.spyOn(UsageCounter, 'updateOne').mockResolvedValueOnce(AT_CAP_RESULT);
    await expect(reserveAgentSlot(String(u._id))).rejects.toMatchObject({
      status: 403,
      details: { reason: 'agentLimitReached' },
    });
  });
});
