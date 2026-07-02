import { describe, expect, it } from 'vitest';
import {
  selectFleet,
  selectFleetError,
  selectFleetLockedReason,
  selectFleetStatus,
  selectRegisterError,
  selectRegisterStatus,
} from './selectors';
import type { FleetState } from './slice';
import type { FleetEntry } from '../types';
import type { RootState } from '@app/store';

const entry = { id: 'a1', name: 'web-1' } as unknown as FleetEntry;

const fleet: FleetState = {
  items: [entry],
  status: 'succeeded',
  error: 'oops',
  lockedReason: 'multiVpsLocked',
  registerStatus: 'failed',
  registerError: 'taken',
};

const state = { fleet } as unknown as RootState;

describe('fleet selectors', () => {
  it('reads each slice of fleet state', () => {
    expect(selectFleet(state)).toEqual([entry]);
    expect(selectFleetStatus(state)).toBe('succeeded');
    expect(selectFleetError(state)).toBe('oops');
    expect(selectFleetLockedReason(state)).toBe('multiVpsLocked');
    expect(selectRegisterStatus(state)).toBe('failed');
    expect(selectRegisterError(state)).toBe('taken');
  });
});
