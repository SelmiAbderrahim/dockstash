import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { listSnapshotsRequest, restoreRequest } from '../api';
import type { RestoreOptions, Snapshot } from '../types';

export const fetchSnapshots = createAsyncThunk<
  { projectId: string; snapshots: Snapshot[] },
  { projectId: string },
  { rejectValue: string }
>('snapshots/fetch', async ({ projectId }, { rejectWithValue }) => {
  try {
    const snapshots = await listSnapshotsRequest(projectId);
    return { projectId, snapshots };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not load snapshots.'));
  }
});

export const restore = createAsyncThunk<
  { projectId: string; jobId: string },
  RestoreOptions,
  { rejectValue: string }
>('snapshots/restore', async (opts, { rejectWithValue }) => {
  try {
    const jobId = await restoreRequest(opts);
    return { projectId: opts.projectId, jobId };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not start restore.'));
  }
});
