import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  assignProjectAgentRequest,
  createProjectRequest,
  createScheduleRequest,
  discoverAgentRequest,
  discoverContainersRequest,
  discoverFoldersRequest,
  listProjectsRequest,
  listSchedulesRequest,
  pitrRestoreRequest,
  refreshAgentDiscoveryRequest,
  resolvePitrRequest,
  runBackupNowRequest,
  scanProjectRequest,
  updateAlertsRequest,
  updateMirrorRequest,
  updatePlanRequest,
  updateScheduleRequest,
} from '../api';
import type {
  AgentDiscoveryView,
  DiscoverContainersResult,
  DiscoveredFolder,
  PitrResolution,
  Project,
  ProjectPlan,
  Schedule,
} from '../types';

export const fetchProjects = createAsyncThunk<Project[], void, { rejectValue: string }>(
  'projects/fetch',
  async (_, { rejectWithValue }) => {
    try {
      return await listProjectsRequest();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load projects.'));
    }
  },
);

export const discoverFolders = createAsyncThunk<
  DiscoveredFolder[],
  void,
  { rejectValue: string }
>('projects/discoverFolders', async (_, { rejectWithValue }) => {
  try {
    return await discoverFoldersRequest();
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not scan folders.'));
  }
});

export const discoverContainers = createAsyncThunk<
  DiscoverContainersResult,
  void,
  { rejectValue: string }
>('projects/discoverContainers', async (_, { rejectWithValue }) => {
  try {
    return await discoverContainersRequest();
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not list containers.'));
  }
});

export const discoverAgent = createAsyncThunk<
  AgentDiscoveryView,
  { agentId: string },
  { rejectValue: string }
>('projects/discoverAgent', async ({ agentId }, { rejectWithValue }) => {
  try {
    return await discoverAgentRequest(agentId);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load agent discovery.'));
  }
});

export const refreshAgent = createAsyncThunk<void, { agentId: string }, { rejectValue: string }>(
  'projects/refreshAgent',
  async ({ agentId }, { rejectWithValue }) => {
    try {
      await refreshAgentDiscoveryRequest(agentId);
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not request a refresh.'));
    }
  },
);

export const scanProject = createAsyncThunk<ProjectPlan, { path: string }, { rejectValue: string }>(
  'projects/scan',
  async ({ path }, { rejectWithValue }) => {
    try {
      return await scanProjectRequest(path);
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not scan the project.'));
    }
  },
);

export const createProject = createAsyncThunk<
  Project,
  { name: string; path: string; repoPassword: string; plan: ProjectPlan; agentId?: string | null },
  { rejectValue: string }
>('projects/create', async (input, { rejectWithValue }) => {
  try {
    return await createProjectRequest(input);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not create the project.'));
  }
});

export const savePlan = createAsyncThunk<
  Project,
  { projectId: string; plan: ProjectPlan },
  { rejectValue: string }
>('projects/savePlan', async ({ projectId, plan }, { rejectWithValue }) => {
  try {
    return await updatePlanRequest(projectId, plan);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save plan.'));
  }
});

export const assignProjectAgent = createAsyncThunk<
  Project,
  { projectId: string; agentId: string | null },
  { rejectValue: string }
>('projects/assignAgent', async ({ projectId, agentId }, { rejectWithValue }) => {
  try {
    return await assignProjectAgentRequest(projectId, agentId);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not assign the agent.'));
  }
});

export const runBackupNow = createAsyncThunk<
  { projectId: string; jobId: string },
  { projectId: string },
  { rejectValue: string }
>('projects/runBackup', async ({ projectId }, { rejectWithValue }) => {
  try {
    const jobId = await runBackupNowRequest(projectId);
    return { projectId, jobId };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not start backup.'));
  }
});

export const fetchSchedules = createAsyncThunk<Schedule[], void, { rejectValue: string }>(
  'projects/fetchSchedules',
  async (_, { rejectWithValue }) => {
    try {
      return await listSchedulesRequest();
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not load schedules.'));
    }
  },
);

export const saveSchedule = createAsyncThunk<
  Schedule,
  { projectId: string; kind?: string; cron: string; enabled?: boolean; scheduleId?: string },
  { rejectValue: string }
>('projects/saveSchedule', async (input, { rejectWithValue }) => {
  try {
    if (input.scheduleId) {
      return await updateScheduleRequest(input.scheduleId, {
        cron: input.cron,
        enabled: input.enabled,
      });
    }
    return await createScheduleRequest({
      projectId: input.projectId,
      kind: input.kind ?? 'backup',
      cron: input.cron,
      enabled: input.enabled,
    });
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save schedule.'));
  }
});

export const resolvePitr = createAsyncThunk<
  PitrResolution,
  { projectId: string; ts: string },
  { rejectValue: string }
>('projects/resolvePitr', async ({ projectId, ts }, { rejectWithValue }) => {
  try {
    return await resolvePitrRequest(projectId, ts);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not resolve the point in time.'));
  }
});

export const startPitrRestore = createAsyncThunk<
  { jobId: string },
  { projectId: string; snapshotId: string; overwrite: boolean; targetPath?: string },
  { rejectValue: string }
>('projects/startPitrRestore', async (input, { rejectWithValue }) => {
  try {
    const jobId = await pitrRestoreRequest(input);
    return { jobId };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not start the restore.'));
  }
});

export const saveAlerts = createAsyncThunk<
  Project,
  { projectId: string; webhookUrl: string },
  { rejectValue: string }
>('projects/saveAlerts', async ({ projectId, webhookUrl }, { rejectWithValue }) => {
  try {
    return await updateAlertsRequest(projectId, webhookUrl);
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save alerts.'));
  }
});

export const saveMirror = createAsyncThunk<
  Project,
  { projectId: string; enabled: boolean; sourcePath: string; targetPath: string },
  { rejectValue: string }
>('projects/saveMirror', async ({ projectId, enabled, sourcePath, targetPath }, { rejectWithValue }) => {
  try {
    return await updateMirrorRequest(projectId, { enabled, sourcePath, targetPath });
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not save mirror.'));
  }
});
