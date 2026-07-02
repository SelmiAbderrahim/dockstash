import { createSlice } from '@reduxjs/toolkit';
import {
  exportConfig,
  fetchRetention,
  fetchSelfBackupRuns,
  fetchStorage,
  generateRecoveryCodes,
  savePassword,
  saveRetention,
  saveStorage,
  testStorage,
  triggerSelfBackup,
} from './thunks';
import type { RecoveryCodesResult, RetentionPolicy, SelfBackupRun, StorageConfig } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface SettingsState {
  storage: StorageConfig | null;
  storageStatus: LoadState;
  storageSaveStatus: LoadState;
  storageTestStatus: LoadState;
  retention: RetentionPolicy | null;
  retentionStatus: LoadState;
  retentionSaveStatus: LoadState;
  passwordSaveStatus: LoadState;
  exportStatus: LoadState;
  recoveryCodes: RecoveryCodesResult | null;
  recoveryCodesStatus: LoadState;
  selfBackupTriggerStatus: LoadState;
  selfBackupRuns: SelfBackupRun[];
  selfBackupRunsStatus: LoadState;
  error: string | null;
}

const initialState: SettingsState = {
  storage: null,
  storageStatus: 'idle',
  storageSaveStatus: 'idle',
  storageTestStatus: 'idle',
  retention: null,
  retentionStatus: 'idle',
  retentionSaveStatus: 'idle',
  passwordSaveStatus: 'idle',
  exportStatus: 'idle',
  recoveryCodes: null,
  recoveryCodesStatus: 'idle',
  selfBackupTriggerStatus: 'idle',
  selfBackupRuns: [],
  selfBackupRunsStatus: 'idle',
  error: null,
};

const slice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    clearError(state) {
      state.error = null;
    },
    resetSaveStatuses(state) {
      state.storageSaveStatus = 'idle';
      state.retentionSaveStatus = 'idle';
      state.passwordSaveStatus = 'idle';
      state.storageTestStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchStorage.pending, (state) => {
        state.storageStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchStorage.fulfilled, (state, action) => {
        state.storageStatus = 'succeeded';
        state.storage = action.payload;
      })
      .addCase(fetchStorage.rejected, (state, action) => {
        state.storageStatus = 'failed';
        state.error = action.payload ?? 'Could not load storage settings.';
      })
      .addCase(saveStorage.pending, (state) => {
        state.storageSaveStatus = 'loading';
      })
      .addCase(saveStorage.fulfilled, (state, action) => {
        state.storageSaveStatus = 'succeeded';
        state.storage = action.payload;
      })
      .addCase(saveStorage.rejected, (state, action) => {
        state.storageSaveStatus = 'failed';
        state.error = action.payload ?? 'Could not save storage settings.';
      })
      .addCase(testStorage.pending, (state) => {
        state.storageTestStatus = 'loading';
      })
      .addCase(testStorage.fulfilled, (state) => {
        state.storageTestStatus = 'succeeded';
      })
      .addCase(testStorage.rejected, (state, action) => {
        state.storageTestStatus = 'failed';
        state.error = action.payload ?? 'Storage connection failed.';
      })
      .addCase(fetchRetention.pending, (state) => {
        state.retentionStatus = 'loading';
      })
      .addCase(fetchRetention.fulfilled, (state, action) => {
        state.retentionStatus = 'succeeded';
        state.retention = action.payload;
      })
      .addCase(fetchRetention.rejected, (state, action) => {
        state.retentionStatus = 'failed';
        state.error = action.payload ?? 'Could not load retention.';
      })
      .addCase(saveRetention.pending, (state) => {
        state.retentionSaveStatus = 'loading';
      })
      .addCase(saveRetention.fulfilled, (state, action) => {
        state.retentionSaveStatus = 'succeeded';
        state.retention = action.payload;
      })
      .addCase(saveRetention.rejected, (state, action) => {
        state.retentionSaveStatus = 'failed';
        state.error = action.payload ?? 'Could not save retention.';
      })
      .addCase(savePassword.pending, (state) => {
        state.passwordSaveStatus = 'loading';
      })
      .addCase(savePassword.fulfilled, (state) => {
        state.passwordSaveStatus = 'succeeded';
      })
      .addCase(savePassword.rejected, (state, action) => {
        state.passwordSaveStatus = 'failed';
        state.error = action.payload ?? 'Could not save password.';
      })
      .addCase(exportConfig.pending, (state) => {
        state.exportStatus = 'loading';
      })
      .addCase(exportConfig.fulfilled, (state) => {
        state.exportStatus = 'succeeded';
      })
      .addCase(exportConfig.rejected, (state, action) => {
        state.exportStatus = 'failed';
        state.error = action.payload ?? 'Could not export configuration.';
      })
      .addCase(generateRecoveryCodes.pending, (state) => {
        state.recoveryCodesStatus = 'loading';
      })
      .addCase(generateRecoveryCodes.fulfilled, (state, action) => {
        state.recoveryCodesStatus = 'succeeded';
        state.recoveryCodes = action.payload;
      })
      .addCase(generateRecoveryCodes.rejected, (state, action) => {
        state.recoveryCodesStatus = 'failed';
        state.error = action.payload ?? 'Could not generate recovery codes.';
      })
      .addCase(triggerSelfBackup.pending, (state) => {
        state.selfBackupTriggerStatus = 'loading';
      })
      .addCase(triggerSelfBackup.fulfilled, (state) => {
        state.selfBackupTriggerStatus = 'succeeded';
      })
      .addCase(triggerSelfBackup.rejected, (state, action) => {
        state.selfBackupTriggerStatus = 'failed';
        state.error = action.payload ?? 'Could not trigger self-backup.';
      })
      .addCase(fetchSelfBackupRuns.pending, (state) => {
        state.selfBackupRunsStatus = 'loading';
      })
      .addCase(fetchSelfBackupRuns.fulfilled, (state, action) => {
        state.selfBackupRunsStatus = 'succeeded';
        state.selfBackupRuns = action.payload;
      })
      .addCase(fetchSelfBackupRuns.rejected, (state, action) => {
        state.selfBackupRunsStatus = 'failed';
        state.error = action.payload ?? 'Could not load self-backup runs.';
      });
  },
});

export const { clearError, resetSaveStatuses } = slice.actions;
export const settingsReducer = slice.reducer;
