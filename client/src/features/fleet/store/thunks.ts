import { createAsyncThunk } from '@reduxjs/toolkit';
import { ApiError } from '@shared/api/client';
import { messageFromError } from '@shared/utils/errors';
import {
  deleteAgentRequest,
  fetchFleetRequest,
  registerAgentRequest,
  rotateAgentKeyRequest,
} from '../api';
import type {
  FleetEntry,
  FleetLockedReason,
  RegisterAgentInput,
  RegisterAgentResult,
} from '../types';

export interface FleetRejection {
  message: string;
  lockedReason: FleetLockedReason | null;
}

/**
 * Extract the entitlement lock reason from a 403 response. The server error
 * handler emits `{ error: { message, details: { reason: 'multiVpsLocked' } } }`
 * (see server entitlements.service.ts) and ApiError exposes the parsed body
 * as `.data`.
 */
export const lockedReasonFromError = (err: unknown): FleetLockedReason | null => {
  if (!(err instanceof ApiError) || err.status !== 403) return null;
  if (!err.data || typeof err.data !== 'object') return null;
  const errorField = (err.data as { error?: unknown }).error;
  if (!errorField || typeof errorField !== 'object') return null;
  const details = (errorField as { details?: unknown }).details;
  if (!details || typeof details !== 'object') return null;
  const reason = (details as { reason?: unknown }).reason;
  return reason === 'multiVpsLocked' ? 'multiVpsLocked' : null;
};

const toRejection = (err: unknown, fallback: string): FleetRejection => ({
  message: messageFromError(err, fallback),
  lockedReason: lockedReasonFromError(err),
});

/**
 * `silent: true` polls in the background — the slice keeps the current data +
 * `succeeded` status so the table never flashes skeletons on the 30s refresh.
 */
export interface FetchFleetArg {
  silent?: boolean;
}

export const fetchFleet = createAsyncThunk<
  FleetEntry[],
  FetchFleetArg | void,
  { rejectValue: FleetRejection }
>('fleet/fetch', async (_arg, { rejectWithValue }) => {
  try {
    return await fetchFleetRequest();
  } catch (err) {
    return rejectWithValue(toRejection(err, 'Could not load the fleet.'));
  }
});

export const registerAgent = createAsyncThunk<
  RegisterAgentResult,
  RegisterAgentInput,
  { rejectValue: FleetRejection }
>('fleet/registerAgent', async (input, { dispatch, rejectWithValue }) => {
  try {
    const result = await registerAgentRequest(input);
    // Refresh the fleet so the new agent shows up behind the key dialog.
    void dispatch(fetchFleet());
    return result;
  } catch (err) {
    return rejectWithValue(toRejection(err, 'Could not register the agent.'));
  }
});

export const rotateAgentKey = createAsyncThunk<
  RegisterAgentResult,
  string,
  { rejectValue: FleetRejection }
>('fleet/rotateAgentKey', async (agentId, { rejectWithValue }) => {
  try {
    return await rotateAgentKeyRequest(agentId);
  } catch (err) {
    return rejectWithValue(toRejection(err, 'Could not rotate the agent key.'));
  }
});

export const deleteAgent = createAsyncThunk<
  string,
  string,
  { rejectValue: FleetRejection }
>('fleet/deleteAgent', async (agentId, { dispatch, rejectWithValue }) => {
  try {
    await deleteAgentRequest(agentId);
    // Refresh so the removed agent (and its rolled-up totals) disappears.
    void dispatch(fetchFleet({ silent: true }));
    return agentId;
  } catch (err) {
    return rejectWithValue(toRejection(err, 'Could not remove the agent.'));
  }
});
