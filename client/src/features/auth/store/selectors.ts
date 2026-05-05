import type { RootState } from '@app/store';

export const selectAuthenticated = (state: RootState): boolean => state.auth.authenticated;
export const selectAuthError = (state: RootState): string => state.auth.error;
export const selectAuthMessage = (state: RootState): string => state.auth.message;
export const selectAuthContent = (state: RootState): string => state.auth.content;
