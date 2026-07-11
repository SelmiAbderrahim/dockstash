import { describe, expect, it } from 'vitest';
import type { RootState } from '@app/store';
import { superadminReducer } from './slice';
import * as selectors from './selectors';

const rootState = (): RootState =>
  ({ superadmin: superadminReducer(undefined, { type: 'unknown' }) }) as RootState;

describe('superadmin selectors', () => {
  it('each selector reads its slice field', () => {
    const state = rootState();
    expect(selectors.selectSuperadminStats(state)).toBeNull();
    expect(selectors.selectLoadingStats(state)).toBe(false);
    expect(selectors.selectSuperadminUsers(state)).toBeNull();
    expect(selectors.selectLoadingUsers(state)).toBe(false);
    expect(selectors.selectUsersSearch(state)).toBe('');
    expect(selectors.selectSuperadminBilling(state)).toBeNull();
    expect(selectors.selectLoadingBilling(state)).toBe(false);
    expect(selectors.selectSuperadminAudit(state)).toBeNull();
    expect(selectors.selectLoadingAudit(state)).toBe(false);
    expect(selectors.selectAuditFilters(state)).toEqual({
      action: '',
      actorUserId: '',
      from: '',
      to: '',
    });
    expect(selectors.selectSuperadminSystem(state)).toBeNull();
    expect(selectors.selectLoadingSystem(state)).toBe(false);
    expect(selectors.selectSuperadminInvitations(state)).toBeNull();
    expect(selectors.selectLoadingInvitations(state)).toBe(false);
    expect(selectors.selectActionPending(state)).toBe(false);
    expect(selectors.selectSuperadminError(state)).toBe('');
    expect(selectors.selectSuperadminMessage(state)).toBe('');
  });
});
