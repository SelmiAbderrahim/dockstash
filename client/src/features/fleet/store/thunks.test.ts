import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '@shared/api/client';
import { fleetReducer } from './slice';
import { fetchFleet, lockedReasonFromError, registerAgent } from './thunks';
import * as api from '../api';
import type { FleetEntry } from '../types';

vi.mock('../api', () => ({
  listAgentsRequest: vi.fn(),
  registerAgentRequest: vi.fn(),
  fetchFleetRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { fleet: fleetReducer } });

const entry: FleetEntry = {
  id: 'a1',
  name: 'web-1',
  host: 'vps1.example',
  status: 'online',
  lastSeenAt: null,
  projectCount: 1,
  totalBytes: 10,
  snapshotCount: 2,
};

const lockedError = () =>
  new ApiError('Request failed with status 403', 403, {
    error: { message: 'Locked', details: { reason: 'multiVpsLocked' } },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('lockedReasonFromError', () => {
  it('returns the reason for a 403 ApiError carrying multiVpsLocked details', () => {
    expect(lockedReasonFromError(lockedError())).toBe('multiVpsLocked');
  });

  it('returns null for non-ApiError values', () => {
    expect(lockedReasonFromError(new Error('boom'))).toBeNull();
  });

  it('returns null for ApiErrors with a non-403 status', () => {
    const err = new ApiError('x', 500, {
      error: { details: { reason: 'multiVpsLocked' } },
    });
    expect(lockedReasonFromError(err)).toBeNull();
  });

  it('returns null when the body is missing or not an object', () => {
    expect(lockedReasonFromError(new ApiError('x', 403, null))).toBeNull();
    expect(lockedReasonFromError(new ApiError('x', 403, 'forbidden'))).toBeNull();
  });

  it('returns null when the error field is missing or not an object', () => {
    expect(lockedReasonFromError(new ApiError('x', 403, {}))).toBeNull();
    expect(lockedReasonFromError(new ApiError('x', 403, { error: 'forbidden' }))).toBeNull();
  });

  it('returns null when the details are missing or not an object', () => {
    expect(lockedReasonFromError(new ApiError('x', 403, { error: {} }))).toBeNull();
    expect(
      lockedReasonFromError(new ApiError('x', 403, { error: { details: 'nope' } })),
    ).toBeNull();
  });

  it('returns null when the reason is absent or not multiVpsLocked', () => {
    expect(lockedReasonFromError(new ApiError('x', 403, { error: { details: {} } }))).toBeNull();
    expect(
      lockedReasonFromError(new ApiError('x', 403, { error: { details: { reason: 'other' } } })),
    ).toBeNull();
  });
});

describe('fetchFleet', () => {
  it('resolves with the fleet entries', async () => {
    mocked.fetchFleetRequest.mockResolvedValue([entry]);
    const store = makeStore();
    const result = await store.dispatch(fetchFleet());
    expect(fetchFleet.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual([entry]);
  });

  it('rejects with the locked reason on an entitlement 403', async () => {
    mocked.fetchFleetRequest.mockRejectedValue(lockedError());
    const store = makeStore();
    const result = await store.dispatch(fetchFleet());
    expect(fetchFleet.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({
      message: 'Request failed with status 403',
      lockedReason: 'multiVpsLocked',
    });
  });

  it('rejects with a plain message on generic failures', async () => {
    mocked.fetchFleetRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(fetchFleet());
    expect(fetchFleet.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({ message: 'boom', lockedReason: null });
  });
});

describe('registerAgent', () => {
  it('resolves with the one-time key payload and refreshes the fleet', async () => {
    const payload = {
      agent: {
        id: 'a1',
        name: 'web-1',
        host: 'vps1.example',
        port: 7443,
        status: 'offline' as const,
        lastSeenAt: null,
      },
      apiKey: 'sk-once',
    };
    mocked.registerAgentRequest.mockResolvedValue(payload);
    mocked.fetchFleetRequest.mockResolvedValue([entry]);
    const store = makeStore();
    const result = await store.dispatch(
      registerAgent({ name: 'web-1', host: 'vps1.example', port: 7443 }),
    );
    expect(registerAgent.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBe(payload);
    expect(mocked.registerAgentRequest).toHaveBeenCalledWith({
      name: 'web-1',
      host: 'vps1.example',
      port: 7443,
    });
    expect(mocked.fetchFleetRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects with a message on failure', async () => {
    mocked.registerAgentRequest.mockRejectedValue(new Error('nope'));
    const store = makeStore();
    const result = await store.dispatch(registerAgent({ name: 'w', host: 'h' }));
    expect(registerAgent.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({ message: 'nope', lockedReason: null });
    expect(mocked.fetchFleetRequest).not.toHaveBeenCalled();
  });
});
