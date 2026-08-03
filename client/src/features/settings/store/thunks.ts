import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  downloadJsonExport,
  exportConfigRequest,
  fetchRetentionRequest,
  fetchSelfBackupRunsRequest,
  fetchStorageRequest,
  generateRecoveryCodesRequest,
  savePasswordRequest,
  saveRetentionRequest,
  saveStorageRequest,
  testStorageRequest,
  triggerSelfBackupRequest,
} from '../api';
import type { RecoveryCodesResult, RetentionPolicy, SelfBackupRun, StorageConfig } from '../types';

export const fetchStorage = createAsyncThunk<StorageConfig, void, { rejectValue: string }>(
  'settings/fetchStorage',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchStorageRequest();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load storage settings.'));
    }
  },
);

export const saveStorage = createAsyncThunk<
  StorageConfig,
  { host: string; user: string; port: number; privateKey: string },
  { rejectValue: string }
>('settings/saveStorage', async (input, { rejectWithValue }) => {
  try {
    return await saveStorageRequest(input);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save storage settings.'));
  }
});

export const testStorage = createAsyncThunk<boolean, void, { rejectValue: string }>(
  'settings/testStorage',
  async (_, { rejectWithValue }) => {
    try {
      await testStorageRequest();
      return true;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Storage connection failed.'));
    }
  },
);

export const fetchRetention = createAsyncThunk<RetentionPolicy, void, { rejectValue: string }>(
  'settings/fetchRetention',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchRetentionRequest();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load retention.'));
    }
  },
);

export const saveRetention = createAsyncThunk<
  RetentionPolicy,
  RetentionPolicy,
  { rejectValue: string }
>('settings/saveRetention', async (input, { rejectWithValue }) => {
  try {
    return await saveRetentionRequest(input);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save retention.'));
  }
});

export const savePassword = createAsyncThunk<boolean, string, { rejectValue: string }>(
  'settings/savePassword',
  async (password, { rejectWithValue }) => {
    try {
      await savePasswordRequest(password);
      return true;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not save password.'));
    }
  },
);

export const exportConfig = createAsyncThunk<boolean, void, { rejectValue: string }>(
  'settings/exportConfig',
  async (_, { rejectWithValue }) => {
    try {
      const envelope = await exportConfigRequest();
      downloadJsonExport(envelope);
      return true;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not export configuration.'));
    }
  },
);

export const generateRecoveryCodes = createAsyncThunk<
  RecoveryCodesResult,
  void,
  { rejectValue: string }
>('settings/generateRecoveryCodes', async (_, { rejectWithValue }) => {
  try {
    return await generateRecoveryCodesRequest();
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not generate recovery codes.'));
  }
});

export const triggerSelfBackup = createAsyncThunk<boolean, void, { rejectValue: string }>(
  'settings/triggerSelfBackup',
  async (_, { rejectWithValue }) => {
    try {
      await triggerSelfBackupRequest();
      return true;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not trigger self-backup.'));
    }
  },
);

export const fetchSelfBackupRuns = createAsyncThunk<SelfBackupRun[], void, { rejectValue: string }>(
  'settings/fetchSelfBackupRuns',
  async (_, { rejectWithValue }) => {
    try {
      return await fetchSelfBackupRunsRequest();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load self-backup runs.'));
    }
  },
);
