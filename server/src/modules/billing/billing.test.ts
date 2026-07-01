import { createHmac } from 'node:crypto';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { hashPassword, signToken } from '../auth/index.js';
import { toPublicUser, User } from '../users/index.js';
import { env } from '../../config/env.js';
import { PolarProvider } from './providers/polar.js';
import { StripeProvider } from './providers/stripe.js';
import { PolarApiError, setPolarRestClientFactory } from './providers/polar-rest.js';
import { __setPaymentProviderForTests, getPaymentProvider } from './active-provider.js';
import {
  __resetPolarSecretsForTests,
  getDecryptedPolarToken,
  getEncryptedPolarToken,
} from './polar-secrets.js';
import { getPlanForProductId } from './polar-config.js';
import { Customer } from './customer.model.js';
import { Subscription } from './subscription.model.js';
import { Order } from './order.model.js';
import { WebhookEvent } from './webhook-event.model.js';
import { ingestWebhook } from './webhook/ingest.js';
import { payloadHashOf } from './webhook/registry.js';
import { reconcileSubscriptions } from './reconcile.js';
import { WebhookVerifyError, type IPaymentProvider } from './payment-provider.js';

const app = createApp();

const TEST_SECRET = 'test-webhook-secret';
const NOW_SECONDS = 1_700_000_000;

function signStandardWebhook(
  rawBody: string,
  webhookId: string,
  ts: number,
  secret = TEST_SECRET,
): string {
  const signed = `${webhookId}.${ts}.${rawBody}`;
  const digest = createHmac('sha256', Buffer.from(secret, 'utf8'))
    .update(signed, 'utf8')
    .digest('base64');
  return `v1,${digest}`;
}

function buildProvider(overrides: Partial<ConstructorParameters<typeof PolarProvider>[0]> = {}) {
  return new PolarProvider({
    nowSeconds: () => NOW_SECONDS,
    getWebhookSecret: () => TEST_SECRET,
    ...overrides,
  });
}

function subscriptionEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    type: 'subscription.active',
    data: {
      id: 'sub_123',
      status: 'active',
      product_id: 'prod_pro',
      customer_id: 'cust_123',
      external_customer_id: null,
      current_period_end: new Date(NOW_SECONDS * 1000 + 30 * 86400 * 1000).toISOString(),
      cancel_at_period_end: false,
      customer: { email: 'buyer@example.com', external_id: null },
      ...overrides,
    },
  };
}

function orderEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    type: 'order.refunded',
    data: {
      id: 'ord_123',
      status: 'refunded',
      subscription_id: null,
      customer_id: 'cust_123',
      total_amount: 1999,
      currency: 'usd',
      external_customer_id: null,
      ...overrides,
    },
  };
}

async function createBuyer(email = 'buyer@example.com') {
  const passwordHash = await hashPassword('hunter2hunter2');
  return User.create({
    email,
    password: passwordHash,
    profile: { firstName: 'Buy', lastName: 'Er' },
  });
}

describe('billing / provider abstraction', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(async () => {
    await clearCollections();
    __setPaymentProviderForTests(null);
    setPolarRestClientFactory(null);
    __resetPolarSecretsForTests();
  });

  it('active-provider returns Polar by default', () => {
    const provider = getPaymentProvider();
    expect(provider.name).toBe('polar');
  });

  it('active-provider selects Stripe when PAYMENT_PROVIDER=stripe', () => {
    const prev = env.PAYMENT_PROVIDER;
    (env as { PAYMENT_PROVIDER: string }).PAYMENT_PROVIDER = 'stripe';
    __setPaymentProviderForTests(null);
    try {
      const provider = getPaymentProvider();
      expect(provider.name).toBe('stripe');
    } finally {
      (env as { PAYMENT_PROVIDER: string }).PAYMENT_PROVIDER = prev;
      __setPaymentProviderForTests(null);
    }
  });

  it('Stripe adapter conforms to IPaymentProvider (throws inactive on ops)', async () => {
    const stripe = new StripeProvider();
    expect(stripe.name).toBe('stripe');
    await expect(
      stripe.createCheckout({
        productId: 'p',
        userId: 'u',
        email: 'x@y.z',
        successUrl: 'https://x/y',
      }),
    ).rejects.toThrow(/inactive/i);
    await expect(stripe.openPortal({ providerCustomerId: 'c' })).rejects.toThrow(/inactive/i);
    await expect(
      stripe.changePlan({ providerSubscriptionId: 's', productId: 'p' }),
    ).rejects.toThrow(/inactive/i);
    expect(() =>
      stripe.verifyWebhook(Buffer.from(''), {}),
    ).toThrow(WebhookVerifyError);
    expect(() => stripe.parseEvent(Buffer.from(''), {})).toThrow(WebhookVerifyError);
    await expect(stripe.listActiveSubscriptions()).resolves.toEqual([]);
  });

  it('token at rest: ciphertext ≠ plaintext, decrypt round-trips, never in response', async () => {
    const plaintext = 'polar_pat_test_12345';
    (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = plaintext;
    __resetPolarSecretsForTests();
    const record = getEncryptedPolarToken();
    expect(record).not.toBeNull();
    expect(record?.ciphertext).not.toBe(plaintext);
    expect(getDecryptedPolarToken()).toBe(plaintext);
    (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = undefined;
    __resetPolarSecretsForTests();
    expect(getEncryptedPolarToken()).toBeNull();
    expect(getDecryptedPolarToken()).toBeNull();
  });

  it('polar-config maps product ids to plan slugs (product_id source of truth)', () => {
    const prev = { pro: env.POLAR_PRO_PRODUCT_ID, biz: env.POLAR_BUSINESS_PRODUCT_ID };
    (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = 'prod_pro';
    (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID = 'prod_biz';
    try {
      expect(getPlanForProductId('prod_pro')).toBe('pro');
      expect(getPlanForProductId('prod_biz')).toBe('business');
      expect(getPlanForProductId('prod_unknown')).toBe('free');
      expect(getPlanForProductId(null)).toBe('free');
    } finally {
      (env as { POLAR_PRO_PRODUCT_ID?: string }).POLAR_PRO_PRODUCT_ID = prev.pro;
      (env as { POLAR_BUSINESS_PRODUCT_ID?: string }).POLAR_BUSINESS_PRODUCT_ID = prev.biz;
    }
  });
});

describe('billing / webhook verification', () => {
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

  it('rejects when POLAR_WEBHOOK_SECRET is not configured', () => {
    const provider = new PolarProvider({
      nowSeconds: () => NOW_SECONDS,
      getWebhookSecret: () => null,
    });
    expect(() => provider.verifyWebhook(Buffer.from('{}'), {})).toThrow(WebhookVerifyError);
  });

  it('accepts a valid signature', () => {
    const provider = buildProvider();
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    expect(() => provider.verifyWebhook(Buffer.from(body), headers)).not.toThrow();
  });

  it('rejects tampered body', () => {
    const provider = buildProvider();
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    expect(() =>
      provider.verifyWebhook(Buffer.from(body + '!'), headers),
    ).toThrow(WebhookVerifyError);
  });

  it('rejects wrong secret', () => {
    const provider = buildProvider();
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS, 'wrong'),
    };
    expect(() => provider.verifyWebhook(Buffer.from(body), headers)).toThrow(
      WebhookVerifyError,
    );
  });

  it('rejects timestamps outside ±5min', () => {
    const provider = buildProvider();
    const oldTs = NOW_SECONDS - 6 * 60;
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(oldTs),
      'webhook-signature': signStandardWebhook(body, 'wh_1', oldTs),
    };
    expect(() => provider.verifyWebhook(Buffer.from(body), headers)).toThrow(
      WebhookVerifyError,
    );
  });

  it('rejects non-numeric webhook-timestamp', () => {
    const provider = buildProvider();
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': 'not-a-number',
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    expect(() => provider.verifyWebhook(Buffer.from(body), headers)).toThrow(
      WebhookVerifyError,
    );
  });

  it('rejects missing standard-webhooks headers', () => {
    const provider = buildProvider();
    expect(() => provider.verifyWebhook(Buffer.from('{}'), {})).toThrow(WebhookVerifyError);
  });

  it('rejects malformed / non-round-tripping base64 signatures', () => {
    const provider = buildProvider();
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': 'v1,not*base64!',
    };
    expect(() => provider.verifyWebhook(Buffer.from(body), headers)).toThrow(
      WebhookVerifyError,
    );
  });

  it('accepts whsec_ prefixed base64 secret', () => {
    const rawSecret = Buffer.from('a-secret-inside').toString('base64');
    const secret = `whsec_${rawSecret}`;
    const provider = new PolarProvider({
      nowSeconds: () => NOW_SECONDS,
      getWebhookSecret: () => secret,
    });
    const body = JSON.stringify(subscriptionEnvelope());
    const key = Buffer.from(rawSecret, 'base64');
    const sig = createHmac('sha256', key)
      .update(`wh_2.${NOW_SECONDS}.${body}`, 'utf8')
      .digest('base64');
    const headers = {
      'webhook-id': 'wh_2',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': `v1,${sig}`,
    };
    expect(() => provider.verifyWebhook(Buffer.from(body), headers)).not.toThrow();
  });

  it('parseEvent rejects invalid JSON after signature passes', () => {
    const provider = buildProvider();
    const body = 'not-json';
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    expect(() => provider.parseEvent(Buffer.from(body), headers)).toThrow(
      WebhookVerifyError,
    );
  });

  it('parseEvent rejects non-object envelope', () => {
    const provider = buildProvider();
    const body = 'null';
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    expect(() => provider.parseEvent(Buffer.from(body), headers)).toThrow(WebhookVerifyError);
  });

  it('parseEvent rejects envelope missing type', () => {
    const provider = buildProvider();
    const body = JSON.stringify({ data: {} });
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    expect(() => provider.parseEvent(Buffer.from(body), headers)).toThrow(WebhookVerifyError);
  });

  it('parseEvent rejects missing headers', () => {
    const provider = buildProvider();
    expect(() =>
      provider.parseEvent(Buffer.from(JSON.stringify(subscriptionEnvelope())), {}),
    ).toThrow(WebhookVerifyError);
  });

  it('parseEvent produces unknown for unhandled types', () => {
    const provider = buildProvider();
    const body = JSON.stringify({ type: 'benchmark.completed', data: {} });
    const headers = {
      'webhook-id': 'wh_1',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_1', NOW_SECONDS),
    };
    const parsed = provider.parseEvent(Buffer.from(body), headers);
    expect(parsed.payload.kind).toBe('unknown');
  });
});

describe('billing / ingest pipeline', () => {
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

  async function postWebhook(body: string, provider = buildProvider()) {
    const headers = {
      'webhook-id': 'wh_evt',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(body, 'wh_evt', NOW_SECONDS),
    };
    return ingestWebhook({
      provider,
      rawBody: Buffer.from(body),
      headers: headers as Record<string, string>,
    });
  }

  it('subscription.active upserts Customer + Subscription linked to User', async () => {
    const user = await createBuyer('buyer@example.com');
    const envelope = subscriptionEnvelope({
      external_customer_id: String(user._id),
    });
    const result = await postWebhook(JSON.stringify(envelope));
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('processed');

    const customer = await Customer.findOne({ provider: 'polar', providerCustomerId: 'cust_123' });
    expect(customer).not.toBeNull();
    expect(String(customer!.userId)).toBe(String(user._id));
    const sub = await Subscription.findOne({ provider: 'polar', providerSubscriptionId: 'sub_123' });
    expect(sub?.status).toBe('active');
    const linked = await User.findById(user._id);
    expect(String(linked!.subscription)).toBe(String(sub!._id));
  });

  it('subscription.canceled sets canceled', async () => {
    const user = await createBuyer('c@example.com');
    // Seed active.
    await postWebhook(
      JSON.stringify(subscriptionEnvelope({ external_customer_id: String(user._id) })),
    );
    // Cancel via a second event with a different id.
    const provider = buildProvider();
    const cancelBody = JSON.stringify({
      type: 'subscription.canceled',
      data: {
        id: 'sub_123',
        status: 'canceled',
        product_id: 'prod_pro',
        customer_id: 'cust_123',
        external_customer_id: String(user._id),
        current_period_end: null,
        cancel_at_period_end: true,
        customer: { email: 'c@example.com' },
      },
    });
    const headers = {
      'webhook-id': 'wh_cancel',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': signStandardWebhook(cancelBody, 'wh_cancel', NOW_SECONDS),
    };
    const result = await ingestWebhook({
      provider,
      rawBody: Buffer.from(cancelBody),
      headers: headers as Record<string, string>,
    });
    expect(result.statusCode).toBe(200);
    const sub = await Subscription.findOne({ provider: 'polar', providerSubscriptionId: 'sub_123' });
    expect(sub?.status).toBe('canceled');
    expect(sub?.cancelAtPeriodEnd).toBe(true);
  });

  it('order.refunded upserts a refunded Order', async () => {
    const user = await createBuyer('o@example.com');
    // Seed Customer link (order events have no email).
    await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_123',
      email: 'o@example.com',
    });
    const body = JSON.stringify(
      orderEnvelope({ external_customer_id: String(user._id) }),
    );
    const result = await postWebhook(body);
    expect(result.statusCode).toBe(200);
    const order = await Order.findOne({ provider: 'polar', providerOrderId: 'ord_123' });
    expect(order?.status).toBe('refunded');
    expect(order?.amount).toBe(1999);
  });

  it('order without customer link is skipped', async () => {
    const body = JSON.stringify(orderEnvelope({ external_customer_id: null }));
    const result = await postWebhook(body);
    expect(result.body.status).toBe('skipped');
    expect(await Order.countDocuments({})).toBe(0);
  });

  it('unhandled type → skipped, no error row', async () => {
    const body = JSON.stringify({ type: 'benchmark.completed', data: {} });
    const result = await postWebhook(body);
    expect(result.body.status).toBe('skipped');
    const evt = await WebhookEvent.findOne({ eventId: 'wh_evt' });
    expect(evt?.status).toBe('skipped');
    expect(evt?.error).toContain('unhandled type');
  });

  it('idempotency: second delivery short-circuits with stored status, no re-dispatch', async () => {
    const user = await createBuyer('idem@example.com');
    const body = JSON.stringify(
      subscriptionEnvelope({ external_customer_id: String(user._id) }),
    );
    const first = await postWebhook(body);
    expect(first.body.status).toBe('processed');
    // Mutate the Subscription so the handler would obviously overwrite it on
    // dispatch; if the guard works, it won't run twice.
    await Subscription.updateOne({ providerSubscriptionId: 'sub_123' }, { status: 'canceled' });
    const second = await postWebhook(body);
    expect(second.statusCode).toBe(200);
    expect(second.body.status).toBe('processed');
    const sub = await Subscription.findOne({ providerSubscriptionId: 'sub_123' });
    expect(sub?.status).toBe('canceled'); // untouched by the duplicate
  });

  it('handler failure marks row failed and increments retryCount', async () => {
    // Force dispatch to throw by making Subscription.findOneAndUpdate reject.
    const spy = vi
      .spyOn(Subscription, 'findOneAndUpdate')
      .mockImplementationOnce(() => {
        throw new Error('kaboom');
      });
    const user = await createBuyer('bad@example.com');
    const body = JSON.stringify(
      subscriptionEnvelope({ external_customer_id: String(user._id) }),
    );
    const result = await postWebhook(body);
    expect(result.body.status).toBe('failed');
    const evt = await WebhookEvent.findOne({ eventId: 'wh_evt' });
    expect(evt?.status).toBe('failed');
    expect(evt?.retryCount).toBe(1);
    spy.mockRestore();
  });

  it('subscription with unknown external user is skipped', async () => {
    const body = JSON.stringify(
      subscriptionEnvelope({
        external_customer_id: null,
        customer: { email: 'ghost@example.com' },
      }),
    );
    const result = await postWebhook(body);
    expect(result.body.status).toBe('skipped');
  });

  it('bad signature returns 401 from ingest and no row is created', async () => {
    const provider = buildProvider();
    const body = JSON.stringify(subscriptionEnvelope());
    const headers = {
      'webhook-id': 'wh_bad',
      'webhook-timestamp': String(NOW_SECONDS),
      'webhook-signature': 'v1,AAAA',
    };
    const result = await ingestWebhook({
      provider,
      rawBody: Buffer.from(body),
      headers: headers as Record<string, string>,
    });
    expect(result.statusCode).toBe(401);
    expect(await WebhookEvent.countDocuments({})).toBe(0);
  });

  it('payloadHashOf is deterministic', () => {
    const a = payloadHashOf(Buffer.from('abc'));
    const b = payloadHashOf(Buffer.from('abc'));
    expect(a).toBe(b);
    expect(a).not.toBe(payloadHashOf(Buffer.from('abd')));
  });
});

describe('billing / raw-body route mount order', () => {
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

  it('POST /api/billing/webhook returns 401 on bad signature (JSON parser did not swallow the body)', async () => {
    const provider = buildProvider();
    __setPaymentProviderForTests(provider);
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('webhook-id', 'wh_route')
      .set('webhook-timestamp', String(NOW_SECONDS))
      .set('webhook-signature', 'v1,AAAA')
      .send({ type: 'subscription.active', data: {} });
    expect(res.status).toBe(401);
  });

  it('POST /api/billing/webhook returns 200 on valid signature', async () => {
    const provider = buildProvider();
    __setPaymentProviderForTests(provider);
    const user = await createBuyer('route@example.com');
    const body = JSON.stringify(
      subscriptionEnvelope({ external_customer_id: String(user._id) }),
    );
    const sig = signStandardWebhook(body, 'wh_route', NOW_SECONDS);
    const res = await request(app)
      .post('/api/billing/webhook')
      .set('Content-Type', 'application/json')
      .set('webhook-id', 'wh_route')
      .set('webhook-timestamp', String(NOW_SECONDS))
      .set('webhook-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('processed');
  });

  it('authenticated /checkout returns 401 when unauthenticated', async () => {
    const res = await request(app)
      .post('/api/billing/checkout')
      .send({ productId: 'prod_pro', successUrl: 'https://x/y' });
    expect(res.status).toBe(401);
  });

  it('authenticated /checkout returns 500 (localized) when provider not configured', async () => {
    const user = await createBuyer('nc@example.com');
    const token = signToken(toPublicUser(user));
    // Reset override; the default polar provider probes env.
    __setPaymentProviderForTests(null);
    const prev = env.POLAR_ACCESS_TOKEN;
    (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = undefined;
    try {
      const res = await request(app)
        .post('/api/billing/checkout')
        .set('Authorization', `JWT ${token}`)
        .send({ productId: 'prod_pro', successUrl: 'https://x/y' });
      expect(res.status).toBe(500);
      expect(res.body.error.message).toMatch(/not configured/i);
    } finally {
      (env as { POLAR_ACCESS_TOKEN?: string }).POLAR_ACCESS_TOKEN = prev;
    }
  });

  it('authenticated /change-plan returns 404 when no local subscription exists', async () => {
    const user = await createBuyer('cp@example.com');
    const token = signToken(toPublicUser(user));
    const mock: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: 'x', providerCheckoutId: 'x' }),
      openPortal: async () => ({ url: 'x' }),
      changePlan: async () => ({
        providerSubscriptionId: 's',
        providerCustomerId: 'c',
        productId: 'p',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      }),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: 'e',
        type: 't',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: 't' },
      }),
      listActiveSubscriptions: async () => [],
    };
    __setPaymentProviderForTests(mock);
    const res = await request(app)
      .post('/api/billing/change-plan')
      .set('Authorization', `JWT ${token}`)
      .send({ productId: 'prod_pro' });
    expect(res.status).toBe(404);
  });

  it('authenticated /portal returns 404 when no local customer exists', async () => {
    const user = await createBuyer('po@example.com');
    const token = signToken(toPublicUser(user));
    const mock: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: 'x', providerCheckoutId: 'x' }),
      openPortal: async () => ({ url: 'https://portal' }),
      changePlan: async () => ({
        providerSubscriptionId: 's',
        providerCustomerId: 'c',
        productId: 'p',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
      }),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: 'e',
        type: 't',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: 't' },
      }),
      listActiveSubscriptions: async () => [],
    };
    __setPaymentProviderForTests(mock);
    const res = await request(app)
      .get('/api/billing/portal')
      .set('Authorization', `JWT ${token}`);
    expect(res.status).toBe(404);
  });
});

describe('billing / reconciliation', () => {
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

  it('heals drift on the matching local Subscription row', async () => {
    const user = await createBuyer('rec@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_r',
      email: 'rec@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_r',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    const mockProvider: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
      openPortal: async () => ({ url: '' }),
      changePlan: async () =>
        ({} as unknown as never),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: '',
        type: '',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: '' },
      }),
      listActiveSubscriptions: async () => [
        {
          providerSubscriptionId: 'sub_r',
          providerCustomerId: 'cust_r',
          productId: 'prod_pro',
          status: 'past_due',
          cancelAtPeriodEnd: true,
          currentPeriodEnd: new Date('2030-01-01T00:00:00Z'),
        },
      ],
    };
    const summary = await reconcileSubscriptions(mockProvider);
    expect(summary.polled).toBe(1);
    expect(summary.healed).toBe(1);
    const healed = await Subscription.findOne({ providerSubscriptionId: 'sub_r' });
    expect(healed?.status).toBe('past_due');
    expect(healed?.cancelAtPeriodEnd).toBe(true);
  });

  it('does not create phantom rows for subscriptions absent locally', async () => {
    const mockProvider: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
      openPortal: async () => ({ url: '' }),
      changePlan: async () => ({} as unknown as never),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: '',
        type: '',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: '' },
      }),
      listActiveSubscriptions: async () => [
        {
          providerSubscriptionId: 'sub_ghost',
          providerCustomerId: 'cust_ghost',
          productId: 'prod_pro',
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        },
      ],
    };
    const summary = await reconcileSubscriptions(mockProvider);
    expect(summary.polled).toBe(1);
    expect(summary.healed).toBe(0);
    expect(await Subscription.countDocuments({})).toBe(0);
  });

  it('one throwing record does not abort the loop', async () => {
    const user = await createBuyer('loop@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_ok',
      email: 'loop@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_ok',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    // Spy findOne: throw on the first call, delegate to real Mongoose after.
    const original = Subscription.findOne.bind(Subscription) as typeof Subscription.findOne;
    const spy = vi.spyOn(Subscription, 'findOne');
    spy
      .mockImplementationOnce(() => {
        throw new Error('boom');
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .mockImplementation((...args: any[]) => (original as any)(...args));
    const mockProvider: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
      openPortal: async () => ({ url: '' }),
      changePlan: async () => ({} as unknown as never),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: '',
        type: '',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: '' },
      }),
      listActiveSubscriptions: async () => [
        {
          providerSubscriptionId: 'first',
          providerCustomerId: 'x',
          productId: 'prod_pro',
          status: 'active',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        },
        {
          providerSubscriptionId: 'sub_ok',
          providerCustomerId: 'cust_ok',
          productId: 'prod_pro',
          status: 'past_due',
          cancelAtPeriodEnd: false,
          currentPeriodEnd: null,
        },
      ],
    };
    const summary = await reconcileSubscriptions(mockProvider);
    expect(summary.errors).toBe(1);
    // Even after one throw, the second record must still be attempted.
    expect(summary.polled).toBe(2);
    spy.mockRestore();
  });

  it('short-circuits when the provider is not configured', async () => {
    const mockProvider: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => false,
      createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
      openPortal: async () => ({ url: '' }),
      changePlan: async () => ({} as unknown as never),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: '',
        type: '',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: '' },
      }),
      listActiveSubscriptions: async () => {
        throw new Error('should not call');
      },
    };
    const summary = await reconcileSubscriptions(mockProvider);
    expect(summary).toEqual({ polled: 0, healed: 0, errors: 0 });
  });

  it('list failure returns errors=1 without aborting the process', async () => {
    const mockProvider: IPaymentProvider = {
      name: 'polar',
      isConfigured: () => true,
      createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
      openPortal: async () => ({ url: '' }),
      changePlan: async () => ({} as unknown as never),
      verifyWebhook: () => undefined,
      parseEvent: () => ({
        eventId: '',
        type: '',
        timestamp: '0',
        payload: { kind: 'unknown', rawType: '' },
      }),
      listActiveSubscriptions: async () => {
        throw new PolarApiError({
          status: 500,
          code: 'server_error',
          detail: null,
          message: 'boom',
        });
      },
    };
    const summary = await reconcileSubscriptions(mockProvider);
    expect(summary.errors).toBe(1);
  });
});

describe('billing / provider methods (mocked REST client)', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });

  afterAll(async () => {
    await stopMemoryMongo();
  });

  beforeEach(() => {
    setPolarRestClientFactory(null);
  });

  it('createCheckout POSTs to /checkouts/', async () => {
    const calls: Array<{ path: string; options: unknown }> = [];
    const provider = new PolarProvider({
      getClient: () => ({
        server: 'sandbox',
        baseUrl: 'https://sandbox-api.polar.sh/v1',
        request: async (path: string, options?: unknown) => {
          calls.push({ path, options });
          return { id: 'chk_1', url: 'https://polar.sh/checkout' } as never;
        },
      }),
      getWebhookSecret: () => TEST_SECRET,
      nowSeconds: () => NOW_SECONDS,
    });
    const result = await provider.createCheckout({
      productId: 'prod_pro',
      userId: 'u1',
      email: 'u1@x.y',
      successUrl: 'https://x/y',
    });
    expect(result.url).toBe('https://polar.sh/checkout');
    expect(calls[0]?.path).toBe('/checkouts/');
  });

  it('openPortal POSTs to /customer-sessions/', async () => {
    const provider = new PolarProvider({
      getClient: () => ({
        server: 'sandbox',
        baseUrl: 'https://sandbox-api.polar.sh/v1',
        request: async () =>
          ({ customer_portal_url: 'https://polar.sh/portal' } as never),
      }),
      getWebhookSecret: () => TEST_SECRET,
      nowSeconds: () => NOW_SECONDS,
    });
    const res = await provider.openPortal({ providerCustomerId: 'cust' });
    expect(res.url).toBe('https://polar.sh/portal');
  });

  it('changePlan PATCHes subscription and returns normalized status', async () => {
    const provider = new PolarProvider({
      getClient: () => ({
        server: 'sandbox',
        baseUrl: 'https://sandbox-api.polar.sh/v1',
        request: async () =>
          ({
            id: 'sub_x',
            status: 'active',
            product_id: 'prod_pro',
            customer_id: 'cust',
            current_period_end: '2030-01-01T00:00:00Z',
            cancel_at_period_end: false,
          } as never),
      }),
      getWebhookSecret: () => TEST_SECRET,
      nowSeconds: () => NOW_SECONDS,
    });
    const res = await provider.changePlan({
      providerSubscriptionId: 'sub_x',
      productId: 'prod_pro',
    });
    expect(res.status).toBe('active');
  });

  it('listActiveSubscriptions paginates until max_page', async () => {
    let page = 0;
    const provider = new PolarProvider({
      getClient: () => ({
        server: 'sandbox',
        baseUrl: 'https://sandbox-api.polar.sh/v1',
        request: async () => {
          page += 1;
          return {
            items: [
              {
                id: `sub_${page}`,
                status: 'active',
                product_id: 'prod_pro',
                customer_id: 'c',
                current_period_end: null,
                cancel_at_period_end: false,
              },
            ],
            pagination: { total_count: 2, max_page: 2 },
          } as never;
        },
      }),
      getWebhookSecret: () => TEST_SECRET,
      nowSeconds: () => NOW_SECONDS,
    });
    const subs = await provider.listActiveSubscriptions();
    expect(subs).toHaveLength(2);
  });
});
