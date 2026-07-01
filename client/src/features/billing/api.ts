import { apiClient } from '@shared/api/client';
import type {
  ChangePlanResponse,
  CheckoutResponse,
  FetchCustomerResponse,
  MessageResponse,
  BillingOverview,
  PricingTier,
  SelectProjectsResponse,
  UsageResponse,
} from './types';

// Legacy Stripe endpoints — kept for backwards compat with existing
// `BillingSettings`. New prompt-07 UI uses the endpoints below.
export const createCustomerRequest = (
  stripeToken: string,
  plan: string,
  lastFour: string,
): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/pay/customer', {
    method: 'POST',
    auth: true,
    body: { stripeToken, plan, lastFour },
  });

export const fetchCustomerRequest = (): Promise<FetchCustomerResponse> =>
  apiClient<FetchCustomerResponse>('/pay/customer', { auth: true });

export const cancelSubscriptionRequest = (): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/pay/customer', { auth: true });

export const updateSubscriptionRequest = (newPlan: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/pay/subscription', {
    method: 'PUT',
    auth: true,
    body: { newPlan },
  });

export const updateBillingRequest = (stripeToken: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/pay/customer', {
    method: 'PUT',
    auth: true,
    body: { stripeToken },
  });

// Prompt-07 endpoints.

export const fetchPricingTiers = (): Promise<{ tiers: PricingTier[] }> =>
  apiClient<{ tiers: PricingTier[] }>('/billing/pricing-tiers');

export const fetchBillingOverview = (): Promise<BillingOverview> =>
  apiClient<BillingOverview>('/billing/overview', { auth: true });

export const fetchUsage = (): Promise<UsageResponse> =>
  apiClient<UsageResponse>('/billing/usage', { auth: true });

export const createCheckout = (
  productId: string,
  successUrl: string,
  cancelUrl?: string,
): Promise<CheckoutResponse> =>
  apiClient<CheckoutResponse>('/billing/checkout', {
    method: 'POST',
    auth: true,
    body: { productId, successUrl, cancelUrl },
  });

export const changePlan = (productId: string): Promise<ChangePlanResponse> =>
  apiClient<ChangePlanResponse>('/billing/change-plan', {
    method: 'POST',
    auth: true,
    body: { productId },
  });

export const selectProjectsToKeep = (
  keepIds: string[],
): Promise<SelectProjectsResponse> =>
  apiClient<SelectProjectsResponse>('/billing/select-projects', {
    method: 'POST',
    auth: true,
    body: { keepIds },
  });
