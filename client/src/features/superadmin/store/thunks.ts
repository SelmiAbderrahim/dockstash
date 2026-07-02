import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  changeUserRoleRequest,
  fetchAuditRequest,
  fetchBillingRequest,
  fetchStatsRequest,
  fetchSystemRequest,
  fetchUsersRequest,
  forceVerifyUserRequest,
  scheduleDeletionRequest,
  setLegalHoldRequest,
} from '../api';
import type {
  AuditFilters,
  DeletionResponse,
  MutationResponse,
  SuperadminAuditPage,
  SuperadminBillingPage,
  SuperadminStats,
  SuperadminSystem,
  SuperadminUsersPage,
} from '../types';

export const fetchSuperadminStats = createAsyncThunk<
  SuperadminStats,
  undefined,
  { rejectValue: string }
>('superadmin/fetchStats', async (_, { rejectWithValue }) => {
  try {
    return await fetchStatsRequest();
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load stats.'));
  }
});

export const fetchSuperadminUsers = createAsyncThunk<
  SuperadminUsersPage,
  { page: number; search?: string },
  { rejectValue: string }
>('superadmin/fetchUsers', async (input, { rejectWithValue }) => {
  try {
    return await fetchUsersRequest(input);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load users.'));
  }
});

export const changeUserRole = createAsyncThunk<
  MutationResponse,
  { userId: string; role: string },
  { rejectValue: string }
>('superadmin/changeUserRole', async ({ userId, role }, { rejectWithValue }) => {
  try {
    return await changeUserRoleRequest(userId, role);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not change the role.'));
  }
});

export const forceVerifyUser = createAsyncThunk<
  MutationResponse,
  { userId: string },
  { rejectValue: string }
>('superadmin/forceVerifyUser', async ({ userId }, { rejectWithValue }) => {
  try {
    return await forceVerifyUserRequest(userId);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not verify the user.'));
  }
});

export const setLegalHold = createAsyncThunk<
  MutationResponse,
  { userId: string; legalHold: boolean },
  { rejectValue: string }
>('superadmin/setLegalHold', async ({ userId, legalHold }, { rejectWithValue }) => {
  try {
    return await setLegalHoldRequest(userId, legalHold);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not update the legal hold.'));
  }
});

export const scheduleUserDeletion = createAsyncThunk<
  DeletionResponse & { userId: string },
  { userId: string },
  { rejectValue: string }
>('superadmin/scheduleUserDeletion', async ({ userId }, { rejectWithValue }) => {
  try {
    const data = await scheduleDeletionRequest(userId);
    return { ...data, userId };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not schedule the deletion.'));
  }
});

export const fetchSuperadminBilling = createAsyncThunk<
  SuperadminBillingPage,
  { page: number },
  { rejectValue: string }
>('superadmin/fetchBilling', async (input, { rejectWithValue }) => {
  try {
    return await fetchBillingRequest(input);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load billing.'));
  }
});

export const fetchSuperadminAudit = createAsyncThunk<
  SuperadminAuditPage,
  { page: number; filters: AuditFilters },
  { rejectValue: string }
>('superadmin/fetchAudit', async (input, { rejectWithValue }) => {
  try {
    return await fetchAuditRequest(input);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load the audit log.'));
  }
});

export const fetchSuperadminSystem = createAsyncThunk<
  SuperadminSystem,
  undefined,
  { rejectValue: string }
>('superadmin/fetchSystem', async (_, { rejectWithValue }) => {
  try {
    return await fetchSystemRequest();
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load system status.'));
  }
});
