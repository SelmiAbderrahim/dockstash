import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  cancelSubscriptionRequest,
  changePlan as changePlanRequest,
  createCheckout as createCheckoutRequest,
  createCustomerRequest,
  fetchBillingOverview,
  fetchCustomerRequest,
  fetchPricingTiers,
  fetchUsage,
  selectProjectsToKeep as selectProjectsRequest,
  updateBillingRequest,
  updateSubscriptionRequest,
} from '../api';
import type {
  BillingOverview,
  ChangePlanResponse,
  CheckoutResponse,
  Customer,
  PricingTier,
  SelectProjectsResponse,
  UsageResponse,
} from '../types';

// Legacy thunks — keep for existing UI compatibility.

export const createCustomer = createAsyncThunk<
  string,
  { stripeToken: string; plan: string; lastFour: string },
  { rejectValue: string }
>('billing/createCustomer', async ({ stripeToken, plan, lastFour }, { rejectWithValue }) => {
  try {
    const data = await createCustomerRequest(stripeToken, plan, lastFour);
    return data.message;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not start subscription.'));
  }
});

export const fetchCustomer = createAsyncThunk<Customer, void, { rejectValue: string }>(
  'billing/fetchCustomer',
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchCustomerRequest();
      return data.customer;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load customer.'));
    }
  },
);

export const cancelSubscription = createAsyncThunk<string, void, { rejectValue: string }>(
  'billing/cancelSubscription',
  async (_, { rejectWithValue }) => {
    try {
      const data = await cancelSubscriptionRequest();
      return data.message;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not cancel subscription.'));
    }
  },
);

export const updateSubscription = createAsyncThunk<string, string, { rejectValue: string }>(
  'billing/updateSubscription',
  async (newPlan, { rejectWithValue }) => {
    try {
      const data = await updateSubscriptionRequest(newPlan);
      return data.message;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not change subscription.'));
    }
  },
);

export const updateBilling = createAsyncThunk<string, string, { rejectValue: string }>(
  'billing/updateBilling',
  async (stripeToken, { rejectWithValue }) => {
    try {
      const data = await updateBillingRequest(stripeToken);
      return data.message;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not update billing.'));
    }
  },
);

// Prompt-07 thunks.

export const loadPricingTiers = createAsyncThunk<PricingTier[], void, { rejectValue: string }>(
  'billing/loadPricingTiers',
  async (_, { rejectWithValue }) => {
    try {
      const data = await fetchPricingTiers();
      return data.tiers;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load pricing tiers.'));
    }
  },
);

export const loadOverview = createAsyncThunk<BillingOverview, void, { rejectValue: string }>(
  'billing/loadOverview',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchBillingOverview();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load overview.'));
    }
  },
);

export const loadUsage = createAsyncThunk<UsageResponse, void, { rejectValue: string }>(
  'billing/loadUsage',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchUsage();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load usage.'));
    }
  },
);

export const startCheckout = createAsyncThunk<
  CheckoutResponse,
  { productId: string; successUrl: string; cancelUrl?: string },
  { rejectValue: string }
>('billing/startCheckout', async (input, { rejectWithValue }) => {
  try {
    return await createCheckoutRequest(input.productId, input.successUrl, input.cancelUrl);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not start checkout.'));
  }
});

export const changePlan = createAsyncThunk<
  ChangePlanResponse,
  { productId: string },
  { rejectValue: string }
>('billing/changePlan', async (input, { rejectWithValue }) => {
  try {
    return await changePlanRequest(input.productId);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not change plan.'));
  }
});

export const selectProjectsToKeep = createAsyncThunk<
  SelectProjectsResponse,
  { keepIds: string[] },
  { rejectValue: string }
>('billing/selectProjectsToKeep', async (input, { rejectWithValue }) => {
  try {
    return await selectProjectsRequest(input.keepIds);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not update selection.'));
  }
});
