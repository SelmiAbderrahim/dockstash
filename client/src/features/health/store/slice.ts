import { createSlice } from '@reduxjs/toolkit';
import { fetchAlerts, fetchHealthOverview, markAlertsRead } from './thunks';
import type { AlertItem, HealthOverview } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface HealthState {
  overview: HealthOverview | null;
  alerts: AlertItem[];
  status: LoadState;
  alertsStatus: LoadState;
  markStatus: LoadState;
  error: string | null;
}

const initialState: HealthState = {
  overview: null,
  alerts: [],
  status: 'idle',
  alertsStatus: 'idle',
  markStatus: 'idle',
  error: null,
};

const slice = createSlice({
  name: 'health',
  initialState,
  reducers: {
    clearHealthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHealthOverview.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchHealthOverview.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.overview = action.payload;
      })
      .addCase(fetchHealthOverview.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Could not load health overview.';
      })
      .addCase(fetchAlerts.pending, (state) => {
        state.alertsStatus = 'loading';
        state.error = null;
      })
      .addCase(fetchAlerts.fulfilled, (state, action) => {
        state.alertsStatus = 'succeeded';
        state.alerts = action.payload;
      })
      .addCase(fetchAlerts.rejected, (state, action) => {
        state.alertsStatus = 'failed';
        state.error = action.payload ?? 'Could not load alerts.';
      })
      .addCase(markAlertsRead.pending, (state) => {
        state.markStatus = 'loading';
        state.error = null;
      })
      .addCase(markAlertsRead.fulfilled, (state, action) => {
        state.markStatus = 'succeeded';
        const ids = action.payload.ids;
        let newlyRead = 0;
        for (const alert of state.alerts) {
          if (ids && !ids.includes(alert.id)) continue;
          if (!alert.read) newlyRead += 1;
          alert.read = true;
        }
        if (state.overview) {
          state.overview.unreadAlerts = ids
            ? Math.max(0, state.overview.unreadAlerts - newlyRead)
            : 0;
        }
      })
      .addCase(markAlertsRead.rejected, (state, action) => {
        state.markStatus = 'failed';
        state.error = action.payload ?? 'Could not mark alerts as read.';
      });
  },
});

export const { clearHealthError } = slice.actions;
export const healthReducer = slice.reducer;
