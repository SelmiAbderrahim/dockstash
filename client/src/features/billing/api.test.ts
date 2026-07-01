import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import {
  createCustomerRequest,
  fetchCustomerRequest,
  cancelSubscriptionRequest,
  updateSubscriptionRequest,
  updateBillingRequest,
  fetchPricingTiers,
  fetchBillingOverview,
  fetchUsage,
  createCheckout,
  changePlan,
  selectProjectsToKeep,
} from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.mockResolvedValue({} as never);
});

describe('billing api wrappers', () => {
  it('createCustomerRequest posts token, plan, lastFour', async () => {
    await createCustomerRequest('tok', 'gold', '4242');
    expect(apiClient).toHaveBeenCalledWith('/pay/customer', {
      method: 'POST',
      auth: true,
      body: { stripeToken: 'tok', plan: 'gold', lastFour: '4242' },
    });
  });

  it('fetchCustomerRequest gets the authed customer', async () => {
    await fetchCustomerRequest();
    expect(apiClient).toHaveBeenCalledWith('/pay/customer', { auth: true });
  });

  it('cancelSubscriptionRequest gets the authed customer', async () => {
    await cancelSubscriptionRequest();
    expect(apiClient).toHaveBeenCalledWith('/pay/customer', { auth: true });
  });

  it('updateSubscriptionRequest puts the new plan', async () => {
    await updateSubscriptionRequest('silver');
    expect(apiClient).toHaveBeenCalledWith('/pay/subscription', {
      method: 'PUT',
      auth: true,
      body: { newPlan: 'silver' },
    });
  });

  it('updateBillingRequest puts the stripe token', async () => {
    await updateBillingRequest('tok');
    expect(apiClient).toHaveBeenCalledWith('/pay/customer', {
      method: 'PUT',
      auth: true,
      body: { stripeToken: 'tok' },
    });
  });

  it('fetchPricingTiers gets public tiers', async () => {
    await fetchPricingTiers();
    expect(apiClient).toHaveBeenCalledWith('/billing/pricing-tiers');
  });

  it('fetchBillingOverview gets authed overview', async () => {
    await fetchBillingOverview();
    expect(apiClient).toHaveBeenCalledWith('/billing/overview', { auth: true });
  });

  it('fetchUsage gets authed usage', async () => {
    await fetchUsage();
    expect(apiClient).toHaveBeenCalledWith('/billing/usage', { auth: true });
  });

  it('createCheckout posts productId + urls (with cancelUrl)', async () => {
    await createCheckout('prod_1', 'https://s', 'https://c');
    expect(apiClient).toHaveBeenCalledWith('/billing/checkout', {
      method: 'POST',
      auth: true,
      body: { productId: 'prod_1', successUrl: 'https://s', cancelUrl: 'https://c' },
    });
  });

  it('createCheckout posts productId + urls (without cancelUrl)', async () => {
    await createCheckout('prod_1', 'https://s');
    expect(apiClient).toHaveBeenCalledWith('/billing/checkout', {
      method: 'POST',
      auth: true,
      body: { productId: 'prod_1', successUrl: 'https://s', cancelUrl: undefined },
    });
  });

  it('changePlan posts the productId', async () => {
    await changePlan('prod_2');
    expect(apiClient).toHaveBeenCalledWith('/billing/change-plan', {
      method: 'POST',
      auth: true,
      body: { productId: 'prod_2' },
    });
  });

  it('selectProjectsToKeep posts the keep ids', async () => {
    await selectProjectsToKeep(['a', 'b']);
    expect(apiClient).toHaveBeenCalledWith('/billing/select-projects', {
      method: 'POST',
      auth: true,
      body: { keepIds: ['a', 'b'] },
    });
  });
});
