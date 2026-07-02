import type { RootState } from '@app/store';

export const selectAuthenticated = (state: RootState): boolean => state.auth.authenticated;
export const selectEmailVerified = (state: RootState): boolean => state.auth.emailVerified;
export const selectUserRole = (state: RootState): string => state.auth.role;
export const selectOtpChallengeId = (state: RootState): string => state.auth.otpChallengeId;
export const selectPendingVerificationEmail = (state: RootState): string =>
  state.auth.pendingVerificationEmail;
export const selectAuthError = (state: RootState): string => state.auth.error;
export const selectAuthMessage = (state: RootState): string => state.auth.message;
