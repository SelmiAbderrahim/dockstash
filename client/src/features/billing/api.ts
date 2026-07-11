import { apiClient } from '@shared/api/client';
import type {
  ChangePlanResponse,
  CheckoutResponse,
  BillingOverview,
  ClaimInvitationResponse,
  PortalResponse,
  PricingTier,
  PublicInvitation,
  SelectProjectsResponse,
  UsageResponse,
} from './types';

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

export const openPortalRequest = (): Promise<PortalResponse> =>
  apiClient<PortalResponse>('/billing/portal', { auth: true });

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

/** Public — resolves logged-out so the claim page can render the offer. */
export const fetchInvitation = (token: string): Promise<PublicInvitation> =>
  apiClient<PublicInvitation>(`/invitations/${encodeURIComponent(token)}`);

export const claimInvitationRequest = (token: string): Promise<ClaimInvitationResponse> =>
  apiClient<ClaimInvitationResponse>(`/invitations/${encodeURIComponent(token)}/claim`, {
    method: 'POST',
    auth: true,
    body: {},
  });
