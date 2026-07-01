import { createSlice } from '@reduxjs/toolkit';
import {
  fetchRetention,
  fetchStorage,
  savePassword,
  saveRetention,
  saveStorage,
  testStorage,
} from './thunks';
import type { RetentionPolicy, StorageConfig } from '../types';

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
      });
  },
});

export const { clearError, resetSaveStatuses } = slice.actions;
export const settingsReducer = slice.reducer;
