import { describe, expect, it } from 'vitest';
import { fleetReducer, resetRegisterState, resetRotateState } from './slice';
import { deleteAgent, fetchFleet, registerAgent, rotateAgentKey } from './thunks';
import type { FleetEntry } from '../types';

const initial = () => fleetReducer(undefined, { type: 'unknown' });

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

describe('fleet slice', () => {
  it('fetchFleet.pending clears the error and lock while loading', () => {
    let s = fleetReducer(initial(), {
      type: fetchFleet.rejected.type,
      payload: { message: 'x', lockedReason: 'multiVpsLocked' },
    });
    s = fleetReducer(s, { type: fetchFleet.pending.type });
    expect(s.status).toBe('loading');
    expect(s.error).toBeNull();
    expect(s.lockedReason).toBeNull();
  });

  it('fetchFleet.fulfilled stores the entries', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.fulfilled.type,
      payload: [entry],
    });
    expect(s.status).toBe('succeeded');
    expect(s.items).toEqual([entry]);
  });

  it('fetchFleet.rejected records the message and locked reason', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.rejected.type,
      payload: { message: 'nope', lockedReason: 'multiVpsLocked' },
    });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('nope');
    expect(s.lockedReason).toBe('multiVpsLocked');
  });

  it('fetchFleet.rejected falls back when the payload is missing', () => {
    const s = fleetReducer(initial(), { type: fetchFleet.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load the fleet.');
    expect(s.lockedReason).toBeNull();
  });

  it('registerAgent lifecycle updates registerStatus', () => {
    let s = fleetReducer(initial(), { type: registerAgent.pending.type });
    expect(s.registerStatus).toBe('loading');
    expect(s.registerError).toBeNull();
    s = fleetReducer(s, { type: registerAgent.fulfilled.type });
    expect(s.registerStatus).toBe('succeeded');
  });

  it('registerAgent.rejected records the message and falls back without one', () => {
    let s = fleetReducer(initial(), {
      type: registerAgent.rejected.type,
      payload: { message: 'taken', lockedReason: null },
    });
    expect(s.registerStatus).toBe('failed');
    expect(s.registerError).toBe('taken');
    s = fleetReducer(initial(), { type: registerAgent.rejected.type, payload: undefined });
    expect(s.registerError).toBe('Could not register the agent.');
  });

  it('resetRegisterState clears the register status and error', () => {
    let s = fleetReducer(initial(), {
      type: registerAgent.rejected.type,
      payload: { message: 'taken', lockedReason: null },
    });
    s = fleetReducer(s, resetRegisterState());
    expect(s.registerStatus).toBe('idle');
    expect(s.registerError).toBeNull();
  });

  it('fetchFleet.pending (silent) keeps succeeded status and last-good items', () => {
    let s = fleetReducer(initial(), { type: fetchFleet.fulfilled.type, payload: [entry] });
    s = fleetReducer(s, { type: fetchFleet.pending.type, meta: { arg: { silent: true } } });
    expect(s.status).toBe('succeeded');
    expect(s.items).toEqual([entry]);
  });

  it('fetchFleet.pending (silent) still shows loading when not already succeeded', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.pending.type,
      meta: { arg: { silent: true } },
    });
    expect(s.status).toBe('loading');
  });

  it('fetchFleet.rejected (silent) keeps last-good data and succeeded status', () => {
    let s = fleetReducer(initial(), { type: fetchFleet.fulfilled.type, payload: [entry] });
    s = fleetReducer(s, {
      type: fetchFleet.rejected.type,
      meta: { arg: { silent: true } },
      payload: { message: 'boom', lockedReason: null },
    });
    expect(s.status).toBe('succeeded');
    expect(s.items).toEqual([entry]);
    expect(s.error).toBeNull();
  });

  it('fetchFleet.rejected (silent) still marks failed when not already succeeded', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.rejected.type,
      meta: { arg: { silent: true } },
      payload: { message: 'boom', lockedReason: null },
    });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('boom');
  });

  it('rotateAgentKey lifecycle updates rotateStatus', () => {
    let s = fleetReducer(initial(), { type: rotateAgentKey.pending.type });
    expect(s.rotateStatus).toBe('loading');
    expect(s.rotateError).toBeNull();
    s = fleetReducer(s, { type: rotateAgentKey.fulfilled.type });
    expect(s.rotateStatus).toBe('succeeded');
  });

  it('rotateAgentKey.rejected records the message and falls back without one', () => {
    let s = fleetReducer(initial(), {
      type: rotateAgentKey.rejected.type,
      payload: { message: 'agent offline', lockedReason: null },
    });
    expect(s.rotateStatus).toBe('failed');
    expect(s.rotateError).toBe('agent offline');
    s = fleetReducer(initial(), { type: rotateAgentKey.rejected.type, payload: undefined });
    expect(s.rotateError).toBe('Could not rotate the agent key.');
  });

  it('resetRotateState clears the rotate status and error', () => {
    let s = fleetReducer(initial(), {
      type: rotateAgentKey.rejected.type,
      payload: { message: 'x', lockedReason: null },
    });
    s = fleetReducer(s, resetRotateState());
    expect(s.rotateStatus).toBe('idle');
    expect(s.rotateError).toBeNull();
  });

  it('deleteAgent lifecycle updates deleteStatus and optimistically removes the entry', () => {
    let s = fleetReducer(initial(), { type: fetchFleet.fulfilled.type, payload: [entry] });
    s = fleetReducer(s, { type: deleteAgent.pending.type });
    expect(s.deleteStatus).toBe('loading');
    expect(s.deleteError).toBeNull();
    s = fleetReducer(s, { type: deleteAgent.fulfilled.type, payload: entry.id });
    expect(s.deleteStatus).toBe('succeeded');
    expect(s.items).toEqual([]);
  });

  it('deleteAgent.rejected records the message and falls back without one', () => {
    let s = fleetReducer(initial(), {
      type: deleteAgent.rejected.type,
      payload: { message: 'cannot remove', lockedReason: null },
    });
    expect(s.deleteStatus).toBe('failed');
    expect(s.deleteError).toBe('cannot remove');
    s = fleetReducer(initial(), { type: deleteAgent.rejected.type, payload: undefined });
    expect(s.deleteError).toBe('Could not remove the agent.');
  });
});
