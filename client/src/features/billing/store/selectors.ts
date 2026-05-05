import type { RootState } from '@app/store';
import type { Customer } from '../types';

export const selectCustomer = (state: RootState): Customer => state.billing.customer;
export const selectBillingMessage = (state: RootState): string => state.billing.message;
export const selectBillingError = (state: RootState): string => state.billing.error;
