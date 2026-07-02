import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { startMemoryMongo, stopMemoryMongo } from '../../shared/testing/mongo.js';
import type { SchedulerCron } from '../scheduler/scheduler.boundaries.js';
import { __setPaymentProviderForTests } from './active-provider.js';
import type { IPaymentProvider } from './payment-provider.js';
import {
  GRACE_EXPIRY_CRON_ID,
  RECONCILE_CRON_ID,
  registerBillingCrons,
  unregisterBillingCrons,
} from './billing.cron.js';

function fakeScheduler(): SchedulerCron & {
  registered: Map<string, () => Promise<void>>;
  unregistered: string[];
} {
  const registered = new Map<string, () => Promise<void>>();
  const unregistered: string[] = [];
  return {
    registered,
    unregistered,
    register(id: string, _expr: string, run: () => Promise<void>) {
      registered.set(id, run);
    },
    unregister(id: string) {
      unregistered.push(id);
    },
    list: () => Array.from(registered.keys()),
    clear: () => registered.clear(),
  };
}

function providerConfigured(configured: boolean): IPaymentProvider {
  return {
    name: 'polar',
    isConfigured: () => configured,
    createCheckout: async () => ({ url: '', providerCheckoutId: '' }),
    openPortal: async () => ({ url: '' }),
    changePlan: async () => ({}) as never,
    verifyWebhook: () => undefined,
    parseEvent: () => ({
      eventId: '',
      type: '',
      timestamp: '0',
      payload: { kind: 'unknown', rawType: '' },
    }),
    listActiveSubscriptions: async () => [],
  };
}

beforeAll(async () => {
  await startMemoryMongo();
});
afterAll(async () => {
  await stopMemoryMongo();
});
afterEach(() => {
  __setPaymentProviderForTests(null);
  vi.restoreAllMocks();
});

describe('registerBillingCrons', () => {
  it('registers nothing when the provider is not configured', () => {
    __setPaymentProviderForTests(providerConfigured(false));
    const scheduler = fakeScheduler();
    expect(registerBillingCrons({ scheduler })).toBe(false);
    expect(scheduler.registered.size).toBe(0);
  });

  it('registers reconcile + grace-expiry jobs whose callbacks run', async () => {
    __setPaymentProviderForTests(providerConfigured(true));
    const scheduler = fakeScheduler();
    expect(registerBillingCrons({ scheduler })).toBe(true);
    expect(scheduler.list().sort()).toEqual(
      [GRACE_EXPIRY_CRON_ID, RECONCILE_CRON_ID].sort(),
    );
    // Callbacks execute without throwing: reconcile polls an empty remote
    // list; the grace sweep runs against an empty in-memory Mongo.
    await scheduler.registered.get(RECONCILE_CRON_ID)!();
    await scheduler.registered.get(GRACE_EXPIRY_CRON_ID)!();
  });

  it('unregisterBillingCrons removes both jobs', () => {
    const scheduler = fakeScheduler();
    unregisterBillingCrons({ scheduler });
    expect(scheduler.unregistered.sort()).toEqual(
      [GRACE_EXPIRY_CRON_ID, RECONCILE_CRON_ID].sort(),
    );
  });

  it('falls back to the shared node-cron scheduler when no dep is injected', () => {
    __setPaymentProviderForTests(providerConfigured(true));
    // Register + immediately unregister on the real singleton so no live
    // node-cron task leaks out of the test.
    expect(registerBillingCrons()).toBe(true);
    unregisterBillingCrons();
  });
});
