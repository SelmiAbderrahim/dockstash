import { createSlice } from '@reduxjs/toolkit';
import type { BillingState } from '../types';
import {
  changePlan,
  claimInvitation,
  loadOverview,
  loadPricingTiers,
  loadUsage,
  openPortal,
  resolveInvitation,
  selectProjectsToKeep,
  startCheckout,
} from './thunks';

const initialState: BillingState = {
  message: '',
  error: '',
  usageError: '',
  tiers: [],
  overview: null,
  usage: null,
  loadingTiers: false,
  loadingOverview: false,
  loadingUsage: false,
  invite: null,
  inviteError: '',
  claiming: false,
  claimError: '',
  claimResult: null,
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
        state.usageError = '';
      })
      .addCase(loadUsage.fulfilled, (state, action) => {
        state.loadingUsage = false;
        state.usage = action.payload;
      })
      // Usage failures surface inside the usage tab (with a retry action)
      // rather than the page-level error alert.
      .addCase(loadUsage.rejected, (state, action) => {
        state.loadingUsage = false;
        state.usageError = action.payload ?? 'Could not load usage.';
      })
      .addCase(startCheckout.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start checkout.';
      })
      .addCase(openPortal.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not open the billing portal.';
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
      })
      .addCase(resolveInvitation.pending, (state) => {
        state.invite = null;
        state.inviteError = '';
        state.claimError = '';
        state.claimResult = null;
      })
      .addCase(resolveInvitation.fulfilled, (state, action) => {
        state.invite = action.payload;
      })
      .addCase(resolveInvitation.rejected, (state, action) => {
        state.inviteError = action.payload ?? 'That invitation link is not valid.';
      })
      .addCase(claimInvitation.pending, (state) => {
        state.claiming = true;
        state.claimError = '';
      })
      .addCase(claimInvitation.fulfilled, (state, action) => {
        state.claiming = false;
        state.claimResult = action.payload;
      })
      .addCase(claimInvitation.rejected, (state, action) => {
        state.claiming = false;
        state.claimError = action.payload ?? 'Could not activate the invitation.';
      });
  },
});

export const { clearBillingMessages } = billingSlice.actions;
export const billingReducer = billingSlice.reducer;
