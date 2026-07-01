import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { fetchProjects, fetchSchedules, runBackupNow, savePlan, saveSchedule } from './thunks';
import type { Project, Schedule } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface ProjectsState {
  items: Project[];
  status: LoadState;
  error: string | null;
  activeJobByProject: Record<string, string | null>;
  schedules: Schedule[];
  schedulesStatus: LoadState;
  scheduleSaveStatus: LoadState;
  planSaveStatus: LoadState;
}

const initialState: ProjectsState = {
  items: [],
  status: 'idle',
  error: null,
  activeJobByProject: {},
  schedules: [],
  schedulesStatus: 'idle',
  scheduleSaveStatus: 'idle',
  planSaveStatus: 'idle',
};

const projectsSlice = createSlice({
  name: 'projects',
  initialState,
  reducers: {
    clearActiveJob(state, action: PayloadAction<{ projectId: string }>) {
      state.activeJobByProject[action.payload.projectId] = null;
    },
    resetSaveStatus(state) {
      state.planSaveStatus = 'idle';
      state.scheduleSaveStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProjects.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchProjects.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchProjects.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Could not load projects.';
      })
      .addCase(runBackupNow.fulfilled, (state, action) => {
        state.activeJobByProject[action.payload.projectId] = action.payload.jobId;
      })
      .addCase(runBackupNow.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start backup.';
      })
      .addCase(savePlan.pending, (state) => {
        state.planSaveStatus = 'loading';
      })
      .addCase(savePlan.fulfilled, (state, action) => {
        state.planSaveStatus = 'succeeded';
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(savePlan.rejected, (state, action) => {
        state.planSaveStatus = 'failed';
        state.error = action.payload ?? 'Could not save plan.';
      })
      .addCase(fetchSchedules.pending, (state) => {
        state.schedulesStatus = 'loading';
      })
      .addCase(fetchSchedules.fulfilled, (state, action) => {
        state.schedulesStatus = 'succeeded';
        state.schedules = action.payload;
      })
      .addCase(fetchSchedules.rejected, (state, action) => {
        state.schedulesStatus = 'failed';
        state.error = action.payload ?? 'Could not load schedules.';
      })
      .addCase(saveSchedule.pending, (state) => {
        state.scheduleSaveStatus = 'loading';
      })
      .addCase(saveSchedule.fulfilled, (state, action) => {
        state.scheduleSaveStatus = 'succeeded';
        const idx = state.schedules.findIndex((s) => s.id === action.payload.id);
        if (idx >= 0) state.schedules[idx] = action.payload;
        else state.schedules.push(action.payload);
      })
      .addCase(saveSchedule.rejected, (state, action) => {
        state.scheduleSaveStatus = 'failed';
        state.error = action.payload ?? 'Could not save schedule.';
      });
  },
});

export const { clearActiveJob, resetSaveStatus } = projectsSlice.actions;
export const projectsReducer = projectsSlice.reducer;
