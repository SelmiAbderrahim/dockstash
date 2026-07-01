import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  fetchRetentionRequest,
  fetchStorageRequest,
  savePasswordRequest,
  saveRetentionRequest,
  saveStorageRequest,
  testStorageRequest,
} from '../api';
import type { RetentionPolicy, StorageConfig } from '../types';

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
