import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  assignProjectAgent,
  createProject,
  discoverAgent,
  discoverContainers,
  discoverFolders,
  fetchProjectJobs,
  fetchProjects,
  fetchSchedules,
  refreshAgent,
  resolvePitr,
  runBackupNow,
  runCheckNow,
  runDrillNow,
  runMirrorNow,
  saveAlerts,
  saveMirror,
  savePlan,
  saveSchedule,
  scanProject,
  startPitrRestore,
} from './thunks';
import type {
  AgentContainerGroup,
  AgentFolder,
  DiscoveredContainerGroup,
  DiscoveredFolder,
  PitrResolution,
  Project,
  ProjectJob,
  ProjectPlan,
  Schedule,
} from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface PitrState {
  resolution: PitrResolution | null;
  status: LoadState;
  error: string | null;
  restoreJobId: string | null;
  restoreStatus: LoadState;
}

export interface ProjectsState {
  items: Project[];
  status: LoadState;
  error: string | null;
  activeJobByProject: Record<string, string | null>;
  schedules: Schedule[];
  schedulesStatus: LoadState;
  scheduleSaveStatus: LoadState;
  planSaveStatus: LoadState;
  // Point-in-time restore flow
  pitr: PitrState;
  // Fleet job history (per selected project)
  jobs: ProjectJob[];
  jobsProjectId: string | null;
  jobsStatus: LoadState;
  jobsError: string | null;
  // Alert webhook + mirror editors
  alertsSaveStatus: LoadState;
  alertsError: string | null;
  mirrorSaveStatus: LoadState;
  mirrorError: string | null;
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
  // Remote fleet-agent discovery (one snapshot fills both folders + containers)
  agentFolders: AgentFolder[];
  agentContainers: AgentContainerGroup[];
  agentDockerAvailable: boolean;
  agentRoots: string[];
  agentSnapshotAt: string | null;
  agentDiscoveryStatus: LoadState;
  agentReported: boolean;
  agentDiscoveryErrors: string[];
  agentRefreshStatus: LoadState;
}

const initialPitr: PitrState = {
  resolution: null,
  status: 'idle',
  error: null,
  restoreJobId: null,
  restoreStatus: 'idle',
};

/** Placeholder job id while an enqueue request is in flight — disables the
 * "Backup Now" button immediately without a real jobId to subscribe logs to. */
export const PENDING_JOB_ID = '__pending__';

const initialState: ProjectsState = {
  items: [],
  status: 'idle',
  error: null,
  activeJobByProject: {},
  schedules: [],
  schedulesStatus: 'idle',
  scheduleSaveStatus: 'idle',
  planSaveStatus: 'idle',
  pitr: initialPitr,
  jobs: [],
  jobsProjectId: null,
  jobsStatus: 'idle',
  jobsError: null,
  alertsSaveStatus: 'idle',
  alertsError: null,
  mirrorSaveStatus: 'idle',
  mirrorError: null,
  folders: [],
  foldersStatus: 'idle',
  containers: [],
  dockerAvailable: false,
  containersStatus: 'idle',
  scannedPlan: null,
  scanStatus: 'idle',
  createStatus: 'idle',
  addError: null,
  agentFolders: [],
  agentContainers: [],
  agentDockerAvailable: false,
  agentRoots: ['/var/www'],
  agentSnapshotAt: null,
  agentDiscoveryStatus: 'idle',
  agentReported: false,
  agentDiscoveryErrors: [],
  agentRefreshStatus: 'idle',
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
      state.alertsSaveStatus = 'idle';
      state.alertsError = null;
      state.mirrorSaveStatus = 'idle';
      state.mirrorError = null;
    },
    clearPitr(state) {
      state.pitr = initialPitr;
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
      .addCase(runBackupNow.pending, (state, action) => {
        // Disable the button the instant the click happens — not after the
        // round-trip resolves — so a second click can't fire a duplicate
        // enqueue while the first request is in flight.
        state.activeJobByProject[action.meta.arg.projectId] = PENDING_JOB_ID;
      })
      .addCase(runBackupNow.fulfilled, (state, action) => {
        state.activeJobByProject[action.payload.projectId] = action.payload.jobId;
      })
      .addCase(runBackupNow.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start backup.';
        state.activeJobByProject[action.meta.arg.projectId] = null;
      })
      .addCase(runDrillNow.pending, (state, action) => {
        state.activeJobByProject[action.meta.arg.projectId] = PENDING_JOB_ID;
      })
      .addCase(runDrillNow.fulfilled, (state, action) => {
        state.activeJobByProject[action.payload.projectId] = action.payload.jobId;
      })
      .addCase(runDrillNow.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start restore drill.';
        state.activeJobByProject[action.meta.arg.projectId] = null;
      })
      .addCase(runCheckNow.pending, (state, action) => {
        state.activeJobByProject[action.meta.arg.projectId] = PENDING_JOB_ID;
      })
      .addCase(runCheckNow.fulfilled, (state, action) => {
        state.activeJobByProject[action.payload.projectId] = action.payload.jobId;
      })
      .addCase(runCheckNow.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start repository check.';
        state.activeJobByProject[action.meta.arg.projectId] = null;
      })
      .addCase(runMirrorNow.pending, (state, action) => {
        state.activeJobByProject[action.meta.arg.projectId] = PENDING_JOB_ID;
      })
      .addCase(runMirrorNow.fulfilled, (state, action) => {
        state.activeJobByProject[action.payload.projectId] = action.payload.jobId;
      })
      .addCase(runMirrorNow.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not start mirror.';
        state.activeJobByProject[action.meta.arg.projectId] = null;
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
      .addCase(discoverAgent.pending, (state) => {
        state.agentDiscoveryStatus = 'loading';
        state.addError = null;
      })
      .addCase(discoverAgent.fulfilled, (state, action) => {
        state.agentDiscoveryStatus = 'succeeded';
        state.agentFolders = action.payload.folders;
        state.agentContainers = action.payload.containers;
        state.agentDockerAvailable = action.payload.dockerAvailable;
        // Older servers omit `roots` — keep the /var/www default in that case.
        state.agentRoots =
          action.payload.roots && action.payload.roots.length > 0
            ? action.payload.roots
            : ['/var/www'];
        state.agentSnapshotAt = action.payload.snapshotAt;
        state.agentReported = action.payload.reported;
        state.agentDiscoveryErrors = action.payload.errors;
      })
      .addCase(discoverAgent.rejected, (state, action) => {
        state.agentDiscoveryStatus = 'failed';
        state.addError = action.payload ?? 'Could not load agent discovery.';
      })
      .addCase(refreshAgent.pending, (state) => {
        state.agentRefreshStatus = 'loading';
      })
      .addCase(refreshAgent.fulfilled, (state) => {
        state.agentRefreshStatus = 'succeeded';
      })
      .addCase(refreshAgent.rejected, (state, action) => {
        state.agentRefreshStatus = 'failed';
        state.addError = action.payload ?? 'Could not request a refresh.';
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
      })
      .addCase(resolvePitr.pending, (state) => {
        state.pitr.status = 'loading';
        state.pitr.error = null;
        state.pitr.resolution = null;
      })
      .addCase(resolvePitr.fulfilled, (state, action) => {
        state.pitr.status = 'succeeded';
        state.pitr.resolution = action.payload;
      })
      .addCase(resolvePitr.rejected, (state, action) => {
        state.pitr.status = 'failed';
        state.pitr.error = action.payload ?? 'Could not resolve the point in time.';
      })
      .addCase(startPitrRestore.pending, (state) => {
        state.pitr.restoreStatus = 'loading';
        state.pitr.error = null;
      })
      .addCase(startPitrRestore.fulfilled, (state, action) => {
        state.pitr.restoreStatus = 'succeeded';
        state.pitr.restoreJobId = action.payload.jobId;
      })
      .addCase(startPitrRestore.rejected, (state, action) => {
        state.pitr.restoreStatus = 'failed';
        state.pitr.error = action.payload ?? 'Could not start the restore.';
      })
      .addCase(fetchProjectJobs.pending, (state, action) => {
        state.jobsStatus = 'loading';
        state.jobsError = null;
        // Switching projects must not flash the previous project's history.
        if (state.jobsProjectId !== action.meta.arg.projectId) {
          state.jobs = [];
          state.jobsProjectId = action.meta.arg.projectId;
        }
      })
      .addCase(fetchProjectJobs.fulfilled, (state, action) => {
        state.jobsStatus = 'succeeded';
        state.jobs = action.payload.jobs;
        state.jobsProjectId = action.payload.projectId;
      })
      .addCase(fetchProjectJobs.rejected, (state, action) => {
        state.jobsStatus = 'failed';
        state.jobsError = action.payload ?? 'Could not load job history.';
      })
      .addCase(saveAlerts.pending, (state) => {
        state.alertsSaveStatus = 'loading';
        state.alertsError = null;
      })
      .addCase(saveAlerts.fulfilled, (state, action) => {
        state.alertsSaveStatus = 'succeeded';
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(saveAlerts.rejected, (state, action) => {
        state.alertsSaveStatus = 'failed';
        state.alertsError = action.payload ?? 'Could not save alerts.';
      })
      .addCase(saveMirror.pending, (state) => {
        state.mirrorSaveStatus = 'loading';
        state.mirrorError = null;
      })
      .addCase(saveMirror.fulfilled, (state, action) => {
        state.mirrorSaveStatus = 'succeeded';
        const idx = state.items.findIndex((p) => p.id === action.payload.id);
        if (idx >= 0) state.items[idx] = action.payload;
      })
      .addCase(saveMirror.rejected, (state, action) => {
        state.mirrorSaveStatus = 'failed';
        state.mirrorError = action.payload ?? 'Could not save mirror.';
      });
  },
});

export const { clearActiveJob, resetSaveStatus, resetAddFlow, clearPitr } = projectsSlice.actions;
export const projectsReducer = projectsSlice.reducer;
