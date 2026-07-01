import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import {
  clearCollections,
  startMemoryMongo,
  stopMemoryMongo,
} from '../../shared/testing/mongo.js';
import { hashPassword } from '../auth/index.js';
import { User } from '../users/index.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import { Customer } from './customer.model.js';
import { Subscription } from './subscription.model.js';
import { Order } from './order.model.js';
import { WebhookEvent } from './webhook-event.model.js';
import { dispatchEvent } from './webhook/registry.js';
import { ingestWebhook } from './webhook/ingest.js';
import { webhookHandler } from './webhook/handler.js';
import {
  WebhookVerifyError,
  type IPaymentProvider,
  type NormalizedSubscription,
  type ParsedEvent,
} from './payment-provider.js';

async function createBuyer(email = 'buyer@example.com') {
  const passwordHash = await hashPassword('hunter2hunter2');
  return User.create({
    email,
    password: passwordHash,
    profile: { firstName: 'Buy', lastName: 'Er' },
    emailVerified: true,
  });
}

/** Minimal provider whose verify/parse are supplied per-test. */
function provider(overrides: Partial<IPaymentProvider> = {}): IPaymentProvider {
  return {
    name: 'polar',
    isConfigured: () => true,
    createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
    openPortal: async () => ({ url: '' }),
    changePlan: async () => ({} as never),
    verifyWebhook: () => undefined,
    parseEvent: () => ({ eventId: 'e', type: 't', timestamp: '0', payload: { kind: 'unknown', rawType: 't' } }),
    listActiveSubscriptions: async () => [],
    ...overrides,
  };
}

function subEvent(
  eventId: string,
  sub: Record<string, unknown>,
  action: 'created' | 'updated' | 'active' | 'canceled' | 'revoked' = 'updated',
  customer?: { providerCustomerId: string; email: string; externalId?: string },
): ParsedEvent {
  return {
    eventId,
    type: `subscription.${action}`,
    timestamp: '0',
    payload: {
      kind: 'subscription',
      action,
      subscription: {
        providerSubscriptionId: 'sub_x',
        providerCustomerId: 'cust_x',
        productId: 'prod_x',
        status: 'active',
        cancelAtPeriodEnd: false,
        currentPeriodEnd: null,
        ...sub,
      } as NormalizedSubscription,
      customer,
    },
  };
}

describe('billing / webhook handler (raw body guard)', () => {
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

  it('substitutes an empty buffer when req.body is not a Buffer', async () => {
    __setPaymentProviderForTests(
      provider({
        verifyWebhook: () => {
          throw new WebhookVerifyError('bad', 401);
        },
      }),
    );
    let statusCode = 0;
    let jsonBody: unknown;
    const res = {
      status(code: number) {
        statusCode = code;
        return this;
      },
      json(body: unknown) {
        jsonBody = body;
        return this;
      },
    } as unknown as Response;
    await webhookHandler(
      { body: { not: 'a-buffer' }, headers: {} } as unknown as Request,
      res,
      () => undefined,
    );
    expect(statusCode).toBe(401);
    expect(jsonBody).toMatchObject({ status: 'invalid' });
  });
});

describe('billing / ingest error paths', () => {
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
    vi.restoreAllMocks();
    __setPaymentProviderForTests(null);
  });

  const raw = Buffer.from('{}');
  const headers = {} as Record<string, string>;

  it('non-WebhookVerifyError during verify → 500', async () => {
    const result = await ingestWebhook({
      provider: provider({
        verifyWebhook: () => {
          throw new Error('boom');
        },
      }),
      rawBody: raw,
      headers,
    });
    expect(result.statusCode).toBe(500);
    expect(result.body.status).toBe('error');
  });

  it('WebhookVerifyError during parse → invalid with its status', async () => {
    const result = await ingestWebhook({
      provider: provider({
        parseEvent: () => {
          throw new WebhookVerifyError('bad json', 400);
        },
      }),
      rawBody: raw,
      headers,
    });
    expect(result.statusCode).toBe(400);
    expect(result.body.status).toBe('invalid');
  });

  it('non-WebhookVerifyError during parse is rethrown', async () => {
    await expect(
      ingestWebhook({
        provider: provider({
          parseEvent: () => {
            throw new Error('unexpected');
          },
        }),
        rawBody: raw,
        headers,
      }),
    ).rejects.toThrow('unexpected');
  });

  it('non-duplicate create error is rethrown', async () => {
    const spy = vi.spyOn(WebhookEvent, 'create').mockRejectedValueOnce(new Error('db down') as never);
    await expect(
      ingestWebhook({
        provider: provider({
          parseEvent: () => ({ eventId: 'e1', type: 'x', timestamp: '0', payload: { kind: 'unknown', rawType: 'x' } }),
        }),
        rawBody: raw,
        headers,
      }),
    ).rejects.toThrow('db down');
    spy.mockRestore();
  });

  it('duplicate delivery with no stored row reports "duplicate"', async () => {
    const findSpy = vi.spyOn(WebhookEvent, 'findOne').mockReturnValue({
      lean: async () => null,
    } as never);
    const createSpy = vi
      .spyOn(WebhookEvent, 'create')
      .mockRejectedValueOnce({ code: 11000 } as never);
    const result = await ingestWebhook({
      provider: provider({
        parseEvent: () => ({ eventId: 'dup', type: 'x', timestamp: '0', payload: { kind: 'unknown', rawType: 'x' } }),
      }),
      rawBody: raw,
      headers,
    });
    expect(result.statusCode).toBe(200);
    expect(result.body.status).toBe('duplicate');
    findSpy.mockRestore();
    createSpy.mockRestore();
  });

  it('coerces a missing retryCount to 0 when dispatch fails', async () => {
    const user = await createBuyer('retry@example.com');
    const saved: Array<number | undefined> = [];
    const fakeDoc = {
      status: 'pending',
      retryCount: undefined as number | undefined,
      error: undefined as string | undefined,
      async save() {
        saved.push(this.retryCount);
      },
    };
    const createSpy = vi.spyOn(WebhookEvent, 'create').mockResolvedValue(fakeDoc as never);
    const foauSpy = vi.spyOn(Subscription, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw new Error('dispatch boom');
    });
    const result = await ingestWebhook({
      provider: provider({
        parseEvent: () =>
          subEvent('evt_retry', { externalCustomerId: String(user._id) }, 'updated', {
            providerCustomerId: 'cust_x',
            email: 'retry@example.com',
          }),
      }),
      rawBody: raw,
      headers,
    });
    expect(result.body.status).toBe('failed');
    expect(fakeDoc.retryCount).toBe(1);
    createSpy.mockRestore();
    foauSpy.mockRestore();
  });

  it('a non-Error thrown during dispatch is stringified onto the row', async () => {
    const user = await createBuyer('str@example.com');
    vi.spyOn(Subscription, 'findOneAndUpdate').mockImplementationOnce(() => {
      throw 'plain-string-failure';
    });
    const result = await ingestWebhook({
      provider: provider({
        parseEvent: () =>
          subEvent('evt_str', { externalCustomerId: String(user._id) }, 'updated', {
            providerCustomerId: 'cust_x',
            email: 'str@example.com',
          }),
      }),
      rawBody: raw,
      headers,
    });
    expect(result.body.status).toBe('failed');
    expect(result.body.error).toBe('plain-string-failure');
  });
});

describe('billing / dispatch registry branches', () => {
  beforeAll(async () => {
    await startMemoryMongo();
  });
  afterAll(async () => {
    await stopMemoryMongo();
  });
  beforeEach(async () => {
    await clearCollections();
  });

  it('past_due subscription starts a grace clock + dunning and defaults the customer', async () => {
    const user = await createBuyer('pd@example.com');
    const res = await dispatchEvent(
      'polar',
      subEvent('evt_pd', { externalCustomerId: String(user._id), status: 'past_due' }, 'updated'),
    );
    expect(res.status).toBe('processed');
    const sub = await Subscription.findOne({ providerSubscriptionId: 'sub_x' });
    expect(sub?.status).toBe('past_due');
    expect(sub?.graceEndsAt).toBeInstanceOf(Date);
    // customer defaulted with empty email
    const cust = await Customer.findOne({ providerCustomerId: 'cust_x' });
    expect(cust).not.toBeNull();
  });

  it('a repeat past_due delivery keeps the existing grace clock and skips dunning', async () => {
    const user = await createBuyer('grace@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_x',
      email: 'grace@example.com',
    });
    const existingGrace = new Date(Date.now() + 3 * 86400 * 1000);
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_x',
      productId: 'prod_x',
      planSlug: 'pro',
      status: 'past_due',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
      graceEndsAt: existingGrace,
    });
    const res = await dispatchEvent(
      'polar',
      subEvent('evt_grace', { externalCustomerId: String(user._id), status: 'past_due' }, 'updated', {
        providerCustomerId: 'cust_x',
        email: 'grace@example.com',
      }),
    );
    expect(res.status).toBe('processed');
    const sub = await Subscription.findOne({ providerSubscriptionId: 'sub_x' });
    // graceEndsAt is unchanged (clock never reset).
    expect(sub?.graceEndsAt?.getTime()).toBe(existingGrace.getTime());
  });

  it('revoked action forces revoked status', async () => {
    const user = await createBuyer('rv@example.com');
    const res = await dispatchEvent(
      'polar',
      subEvent('evt_rv', { externalCustomerId: String(user._id) }, 'revoked', {
        providerCustomerId: 'cust_x',
        email: 'rv@example.com',
      }),
    );
    expect(res.status).toBe('processed');
    const sub = await Subscription.findOne({ providerSubscriptionId: 'sub_x' });
    expect(sub?.status).toBe('revoked');
  });

  it('active event on a plan change triggers a downgrade sweep', async () => {
    const user = await createBuyer('dg@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_x',
      email: 'dg@example.com',
    });
    await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_x',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    // new productId maps to free (unknown) → different plan → downgrade path.
    const res = await dispatchEvent(
      'polar',
      subEvent('evt_dg', { externalCustomerId: String(user._id), productId: 'prod_unknown' }, 'active', {
        providerCustomerId: 'cust_x',
        email: 'dg@example.com',
      }),
    );
    expect(res.status).toBe('processed');
    const sub = await Subscription.findOne({ providerSubscriptionId: 'sub_x' });
    expect(sub?.planSlug).toBe('free');
  });

  it('resolves the user by email when the external id is not a valid ObjectId', async () => {
    await createBuyer('byemail@example.com');
    const res = await dispatchEvent(
      'polar',
      subEvent('evt_em', { externalCustomerId: 'not-an-object-id' }, 'updated', {
        providerCustomerId: 'cust_x',
        email: 'byemail@example.com',
      }),
    );
    expect(res.status).toBe('processed');
  });

  it('order event links to an existing subscription and resolves user via customer link', async () => {
    const user = await createBuyer('ord@example.com');
    const customer = await Customer.create({
      userId: user._id,
      provider: 'polar',
      providerCustomerId: 'cust_ord',
      email: 'ord@example.com',
    });
    const sub = await Subscription.create({
      userId: user._id,
      customerId: customer._id,
      provider: 'polar',
      providerSubscriptionId: 'sub_ord',
      productId: 'prod_pro',
      planSlug: 'pro',
      status: 'active',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: null,
    });
    const event: ParsedEvent = {
      eventId: 'evt_ord',
      type: 'order.refunded',
      timestamp: '0',
      payload: {
        kind: 'order',
        action: 'refunded',
        order: {
          providerOrderId: 'ord_1',
          providerCustomerId: 'cust_ord',
          providerSubscriptionId: 'sub_ord',
          externalCustomerId: undefined,
          amount: 1000,
          currency: 'usd',
          status: 'refunded',
        },
      },
    };
    const res = await dispatchEvent('polar', event);
    expect(res.status).toBe('processed');
    const order = await Order.findOne({ providerOrderId: 'ord_1' });
    expect(String(order?.subscriptionId)).toBe(String(sub._id));
    // refund revoked the subscription
    const healed = await Subscription.findById(sub._id);
    expect(healed?.status).toBe('revoked');
  });
});
