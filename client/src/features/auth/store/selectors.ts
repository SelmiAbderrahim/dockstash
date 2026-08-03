import type { RootState } from '@app/store';
import type { OAuthProviders } from '../types';

export const selectAuthenticated = (state: RootState): boolean => state.auth.authenticated;
export const selectEmailVerified = (state: RootState): boolean => state.auth.emailVerified;
export const selectUserRole = (state: RootState): string => state.auth.role;
export const selectPendingVerificationEmail = (state: RootState): string =>
  state.auth.pendingVerificationEmail;
export const selectAuthError = (state: RootState): string => state.auth.error;
export const selectAuthMessage = (state: RootState): string => state.auth.message;
export const selectOAuthProviders = (state: RootState): OAuthProviders => state.auth.providers;
export const selectOAuthProvidersLoaded = (state: RootState): boolean =>
  state.auth.providersLoaded;
