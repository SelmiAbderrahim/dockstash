import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { fetchSnapshots, restore } from './thunks';
import type { Snapshot } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface SnapshotsState {
  byProject: Record<string, Snapshot[]>;
  status: LoadState;
  error: string | null;
  activeRestoreJobId: string | null;
}

const initialState: SnapshotsState = {
  byProject: {},
  status: 'idle',
  error: null,
  activeRestoreJobId: null,
};

const slice = createSlice({
  name: 'snapshots',
  initialState,
  reducers: {
    clearRestoreJob(state) {
      state.activeRestoreJobId = null;
    },
    clearError(state) {
      state.error = null;
    },
    setActiveRestoreJob(state, action: PayloadAction<string | null>) {
      state.activeRestoreJobId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSnapshots.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchSnapshots.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.byProject[action.payload.projectId] = action.payload.snapshots;
      })
      .addCase(fetchSnapshots.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Could not load snapshots.';
      })
      .addCase(restore.fulfilled, (state, action) => {
        state.activeRestoreJobId = action.payload.jobId;
      })
      .addCase(restore.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start restore.';
      });
  },
});

export const { clearRestoreJob, clearError, setActiveRestoreJob } = slice.actions;
export const snapshotsReducer = slice.reducer;
