import type { RootState } from '@app/store';

export const selectStorage = (state: RootState) => state.settings.storage;
export const selectStorageStatus = (state: RootState) => state.settings.storageStatus;
export const selectStorageSaveStatus = (state: RootState) => state.settings.storageSaveStatus;
export const selectStorageTestStatus = (state: RootState) => state.settings.storageTestStatus;
export const selectRetention = (state: RootState) => state.settings.retention;
export const selectRetentionSaveStatus = (state: RootState) => state.settings.retentionSaveStatus;
export const selectPasswordSaveStatus = (state: RootState) => state.settings.passwordSaveStatus;
export const selectSettingsError = (state: RootState) => state.settings.error;
export const selectExportStatus = (state: RootState) => state.settings.exportStatus;
export const selectRecoveryCodes = (state: RootState) => state.settings.recoveryCodes;
export const selectRecoveryCodesStatus = (state: RootState) => state.settings.recoveryCodesStatus;
export const selectSelfBackupTriggerStatus = (state: RootState) =>
  state.settings.selfBackupTriggerStatus;
export const selectSelfBackupRuns = (state: RootState) => state.settings.selfBackupRuns;
export const selectSelfBackupRunsStatus = (state: RootState) =>
  state.settings.selfBackupRunsStatus;
export const selectSetupNeeded = (state: RootState) =>
  state.settings.storageStatus === 'succeeded' && !state.settings.storage?.configured;
