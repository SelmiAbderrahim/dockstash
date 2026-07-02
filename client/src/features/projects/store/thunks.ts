import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import {
  assignProjectAgentRequest,
  createScheduleRequest,
  listProjectsRequest,
  listSchedulesRequest,
  runBackupNowRequest,
  updatePlanRequest,
  updateScheduleRequest,
} from '../api';
import type { Project, ProjectPlan, Schedule } from '../types';

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
