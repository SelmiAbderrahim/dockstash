import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  changePlan as changePlanRequest,
  createCheckout as createCheckoutRequest,
  fetchBillingOverview,
  fetchPricingTiers,
  fetchUsage,
  openPortalRequest,
  selectProjectsToKeep as selectProjectsRequest,
} from '../api';
import type {
  BillingOverview,
  ChangePlanResponse,
  CheckoutResponse,
  PortalResponse,
  PricingTier,
  SelectProjectsResponse,
  UsageResponse,
} from '../types';

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

export const openPortal = createAsyncThunk<PortalResponse, void, { rejectValue: string }>(
  'billing/openPortal',
  async (_, { rejectWithValue }) => {
    try {
      return await openPortalRequest();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not open the billing portal.'));
    }
  },
);

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
