import type { RootState } from '@app/store';
import type { UserProfile } from '../types';

export const selectProfile = (state: RootState): UserProfile => state.profile.profile;
export const selectProfileStatus = (state: RootState) => state.profile.status;
export const selectProfileSaveStatus = (state: RootState) => state.profile.saveStatus;
export const selectProfileError = (state: RootState) => state.profile.error;
