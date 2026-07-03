import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  assignProjectAgent,
  createProject,
  discoverContainers,
  discoverFolders,
  fetchProjects,
  fetchSchedules,
  runBackupNow,
  savePlan,
  saveSchedule,
  scanProject,
} from './thunks';
import type {
  DiscoveredContainerGroup,
  DiscoveredFolder,
  Project,
  ProjectPlan,
  Schedule,
} from '../types';

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
  // Add-project discovery flow
  folders: DiscoveredFolder[];
  foldersStatus: LoadState;
  containers: DiscoveredContainerGroup[];
  dockerAvailable: boolean;
  containersStatus: LoadState;
  scannedPlan: ProjectPlan | null;
  scanStatus: LoadState;
  createStatus: LoadState;
  addError: string | null;
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
  folders: [],
  foldersStatus: 'idle',
  containers: [],
  dockerAvailable: false,
  containersStatus: 'idle',
  scannedPlan: null,
  scanStatus: 'idle',
  createStatus: 'idle',
  addError: null,
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
    resetAddFlow(state) {
      state.scannedPlan = null;
      state.scanStatus = 'idle';
      state.createStatus = 'idle';
      state.addError = null;
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
      .addCase(assignProjectAgent.fulfilled, (state, action) => {
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(assignProjectAgent.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not assign the agent.';
      })
      .addCase(discoverFolders.pending, (state) => {
        state.foldersStatus = 'loading';
        state.addError = null;
      })
      .addCase(discoverFolders.fulfilled, (state, action) => {
        state.foldersStatus = 'succeeded';
        state.folders = action.payload;
      })
      .addCase(discoverFolders.rejected, (state, action) => {
        state.foldersStatus = 'failed';
        state.addError = action.payload ?? 'Could not scan folders.';
      })
      .addCase(discoverContainers.pending, (state) => {
        state.containersStatus = 'loading';
        state.addError = null;
      })
      .addCase(discoverContainers.fulfilled, (state, action) => {
        state.containersStatus = 'succeeded';
        state.containers = action.payload.containers;
        state.dockerAvailable = action.payload.dockerAvailable;
      })
      .addCase(discoverContainers.rejected, (state, action) => {
        state.containersStatus = 'failed';
        state.addError = action.payload ?? 'Could not list containers.';
      })
      .addCase(scanProject.pending, (state) => {
        state.scanStatus = 'loading';
        state.scannedPlan = null;
        state.addError = null;
      })
      .addCase(scanProject.fulfilled, (state, action) => {
        state.scanStatus = 'succeeded';
        state.scannedPlan = action.payload;
      })
      .addCase(scanProject.rejected, (state, action) => {
        state.scanStatus = 'failed';
        state.addError = action.payload ?? 'Could not scan the project.';
      })
      .addCase(createProject.pending, (state) => {
        state.createStatus = 'loading';
        state.addError = null;
      })
      .addCase(createProject.fulfilled, (state, action) => {
        state.createStatus = 'succeeded';
        state.items.unshift(action.payload);
      })
      .addCase(createProject.rejected, (state, action) => {
        state.createStatus = 'failed';
        state.addError = action.payload ?? 'Could not create the project.';
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

export const { clearActiveJob, resetSaveStatus, resetAddFlow } = projectsSlice.actions;
export const projectsReducer = projectsSlice.reducer;
