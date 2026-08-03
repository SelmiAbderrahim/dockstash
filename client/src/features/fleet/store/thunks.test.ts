import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { ApiError } from '@shared/api/client';
import { fleetReducer } from './slice';
import { deleteAgent, fetchFleet, registerAgent, rotateAgentKey } from './thunks';
import * as api from '../api';
import type { FleetEntry } from '../types';

vi.mock('../api', () => ({
  listAgentsRequest: vi.fn(),
  registerAgentRequest: vi.fn(),
  fetchFleetRequest: vi.fn(),
  rotateAgentKeyRequest: vi.fn(),
  deleteAgentRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { fleet: fleetReducer } });

const entry: FleetEntry = {
  id: 'a1',
  name: 'web-1',
  host: 'vps1.example',
  status: 'online',
  lastSeenAt: null,
  agentVersion: '0.2.0',
  outdated: false,
  projectCount: 1,
  totalBytes: 10,
  snapshotCount: 2,
};

const lockedError = () =>
  new ApiError('Request failed with status 403', 403, {
    error: { message: 'Locked', details: { reason: 'agentLimitReached', used: 1, cap: 1 } },
  });

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchFleet', () => {
  it('resolves with the fleet entries', async () => {
    mocked.fetchFleetRequest.mockResolvedValue([entry]);
    const store = makeStore();
    const result = await store.dispatch(fetchFleet());
    expect(fetchFleet.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual([entry]);
  });

  it('rejects with the server message on a 403', async () => {
    mocked.fetchFleetRequest.mockRejectedValue(lockedError());
    const store = makeStore();
    const result = await store.dispatch(fetchFleet());
    expect(fetchFleet.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({ message: 'Locked', conflict: false });
  });

  it('rejects with a plain message on generic failures', async () => {
    mocked.fetchFleetRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(fetchFleet());
    expect(fetchFleet.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({ message: 'boom', conflict: false });
  });

  it('passes the silent flag through to the pending/fulfilled meta', async () => {
    mocked.fetchFleetRequest.mockResolvedValue([entry]);
    const store = makeStore();
    const result = await store.dispatch(fetchFleet({ silent: true }));
    expect(fetchFleet.fulfilled.match(result)).toBe(true);
    expect(result.meta.arg).toEqual({ silent: true });
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
        agentVersion: '',
        outdated: false,
      },
      token: 'dsa_test.test',
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
    expect(result.payload).toEqual({ message: 'nope', conflict: false });
    expect(mocked.fetchFleetRequest).not.toHaveBeenCalled();
  });

  it('flags a 409 duplicate host as a conflict', async () => {
    mocked.registerAgentRequest.mockRejectedValue(
      new ApiError('An agent for this host already exists.', 409, {
        error: { message: 'An agent for this host already exists.' },
      }),
    );
    const store = makeStore();
    const result = await store.dispatch(registerAgent({ name: 'w', host: 'dup' }));
    expect(registerAgent.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({
      message: 'An agent for this host already exists.',
      conflict: true,
    });
  });
});

describe('rotateAgentKey', () => {
  const rotated = {
    agent: { id: 'a1', name: 'web-1', host: 'vps1.example', port: 22, status: 'online' as const, lastSeenAt: null, agentVersion: '', outdated: false },
    token: 'dsa_test.test',
  };

  it('resolves with the new one-time key payload', async () => {
    mocked.rotateAgentKeyRequest.mockResolvedValue(rotated);
    const store = makeStore();
    const result = await store.dispatch(rotateAgentKey('a1'));
    expect(rotateAgentKey.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBe(rotated);
    expect(mocked.rotateAgentKeyRequest).toHaveBeenCalledWith('a1');
  });

  it('rejects with a message on failure', async () => {
    mocked.rotateAgentKeyRequest.mockRejectedValue(new Error('agent offline'));
    const store = makeStore();
    const result = await store.dispatch(rotateAgentKey('a1'));
    expect(rotateAgentKey.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({ message: 'agent offline', conflict: false });
  });
});

describe('deleteAgent', () => {
  it('resolves with the removed agent id and refreshes the fleet silently', async () => {
    mocked.deleteAgentRequest.mockResolvedValue(undefined);
    mocked.fetchFleetRequest.mockResolvedValue([entry]);
    const store = makeStore();
    const result = await store.dispatch(deleteAgent('a1'));
    expect(deleteAgent.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBe('a1');
    expect(mocked.deleteAgentRequest).toHaveBeenCalledWith('a1');
    expect(mocked.fetchFleetRequest).toHaveBeenCalledTimes(1);
  });

  it('rejects with a message on failure and does not refresh the fleet', async () => {
    mocked.deleteAgentRequest.mockRejectedValue(new Error('cannot remove'));
    const store = makeStore();
    const result = await store.dispatch(deleteAgent('a1'));
    expect(deleteAgent.rejected.match(result)).toBe(true);
    expect(result.payload).toEqual({ message: 'cannot remove', conflict: false });
    expect(mocked.fetchFleetRequest).not.toHaveBeenCalled();
  });
});
