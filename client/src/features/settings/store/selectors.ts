import type { RootState } from '@app/store';

export const selectStorage = (state: RootState) => state.settings.storage;
export const selectStorageStatus = (state: RootState) => state.settings.storageStatus;
export const selectStorageSaveStatus = (state: RootState) => state.settings.storageSaveStatus;
export const selectStorageTestStatus = (state: RootState) => state.settings.storageTestStatus;
export const selectRetention = (state: RootState) => state.settings.retention;
export const selectRetentionSaveStatus = (state: RootState) => state.settings.retentionSaveStatus;
export const selectPasswordSaveStatus = (state: RootState) => state.settings.passwordSaveStatus;
export const selectSettingsError = (state: RootState) => state.settings.error;
export const selectSetupNeeded = (state: RootState) =>
  state.settings.storageStatus === 'succeeded' && !state.settings.storage?.configured;
