import { createSlice } from '@reduxjs/toolkit';
import type { BillingState } from '../types';
import {
  cancelSubscription,
  changePlan,
  createCustomer,
  fetchCustomer,
  loadOverview,
  loadPricingTiers,
  loadUsage,
  selectProjectsToKeep,
  startCheckout,
  updateBilling,
  updateSubscription,
} from './thunks';

const initialState: BillingState = {
  customer: {},
  message: '',
  error: '',
  tiers: [],
  overview: null,
  usage: null,
  loadingTiers: false,
  loadingOverview: false,
  loadingUsage: false,
};

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {
    clearBillingMessages: (state) => {
      state.message = '';
      state.error = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(createCustomer.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(fetchCustomer.fulfilled, (state, action) => {
        state.customer = action.payload;
      })
      .addCase(cancelSubscription.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(updateSubscription.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(updateBilling.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(createCustomer.rejected, (state, action) => {
        state.error = action.payload ?? 'Billing error.';
      })
      .addCase(fetchCustomer.rejected, (state, action) => {
        state.error = action.payload ?? 'Billing error.';
      })
      .addCase(cancelSubscription.rejected, (state, action) => {
        state.error = action.payload ?? 'Billing error.';
      })
      .addCase(updateSubscription.rejected, (state, action) => {
        state.error = action.payload ?? 'Billing error.';
      })
      .addCase(updateBilling.rejected, (state, action) => {
        state.error = action.payload ?? 'Billing error.';
      })
      // Prompt-07 lifecycle.
      .addCase(loadPricingTiers.pending, (state) => {
        state.loadingTiers = true;
        state.error = '';
      })
      .addCase(loadPricingTiers.fulfilled, (state, action) => {
        state.loadingTiers = false;
        state.tiers = action.payload;
      })
      .addCase(loadPricingTiers.rejected, (state, action) => {
        state.loadingTiers = false;
        state.error = action.payload ?? 'Could not load pricing tiers.';
      })
      .addCase(loadOverview.pending, (state) => {
        state.loadingOverview = true;
      })
      .addCase(loadOverview.fulfilled, (state, action) => {
        state.loadingOverview = false;
        state.overview = action.payload;
      })
      .addCase(loadOverview.rejected, (state, action) => {
        state.loadingOverview = false;
        state.error = action.payload ?? 'Could not load overview.';
      })
      .addCase(loadUsage.pending, (state) => {
        state.loadingUsage = true;
      })
      .addCase(loadUsage.fulfilled, (state, action) => {
        state.loadingUsage = false;
        state.usage = action.payload;
      })
      .addCase(loadUsage.rejected, (state, action) => {
        state.loadingUsage = false;
        state.error = action.payload ?? 'Could not load usage.';
      })
      .addCase(startCheckout.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start checkout.';
      })
      .addCase(changePlan.fulfilled, (state) => {
        state.message = 'Plan updated.';
      })
      .addCase(changePlan.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not change plan.';
      })
      .addCase(selectProjectsToKeep.fulfilled, (state) => {
        state.message = 'Selection saved.';
      })
      .addCase(selectProjectsToKeep.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not update selection.';
      });
  },
});

export const { clearBillingMessages } = billingSlice.actions;
export const billingReducer = billingSlice.reducer;
