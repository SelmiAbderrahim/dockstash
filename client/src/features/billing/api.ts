import { apiClient } from '@shared/api/client';
import type { FetchCustomerResponse, MessageResponse } from './types';

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
