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
  it('fetchFleet.pending clears the error while loading', () => {
    let s = fleetReducer(initial(), {
      type: fetchFleet.rejected.type,
      payload: { message: 'x' },
    });
    s = fleetReducer(s, { type: fetchFleet.pending.type });
    expect(s.status).toBe('loading');
    expect(s.error).toBeNull();
  });

  it('fetchFleet.fulfilled stores the entries', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.fulfilled.type,
      payload: [entry],
    });
    expect(s.status).toBe('succeeded');
    expect(s.items).toEqual([entry]);
  });

  it('fetchFleet.rejected records the message (list route no longer locks)', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.rejected.type,
      payload: { message: 'nope' },
    });
    expect(s.status).toBe('failed');
    expect(s.error).toBe('nope');
  });

  it('fetchFleet.rejected falls back when the payload is missing', () => {
    const s = fleetReducer(initial(), { type: fetchFleet.rejected.type, payload: undefined });
    expect(s.error).toBe('Could not load the fleet.');
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
      payload: { message: 'taken' },
    });
    expect(s.registerStatus).toBe('failed');
    expect(s.registerError).toBe('taken');
    s = fleetReducer(initial(), { type: registerAgent.rejected.type, payload: undefined });
    expect(s.registerError).toBe('Could not register the agent.');
  });

  it('resetRegisterState clears the register status and error', () => {
    let s = fleetReducer(initial(), {
      type: registerAgent.rejected.type,
      payload: { message: 'taken' },
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
      payload: { message: 'boom' },
    });
    expect(s.status).toBe('succeeded');
    expect(s.items).toEqual([entry]);
    expect(s.error).toBeNull();
  });

  it('fetchFleet.rejected (silent) still marks failed when not already succeeded', () => {
    const s = fleetReducer(initial(), {
      type: fetchFleet.rejected.type,
      meta: { arg: { silent: true } },
      payload: { message: 'boom' },
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
      payload: { message: 'agent offline' },
    });
    expect(s.rotateStatus).toBe('failed');
    expect(s.rotateError).toBe('agent offline');
    s = fleetReducer(initial(), { type: rotateAgentKey.rejected.type, payload: undefined });
    expect(s.rotateError).toBe('Could not rotate the agent key.');
  });

  it('resetRotateState clears the rotate status and error', () => {
    let s = fleetReducer(initial(), {
      type: rotateAgentKey.rejected.type,
      payload: { message: 'x' },
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
      payload: { message: 'cannot remove' },
    });
    expect(s.deleteStatus).toBe('failed');
    expect(s.deleteError).toBe('cannot remove');
    s = fleetReducer(initial(), { type: deleteAgent.rejected.type, payload: undefined });
    expect(s.deleteError).toBe('Could not remove the agent.');
  });
});
