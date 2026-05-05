import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  cancelSubscriptionRequest,
  createCustomerRequest,
  fetchCustomerRequest,
  updateBillingRequest,
  updateSubscriptionRequest,
} from '../api';
import type { Customer } from '../types';

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
