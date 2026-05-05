import type { RootState } from '@app/store';
import type { UserProfile } from '../types';

export const selectProfile = (state: RootState): UserProfile => state.dashboard.profile;
export const selectProfileError = (state: RootState): string => state.dashboard.error;
