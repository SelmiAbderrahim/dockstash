import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { billingReducer } from './slice';
import {
  loadPricingTiers,
  loadOverview,
  loadUsage,
  openPortal,
  startCheckout,
  changePlan,
  selectProjectsToKeep,
} from './thunks';
import * as api from '../api';

vi.mock('../api', () => ({
  fetchPricingTiers: vi.fn(),
  fetchBillingOverview: vi.fn(),
  fetchUsage: vi.fn(),
  createCheckout: vi.fn(),
  openPortalRequest: vi.fn(),
  changePlan: vi.fn(),
  selectProjectsToKeep: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { billing: billingReducer } });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('billing thunks — fulfilled paths', () => {
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

  it('openPortal returns the portal url', async () => {
    mocked.openPortalRequest.mockResolvedValue({ url: 'https://portal' });
    const store = makeStore();
    const res = await store.dispatch(openPortal());
    expect(openPortal.fulfilled.match(res)).toBe(true);
    expect(res.payload).toEqual({ url: 'https://portal' });
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

  it('loadUsage rejects with a fallback message', async () => {
    mocked.fetchUsage.mockRejectedValue('nope');
    const res = await makeStore().dispatch(loadUsage());
    expect(loadUsage.rejected.match(res)).toBe(true);
    expect(res.payload).toBe('Could not load usage.');
  });

  it('startCheckout rejects', async () => {
    mocked.createCheckout.mockRejectedValue(new Error('x'));
    const res = await makeStore().dispatch(
      startCheckout({ productId: 'p', successUrl: 's' }),
    );
    expect(startCheckout.rejected.match(res)).toBe(true);
  });

  it('openPortal rejects with the error message', async () => {
    mocked.openPortalRequest.mockRejectedValue(new Error('portal down'));
    const res = await makeStore().dispatch(openPortal());
    expect(openPortal.rejected.match(res)).toBe(true);
    expect(res.payload).toBe('portal down');
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
