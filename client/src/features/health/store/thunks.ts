import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { fetchAlertsRequest, fetchOverviewRequest, markAlertsReadRequest } from '../api';
import type { AlertItem, HealthOverview } from '../types';

export const fetchHealthOverview = createAsyncThunk<
  HealthOverview,
  void,
  { rejectValue: string }
>('health/fetchOverview', async (_, { rejectWithValue }) => {
  try {
    return await fetchOverviewRequest();
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load health overview.'));
  }
});

export const fetchAlerts = createAsyncThunk<
  AlertItem[],
  { unreadOnly?: boolean } | undefined,
  { rejectValue: string }
>('health/fetchAlerts', async (arg, { rejectWithValue }) => {
  try {
    return await fetchAlertsRequest(arg?.unreadOnly ?? false);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load alerts.'));
  }
});

export const markAlertsRead = createAsyncThunk<
  { ids?: string[]; marked: number },
  { ids?: string[] } | undefined,
  { rejectValue: string }
>('health/markAlertsRead', async (arg, { rejectWithValue }) => {
  try {
    const marked = await markAlertsReadRequest(arg?.ids);
    return { ids: arg?.ids, marked };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not mark alerts as read.'));
  }
});
