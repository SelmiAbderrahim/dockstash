import { createSlice } from '@reduxjs/toolkit';
import type { BillingState } from '../types';
import {
  cancelSubscription,
  createCustomer,
  fetchCustomer,
  updateBilling,
  updateSubscription,
} from './thunks';

const initialState: BillingState = {
  customer: {},
  message: '',
  error: '',
};

const billingSlice = createSlice({
  name: 'billing',
  initialState,
  reducers: {},
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
      });
  },
});

export const billingReducer = billingSlice.reducer;
