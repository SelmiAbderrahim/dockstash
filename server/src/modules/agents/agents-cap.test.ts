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
import { User } from '../users/index.js';
import { Agent } from './agents.model.js';
import { UsageCounter } from '../billing/usage-counter.model.js';
import { Subscription } from '../billing/subscription.model.js';
import { Customer } from '../billing/customer.model.js';
import { getPaymentProvider, __setPaymentProviderForTests } from '../billing/active-provider.js';

/**
 * Tier-mode agent-cap enforcement (fleet metered per plan: Free 1 / Pro 5 /
 * Business ∞). The OSS-mode agents suite runs with PAYMENT_PROVIDER=none where
 * every tier is business-unlimited; this suite exercises the paid-tier cap.
 * A no-subscription user resolves to `free` under the default (non-none) test
 * provider, mirroring entitlements-cap.test.ts.
 */

const app = createApp();

function signToken(userId: string): string {
  return jwt.sign({ _id: userId, id: userId }, env.JWT_SECRET, { expiresIn: '1h' });
}

async function seedUser(email: string): Promise<{ id: string; token: string }> {
  const u = await User.create({
    email,
    password: 'x'.repeat(60),
    profile: { firstName: 'A', lastName: 'G' },
    emailVerified: true,
  });
  return { id: u._id.toString(), token: signToken(u._id.toString()) };
}

async function seedActiveProSub(userId: string): Promise<void> {
  const provider = getPaymentProvider().name;
  const customer = await Customer.create({
    userId,
    provider,
    providerCustomerId: `pc_${userId}`,
    email: `${userId}@t.com`,
  });
  await Subscription.create({
    userId,
    customerId: customer._id,
    provider,
    productId: 'prod_pro',
    planSlug: 'pro',
    status: 'active',
    providerSubscriptionId: `sub_${userId}`,
    selectionRequired: false,
  });
}

function registerReq(token: string, name: string, host: string) {
  return request(app)
    .post('/api/agents')
    .set('Authorization', `JWT ${token}`)
    .send({ name, host });
}

// Pin a paid (non-none) provider so a no-subscription user resolves to `free`
// (cap 1) rather than the OSS business ceiling. Re-applied per test because the
// OSS agents suite mutates PAYMENT_PROVIDER=none and can share this worker.
const __prevProvider = env.PAYMENT_PROVIDER;
beforeAll(async () => {
  await startMemoryMongo();
  // The per-file mongo restart leaves the fresh DB without indexes until
  // autoIndex completes async. reserveAgentSlot's atomic guard relies on the
  // unique `owner` index (its concurrency authority), so build it up front.
  await UsageCounter.createIndexes();
});
afterAll(async () => {
  await stopMemoryMongo();
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = __prevProvider;
});
beforeEach(async () => {
  (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'polar';
  __setPaymentProviderForTests(null); // rebuild the cached provider from env
  await clearCollections();
});

describe('agents cap: per-plan fleet metering', () => {
  it('free user registers agent #1 (201) then #2 is 403 agentLimitReached {used:1,cap:1}', async () => {
    const { id, token } = await seedUser('free-cap@t.com');
    const first = await registerReq(token, 'a1', '10.0.0.1');
    expect(first.status).toBe(201);
    const second = await registerReq(token, 'a2', '10.0.0.2');
    expect(second.status).toBe(403);
    expect(second.body).toMatchObject({
      error: { details: { reason: 'agentLimitReached', used: 1, cap: 1 } },
    });
    // Only the first agent persisted; the counter sits at the cap.
    expect(await Agent.countDocuments({ owner: id })).toBe(1);
    expect((await UsageCounter.findOne({ owner: id }))?.agents).toBe(1);
  });

  it('exactly one wins under two concurrent registers at remaining==1 (Pro cap 5)', async () => {
    const { id, token } = await seedUser('pro-race@t.com');
    await seedActiveProSub(id);
    // Seed 4 agents + counter=4 so a single slot remains.
    await Agent.create([
      { owner: id, name: 'p1', host: '10.1.0.1', apiKeyHash: { hash: 'h', keyVersion: 1 }, status: 'offline' },
      { owner: id, name: 'p2', host: '10.1.0.2', apiKeyHash: { hash: 'h', keyVersion: 1 }, status: 'offline' },
      { owner: id, name: 'p3', host: '10.1.0.3', apiKeyHash: { hash: 'h', keyVersion: 1 }, status: 'offline' },
      { owner: id, name: 'p4', host: '10.1.0.4', apiKeyHash: { hash: 'h', keyVersion: 1 }, status: 'offline' },
    ]);
    await UsageCounter.create({ owner: id, agents: 4 });

    const results = await Promise.all([
      registerReq(token, 'r1', '10.1.9.1'),
      registerReq(token, 'r2', '10.1.9.2'),
    ]);
    const created = results.filter((r) => r.status === 201);
    const rejected = results.filter((r) => r.status === 403);
    expect(created).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.body?.error?.details?.reason).toBe('agentLimitReached');
    expect(await Agent.countDocuments({ owner: id })).toBe(5);
    expect((await UsageCounter.findOne({ owner: id }))?.agents).toBe(5);
  });

  it('deleting an agent frees the slot so a re-register succeeds', async () => {
    const { id, token } = await seedUser('free-delete@t.com');
    const reg = await registerReq(token, 'a1', '10.2.0.1');
    expect(reg.status).toBe(201);
    // At cap: a second register is blocked.
    expect((await registerReq(token, 'a2', '10.2.0.2')).status).toBe(403);
    // Delete frees the slot.
    const del = await request(app)
      .delete(`/api/agents/${reg.body.agent.id}`)
      .set('Authorization', `JWT ${token}`);
    expect(del.status).toBe(204);
    expect((await UsageCounter.findOne({ owner: id }))?.agents).toBe(0);
    // Re-register now succeeds.
    expect((await registerReq(token, 'a3', '10.2.0.3')).status).toBe(201);
  });

  it('read/maintenance routes have NO plan gate for a free user at cap', async () => {
    const { token } = await seedUser('free-readonly@t.com');
    const reg = await registerReq(token, 'a1', '10.3.0.1');
    expect(reg.status).toBe(201);
    const agentId = reg.body.agent.id;
    // list / rotate / fleet / discovery all succeed at cap — owner scope only.
    expect((await request(app).get('/api/agents').set('Authorization', `JWT ${token}`)).status).toBe(200);
    expect(
      (await request(app).post(`/api/agents/${agentId}/rotate-key`).set('Authorization', `JWT ${token}`)).status,
    ).toBe(200);
    expect((await request(app).get('/api/agents/fleet').set('Authorization', `JWT ${token}`)).status).toBe(200);
    expect(
      (await request(app).get(`/api/agents/${agentId}/discovery`).set('Authorization', `JWT ${token}`)).status,
    ).toBe(200);
  });

  it('a foreign agent stays 404 (owner-scope unchanged by the gate removal)', async () => {
    const owner = await seedUser('owner@t.com');
    const attacker = await seedUser('attacker@t.com');
    const reg = await registerReq(owner.token, 'a1', '10.4.0.1');
    expect(reg.status).toBe(201);
    const foreign = await request(app)
      .get(`/api/agents/${reg.body.agent.id}/discovery`)
      .set('Authorization', `JWT ${attacker.token}`);
    expect(foreign.status).toBe(404);
  });
});
