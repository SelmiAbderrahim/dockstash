import type { RootState } from '@app/store';
import type {
  BillingOverview,
  ClaimInvitationResponse,
  PricingTier,
  PublicInvitation,
  UsageResponse,
} from '../types';

export const selectBillingMessage = (state: RootState): string => state.billing.message;
export const selectBillingError = (state: RootState): string => state.billing.error;
export const selectUsageError = (state: RootState): string => state.billing.usageError;
export const selectPricingTiers = (state: RootState): PricingTier[] => state.billing.tiers;
export const selectBillingOverview = (state: RootState): BillingOverview | null =>
  state.billing.overview;
export const selectUsage = (state: RootState): UsageResponse | null => state.billing.usage;
export const selectLoadingTiers = (state: RootState): boolean => state.billing.loadingTiers;
export const selectLoadingOverview = (state: RootState): boolean =>
  state.billing.loadingOverview;
export const selectLoadingUsage = (state: RootState): boolean => state.billing.loadingUsage;
export const selectInvite = (state: RootState): PublicInvitation | null => state.billing.invite;
export const selectInviteError = (state: RootState): string => state.billing.inviteError;
export const selectClaiming = (state: RootState): boolean => state.billing.claiming;
export const selectClaimError = (state: RootState): string => state.billing.claimError;
export const selectClaimResult = (state: RootState): ClaimInvitationResponse | null =>
  state.billing.claimResult;
