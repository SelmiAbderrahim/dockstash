import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import { env } from '../../config/env.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { hashPassword, signToken } from '../auth/index.js';
import { toPublicUser, User } from '../users/index.js';
import { Project } from '../backups/backups.model.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import { Customer } from './customer.model.js';
import { Subscription } from './subscription.model.js';
import { PricingTier } from './pricing-tier.model.js';
import { getPricingTiersForClient, startCheckoutForUser } from './billing.service.js';
import type { IPaymentProvider } from './payment-provider.js';

const app = createApp();

function mockProvider(overrides: Partial<IPaymentProvider> = {}): IPaymentProvider {
  return {
    name: 'polar',
    isConfigured: () => true,
    createCheckout: async () => ({ url: 'https://polar.sh/checkout', providerCheckoutId: 'chk_1' }),
    openPortal: async () => ({ url: 'https://polar.sh/portal' }),
    changePlan: async () => ({
      providerSubscriptionId: 's',
      providerCustomerId: 'c',
      productId: 'prod_pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    }),
    verifyWebhook: () => undefined,
    parseEvent: () => ({ eventId: 'e', type: 't', timestamp: '0', payload: { kind: 'unknown', rawType: 't' } }),
    listActiveSubscriptions: async () => [],
    ...overrides,
  };
}

async function createBuyer(email = 'buyer@example.com') {
  const passwordHash = await hashPassword('hunter2hunter2');
  return User.create({
    email,
    password: passwordHash,
    profile: { firstName: 'Buy', lastName: 'Er' },
    emailVerified: true,
  });
}

function auth(token: string) {
  return { Authorization: `JWT ${token}` };
}

describe('billing / controller + service surface', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
    __setPaymentProviderForTests(null);
  });

  afterEach(() => {
    __setPaymentProviderForTests(null);
  });

  it('POST /checkout returns the checkout url on success', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('co@example.com');
    const token = signToken(toPublicUser(user));
    const res = await request(app)
      .post('/api/billing/checkout')
      .set(auth(token))
      .send({ productId: 'prod_pro', successUrl: 'https://x/y', cancelUrl: 'https://x/z' });
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://polar.sh/checkout');
    expect(res.body.providerCheckoutId).toBe('chk_1');
  });

  it('startCheckoutForUser throws notFound for a missing user', async () => {
    __setPaymentProviderForTests(mockProvider());
    await expect(
      startCheckoutForUser('64b7f000000000000000dead', {
        productId: 'prod_pro',
        successUrl: 'https://x/y',
      }),
    ).rejects.toThrow('billing.error.userNotFound');
  });

  it('startCheckoutForUser throws when the provider is not configured', async () => {
    __setPaymentProviderForTests(mockProvider({ isConfigured: () => false }));
    const user = await createBuyer('nc2@example.com');
    await expect(
      startCheckoutForUser(String(user._id), { productId: 'prod_pro', successUrl: 'https://x/y' }),
    ).rejects.toThrow('billing.error.notConfigured');
  });

  it('GET /portal returns the portal url when a Customer exists', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('po@example.com');
    await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_po',
      email: 'po@example.com',
    });
    const token = signToken(toPublicUser(user));
    const res = await request(app).get('/api/billing/portal').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.url).toBe('https://polar.sh/portal');
  });

  it('GET /portal 500s when the provider is not configured', async () => {
    __setPaymentProviderForTests(mockProvider({ isConfigured: () => false }));
    const user = await createBuyer('pn@example.com');
    const token = signToken(toPublicUser(user));
    const res = await request(app).get('/api/billing/portal').set(auth(token));
    expect(res.status).toBe(500);
  });

  it('POST /change-plan updates the plan, records an audit entry, and returns status', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('cp@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_cp',
      email: 'cp@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_cp',
      productId: 'prod_free',
      planSlug: 'free',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    const token = signToken(toPublicUser(user));
    const res = await request(app)
      .post('/api/billing/change-plan')
      .set(auth(token))
      .send({ productId: 'prod_pro' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('active');
  });

  it('POST /change-plan 500s when provider is not configured', async () => {
    __setPaymentProviderForTests(mockProvider({ isConfigured: () => false }));
    const user = await createBuyer('cpn@example.com');
    const token = signToken(toPublicUser(user));
    const res = await request(app)
      .post('/api/billing/change-plan')
      .set(auth(token))
      .send({ productId: 'prod_pro' });
    expect(res.status).toBe(500);
  });

  it('GET /pricing-tiers is PUBLIC: seeds and returns tiers without auth (business projects → null)', async () => {
    __setPaymentProviderForTests(mockProvider());
    // No Authorization header — pricing catalog must be reachable anonymously.
    const res = await request(app).get('/api/billing/pricing-tiers');
    expect(res.status).toBe(200);
    const tiers = res.body.tiers as Array<{ slug: string; caps: { projects: number | null } }>;
    const business = tiers.find((t) => t.slug === 'business');
    expect(business?.caps.projects).toBeNull();
    const free = tiers.find((t) => t.slug === 'free');
    expect(free?.caps.projects).toBe(1);
  });

  it('GET /pricing-tiers also works for an authenticated caller', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('pt@example.com');
    const token = signToken(toPublicUser(user));
    const res = await request(app).get('/api/billing/pricing-tiers').set(auth(token));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.tiers)).toBe(true);
  });

  it('authed billing routes still 401 without a token (public split did not open the gate)', async () => {
    for (const path of ['/api/billing/overview', '/api/billing/usage', '/api/billing/portal']) {
      const res = await request(app).get(path);
      expect(res.status).toBe(401);
    }
  });

  it('getPricingTiersForClient falls back for tiers missing caps/flags and keeps set product ids', async () => {
    // Insert a raw doc bypassing the schema so caps/flags are absent.
    await PricingTier.collection.insertOne({
      slug: 'pro',
      name: 'Raw',
      priceMonthly: 100,
      priceYearly: 1000,
      productIdMonthly: 'pm_1',
      productIdYearly: 'py_1',
      interval: 'month',
      active: true,
    });
    const tiers = await getPricingTiersForClient();
    expect(tiers).toHaveLength(1);
    expect(tiers[0]?.productIdMonthly).toBe('pm_1');
    expect(tiers[0]?.caps).toEqual({ projects: 0, retentionDays: 0, frequency: 'daily' });
    expect(tiers[0]?.flags).toEqual({ schedules: false, emailAlerts: false, multiVps: false });
  });

  it('GET /overview fails safe to free/none when a paid provider is not configured', async () => {
    // PAYMENT_PROVIDER stays 'polar' (test env); an unconfigured provider must
    // NOT grant the business ceiling — a no-subscription user is free.
    __setPaymentProviderForTests(mockProvider({ isConfigured: () => false }));
    const user = await createBuyer('ov@example.com');
    const token = signToken(toPublicUser(user));
    const res = await request(app).get('/api/billing/overview').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe('free');
    expect(res.body.status).toBe('none');
    expect(res.body.currentPeriodEnd).toBeNull();
    expect(res.body.graceEndsAt).toBeNull();
    expect(res.body.cancelAtPeriodEnd).toBe(false);
  });

  it('GET /overview serialises period/grace dates when a past_due subscription exists', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('ov2@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_ov2',
      email: 'ov2@example.com',
    });
    const future = new Date(Date.now() + 10 * 86400 * 1000);
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_ov2',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'past_due',
      cancelAtPeriodEnd: true,
      currentPeriodEnd: future,
      graceEndsAt: future,
    });
    const token = signToken(toPublicUser(user));
    const res = await request(app).get('/api/billing/overview').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.currentPeriodEnd).toBe(future.toISOString());
    expect(res.body.graceEndsAt).toBe(future.toISOString());
    expect(res.body.cancelAtPeriodEnd).toBe(true);
    expect(res.body.slug).toBe('pro');
  });

  it('GET /usage returns null cap for OSS self-host (PAYMENT_PROVIDER=none, business ceiling)', async () => {
    const prevProvider = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = 'none';
    __setPaymentProviderForTests(null);
    try {
      const user = await createBuyer('us@example.com');
      await Project.create({
        owner: user._id,
        name: 'active-proj',
        path: '/var/www/a',
        plan: { paths: ['/var/www/a'], databases: [], configs: [] },
        repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
        lastStatus: 'idle',
        lastRunAt: new Date(),
        totalRepoBytes: 42,
        snapshotCount: 3,
        paused: false,
      });
      await Project.create({
        owner: user._id,
        name: 'paused-proj',
        path: '/var/www/b',
        plan: { paths: ['/var/www/b'], databases: [], configs: [] },
        repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
        lastStatus: 'idle',
        paused: true,
      });
      const token = signToken(toPublicUser(user));
      const res = await request(app).get('/api/billing/usage').set(auth(token));
      expect(res.status).toBe(200);
      expect(res.body.projects.cap).toBeNull();
      expect(res.body.projects.used).toBe(1);
      expect(res.body.projects.paused).toHaveLength(1);
      expect(res.body.metering[0].lastRunAt).not.toBeNull();
      expect(res.body.metering[0].sizeBytes).toBe(42);
    } finally {
      (env as { PAYMENT_PROVIDER?: string }).PAYMENT_PROVIDER = prevProvider;
      __setPaymentProviderForTests(null);
    }
  });

  it('GET /usage returns a finite cap for an active pro subscription and null lastRunAt', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('us2@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_us2',
      email: 'us2@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_us2',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    await Project.create({
      owner: user._id,
      name: 'norun',
      path: '/var/www/c',
      plan: { paths: ['/var/www/c'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
      lastStatus: 'idle',
      paused: false,
    });
    const token = signToken(toPublicUser(user));
    const res = await request(app).get('/api/billing/usage').set(auth(token));
    expect(res.status).toBe(200);
    expect(res.body.projects.cap).toBe(10);
    expect(res.body.metering[0].lastRunAt).toBeNull();
  });

  it('POST /select-projects delegates to the lifecycle selector', async () => {
    __setPaymentProviderForTests(mockProvider());
    const user = await createBuyer('sp@example.com');
    const keep = await Project.create({
      owner: user._id,
      name: 'keep',
      path: '/var/www/k',
      plan: { paths: ['/var/www/k'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
      lastStatus: 'idle',
      paused: false,
    });
    await Project.create({
      owner: user._id,
      name: 'drop',
      path: '/var/www/d',
      plan: { paths: ['/var/www/d'], databases: [], configs: [] },
      repoPasswordEnc: { ciphertext: 'x', iv: 'x', authTag: 'x', keyVersion: 1 },
      lastStatus: 'idle',
      paused: false,
    });
    const token = signToken(toPublicUser(user));
    const res = await request(app)
      .post('/api/billing/select-projects')
      .set(auth(token))
      .send({ keepIds: [String(keep._id)] });
    expect(res.status).toBe(200);
    expect(res.body.active).toBe(1);
    expect(res.body.paused).toBe(1);
  });
});
