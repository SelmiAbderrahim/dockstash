import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { billingReducer } from './slice';
import {
  createCustomer,
  fetchCustomer,
  cancelSubscription,
  updateSubscription,
  updateBilling,
  loadPricingTiers,
  loadOverview,
  loadUsage,
  startCheckout,
  changePlan,
  selectProjectsToKeep,
} from './thunks';
import * as api from '../api';

vi.mock('../api', () => ({
  createCustomerRequest: vi.fn(),
  fetchCustomerRequest: vi.fn(),
  cancelSubscriptionRequest: vi.fn(),
  updateSubscriptionRequest: vi.fn(),
  updateBillingRequest: vi.fn(),
  fetchPricingTiers: vi.fn(),
  fetchBillingOverview: vi.fn(),
  fetchUsage: vi.fn(),
  createCheckout: vi.fn(),
  changePlan: vi.fn(),
  selectProjectsToKeep: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { billing: billingReducer } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('billing thunks — fulfilled paths', () => {
  it('createCustomer returns the message', async () => {
    mocked.createCustomerRequest.mockResolvedValue({ message: 'started' });
    const store = makeStore();
    const res = await store.dispatch(
      createCustomer({ stripeToken: 't', plan: 'gold', lastFour: '4242' }),
    );
    expect(createCustomer.fulfilled.match(res)).toBe(true);
    expect(res.payload).toBe('started');
  });

  it('fetchCustomer returns the customer', async () => {
    mocked.fetchCustomerRequest.mockResolvedValue({ customer: { sources: undefined } });
    const store = makeStore();
    const res = await store.dispatch(fetchCustomer());
    expect(fetchCustomer.fulfilled.match(res)).toBe(true);
  });

  it('cancelSubscription returns the message', async () => {
    mocked.cancelSubscriptionRequest.mockResolvedValue({ message: 'canceled' });
    const store = makeStore();
    const res = await store.dispatch(cancelSubscription());
    expect(res.payload).toBe('canceled');
  });

  it('updateSubscription returns the message', async () => {
    mocked.updateSubscriptionRequest.mockResolvedValue({ message: 'changed' });
    const store = makeStore();
    const res = await store.dispatch(updateSubscription('silver'));
    expect(res.payload).toBe('changed');
  });

  it('updateBilling returns the message', async () => {
    mocked.updateBillingRequest.mockResolvedValue({ message: 'updated' });
    const store = makeStore();
    const res = await store.dispatch(updateBilling('tok'));
    expect(res.payload).toBe('updated');
  });

  it('loadPricingTiers returns the tiers', async () => {
    mocked.fetchPricingTiers.mockResolvedValue({ tiers: [] });
    const store = makeStore();
    const res = await store.dispatch(loadPricingTiers());
    expect(loadPricingTiers.fulfilled.match(res)).toBe(true);
    expect(res.payload).toEqual([]);
  });

  it('loadOverview returns the overview', async () => {
    const overview = {
      slug: 'pro' as const,
      status: 'active' as const,
      currentPeriodEnd: null,
      graceEndsAt: null,
      cancelAtPeriodEnd: false,
      selectionRequired: false,
    };
    mocked.fetchBillingOverview.mockResolvedValue(overview);
    const store = makeStore();
    const res = await store.dispatch(loadOverview());
    expect(res.payload).toEqual(overview);
  });

  it('loadUsage returns usage', async () => {
    const usage = {
      projects: { used: 0, cap: null, active: [], paused: [] },
      metering: [],
      retentionDays: 7,
      frequency: 'daily' as const,
      flags: { schedules: false, emailAlerts: false, multiVps: false },
      selectionRequired: false,
    };
    mocked.fetchUsage.mockResolvedValue(usage);
    const store = makeStore();
    const res = await store.dispatch(loadUsage());
    expect(res.payload).toEqual(usage);
  });

  it('startCheckout returns the checkout response', async () => {
    mocked.createCheckout.mockResolvedValue({ url: 'https://x', providerCheckoutId: 'pc_1' });
    const store = makeStore();
    const res = await store.dispatch(
      startCheckout({ productId: 'p', successUrl: 's', cancelUrl: 'c' }),
    );
    expect(startCheckout.fulfilled.match(res)).toBe(true);
    expect(res.payload).toEqual({ url: 'https://x', providerCheckoutId: 'pc_1' });
  });

  it('changePlan returns the change response', async () => {
    mocked.changePlan.mockResolvedValue({ status: 'active' });
    const store = makeStore();
    const res = await store.dispatch(changePlan({ productId: 'p' }));
    expect(changePlan.fulfilled.match(res)).toBe(true);
  });

  it('selectProjectsToKeep returns the selection response', async () => {
    mocked.selectProjectsToKeep.mockResolvedValue({ active: 1, paused: 2 });
    const store = makeStore();
    const res = await store.dispatch(selectProjectsToKeep({ keepIds: ['a'] }));
    expect(selectProjectsToKeep.fulfilled.match(res)).toBe(true);
  });
});

describe('billing thunks — rejected paths', () => {
  it('createCustomer rejects with a message', async () => {
    mocked.createCustomerRequest.mockRejectedValue(new Error('boom'));
    const res = await makeStore().dispatch(
      createCustomer({ stripeToken: 't', plan: 'g', lastFour: '1' }),
    );
    expect(createCustomer.rejected.match(res)).toBe(true);
    expect(res.payload).toBe('boom');
  });

  it('fetchCustomer rejects with a fallback message', async () => {
    mocked.fetchCustomerRequest.mockRejectedValue('nope');
    const res = await makeStore().dispatch(fetchCustomer());
    expect(res.payload).toBe('Could not load customer.');
  });

  it('cancelSubscription rejects', async () => {
    mocked.cancelSubscriptionRequest.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(cancelSubscription());
    expect(cancelSubscription.rejected.match(res)).toBe(true);
  });

  it('updateSubscription rejects', async () => {
    mocked.updateSubscriptionRequest.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(updateSubscription('s'));
    expect(updateSubscription.rejected.match(res)).toBe(true);
  });

  it('updateBilling rejects', async () => {
    mocked.updateBillingRequest.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(updateBilling('t'));
    expect(updateBilling.rejected.match(res)).toBe(true);
  });

  it('loadPricingTiers rejects', async () => {
    mocked.fetchPricingTiers.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(loadPricingTiers());
    expect(loadPricingTiers.rejected.match(res)).toBe(true);
  });

  it('loadOverview rejects', async () => {
    mocked.fetchBillingOverview.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(loadOverview());
    expect(loadOverview.rejected.match(res)).toBe(true);
  });

  it('loadUsage rejects', async () => {
    mocked.fetchUsage.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(loadUsage());
    expect(loadUsage.rejected.match(res)).toBe(true);
  });

  it('startCheckout rejects', async () => {
    mocked.createCheckout.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(
      startCheckout({ productId: 'p', successUrl: 's' }),
    );
    expect(startCheckout.rejected.match(res)).toBe(true);
  });

  it('changePlan rejects', async () => {
    mocked.changePlan.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(changePlan({ productId: 'p' }));
    expect(changePlan.rejected.match(res)).toBe(true);
  });

  it('selectProjectsToKeep rejects', async () => {
    mocked.selectProjectsToKeep.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(selectProjectsToKeep({ keepIds: [] }));
    expect(selectProjectsToKeep.rejected.match(res)).toBe(true);
  });
});
