import { describe, expect, it } from 'vitest';
import {
  clearSuperadminMessages,
  setAuditFilters,
  setUsersSearch,
  superadminReducer,
} from './slice';
import {
  changeUserRole,
  createSuperadminInvitation,
  fetchSuperadminAudit,
  fetchSuperadminBilling,
  fetchSuperadminInvitations,
  fetchSuperadminStats,
  fetchSuperadminSystem,
  fetchSuperadminUsers,
  forceVerifyUser,
  revokeSuperadminInvitation,
  scheduleUserDeletion,
  setLegalHold,
} from './thunks';
import type { SuperadminInvitation, SuperadminUser } from '../types';

const init = () => superadminReducer(undefined, { type: 'unknown' });

const user = (over: Partial<SuperadminUser> = {}): SuperadminUser => ({
  id: 'u1',
  email: 'a@b.co',
  firstName: 'A',
  lastName: 'B',
  role: 'Member',
  emailVerified: false,
  legalHold: false,
  deletionScheduledAt: null,
  language: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  ...over,
});

describe('superadmin slice', () => {
  it('has sensible initial state', () => {
    const state = init();
    expect(state.stats).toBeNull();
    expect(state.usersSearch).toBe('');
    expect(state.auditFilters).toEqual({ action: '', actorUserId: '', from: '', to: '' });
  });

  it('plain reducers update their fields', () => {
    expect(
      superadminReducer(init(), setUsersSearch('nadia')).usersSearch,
    ).toBe('nadia');
    const filters = { action: 'x', actorUserId: 'y', from: 'f', to: 't' };
    expect(superadminReducer(init(), setAuditFilters(filters)).auditFilters).toEqual(filters);
    const dirty = { ...init(), error: 'e', message: 'm' };
    const cleared = superadminReducer(dirty, clearSuperadminMessages());
    expect(cleared.error).toBe('');
    expect(cleared.message).toBe('');
  });

  it.each([
    [fetchSuperadminStats, 'loadingStats', 'stats', { users: {} }, 'Could not load stats.'],
    [fetchSuperadminUsers, 'loadingUsers', 'users', { users: [] }, 'Could not load users.'],
    [fetchSuperadminBilling, 'loadingBilling', 'billing', { customers: [] }, 'Could not load billing.'],
    [fetchSuperadminAudit, 'loadingAudit', 'audit', { entries: [] }, 'Could not load the audit log.'],
    [fetchSuperadminSystem, 'loadingSystem', 'system', { health: {} }, 'Could not load system status.'],
  ] as const)(
    '%# fetch thunk toggles loading, stores data, and records errors',
    (thunk, loadingKey, dataKey, payload, fallback) => {
      const pending = superadminReducer(init(), { type: thunk.pending.type });
      expect(pending[loadingKey]).toBe(true);

      const fulfilled = superadminReducer(pending, { type: thunk.fulfilled.type, payload });
      expect(fulfilled[loadingKey]).toBe(false);
      expect(fulfilled[dataKey]).toEqual(payload);

      const withMsg = superadminReducer(init(), {
        type: thunk.rejected.type,
        payload: 'boom',
      });
      expect(withMsg.error).toBe('boom');

      const fallbackState = superadminReducer(init(), {
        type: thunk.rejected.type,
        payload: undefined,
      });
      expect(fallbackState.error).toBe(fallback);
    },
  );

  it.each([
    [changeUserRole, 'Could not change the role.'],
    [forceVerifyUser, 'Could not verify the user.'],
    [setLegalHold, 'Could not update the legal hold.'],
  ] as const)('%# mutation thunk patches the row and handles errors', (thunk, fallback) => {
    const seeded = {
      ...init(),
      users: { users: [user()], total: 1, page: 1, pages: 1 },
    };
    const pending = superadminReducer(seeded, { type: thunk.pending.type });
    expect(pending.actionPending).toBe(true);

    const updated = user({ role: 'Owner' });
    const fulfilled = superadminReducer(pending, {
      type: thunk.fulfilled.type,
      payload: { message: 'done', user: updated },
    });
    expect(fulfilled.actionPending).toBe(false);
    expect(fulfilled.message).toBe('done');
    expect(fulfilled.users?.users[0]?.role).toBe('Owner');

    // Unknown row id is a no-op on the list.
    const foreign = superadminReducer(seeded, {
      type: thunk.fulfilled.type,
      payload: { message: 'done', user: user({ id: 'other' }) },
    });
    expect(foreign.users?.users[0]?.id).toBe('u1');

    expect(
      superadminReducer(init(), { type: thunk.rejected.type, payload: undefined }).error,
    ).toBe(fallback);
  });

  it('mutation fulfilled is a no-op on the list when no users are loaded', () => {
    const state = superadminReducer(init(), {
      type: changeUserRole.fulfilled.type,
      payload: { message: 'done', user: user() },
    });
    expect(state.users).toBeNull();
    expect(state.message).toBe('done');
  });

  it('scheduleUserDeletion marks the row and handles errors', () => {
    const seeded = {
      ...init(),
      users: { users: [user()], total: 1, page: 1, pages: 1 },
    };
    const fulfilled = superadminReducer(seeded, {
      type: scheduleUserDeletion.fulfilled.type,
      payload: {
        userId: 'u1',
        message: 'scheduled',
        scheduledAt: 's',
        purgeAt: '2026-09-01T00:00:00.000Z',
        warningEmailQueued: false,
      },
    });
    expect(fulfilled.users?.users[0]?.deletionScheduledAt).toBe('2026-09-01T00:00:00.000Z');
    expect(fulfilled.message).toBe('scheduled');

    // No users loaded → still records the message, no crash.
    const noUsers = superadminReducer(init(), {
      type: scheduleUserDeletion.fulfilled.type,
      payload: {
        userId: 'u1',
        message: 'scheduled',
        scheduledAt: 's',
        purgeAt: 'p',
        warningEmailQueued: false,
      },
    });
    expect(noUsers.message).toBe('scheduled');

    // Unknown row id → no crash, no row change.
    const foreign = superadminReducer(seeded, {
      type: scheduleUserDeletion.fulfilled.type,
      payload: {
        userId: 'nope',
        message: 'scheduled',
        scheduledAt: 's',
        purgeAt: 'p',
        warningEmailQueued: false,
      },
    });
    expect(foreign.users?.users[0]?.deletionScheduledAt).toBeNull();

    expect(
      superadminReducer(init(), {
        type: scheduleUserDeletion.rejected.type,
        payload: undefined,
      }).error,
    ).toBe('Could not schedule the deletion.');
    expect(
      superadminReducer(init(), { type: scheduleUserDeletion.pending.type }).actionPending,
    ).toBe(true);
  });

  it('invitation fetch: pending / fulfilled / rejected', () => {
    expect(
      superadminReducer(
        { ...init(), error: 'x' },
        { type: fetchSuperadminInvitations.pending.type },
      ),
    ).toMatchObject({ loadingInvitations: true, error: '' });

    const page = { invitations: [], total: 0, page: 1, pages: 0 };
    expect(
      superadminReducer(init(), {
        type: fetchSuperadminInvitations.fulfilled.type,
        payload: page,
      }),
    ).toMatchObject({ loadingInvitations: false, invitations: page });

    expect(
      superadminReducer(init(), {
        type: fetchSuperadminInvitations.rejected.type,
        payload: undefined,
      }).error,
    ).toBe('Could not load invitations.');
  });

  it('invitation create: pending / fulfilled / rejected', () => {
    expect(
      superadminReducer(init(), { type: createSuperadminInvitation.pending.type }).actionPending,
    ).toBe(true);
    expect(
      superadminReducer(init(), {
        type: createSuperadminInvitation.fulfilled.type,
        payload: { message: 'created' },
      }),
    ).toMatchObject({ actionPending: false, message: 'created' });
    expect(
      superadminReducer(init(), {
        type: createSuperadminInvitation.rejected.type,
        payload: undefined,
      }).error,
    ).toBe('Could not create the invitation.');
  });

  it('invitation revoke patches the matching row only', () => {
    const row = (over: Partial<SuperadminInvitation> = {}): SuperadminInvitation => ({
      id: 'i1',
      token: 't1',
      plan: 'pro',
      grantDuration: 'one_month',
      label: '',
      expiresAt: '2030-01-01T00:00:00.000Z',
      claimedAt: null,
      claimedByEmail: null,
      createdAt: '2025-01-01T00:00:00.000Z',
      status: 'pending',
      ...over,
    });
    const seeded = {
      ...init(),
      invitations: { invitations: [row()], total: 1, page: 1, pages: 1 },
    };

    expect(
      superadminReducer(seeded, { type: revokeSuperadminInvitation.pending.type }).actionPending,
    ).toBe(true);

    const patched = superadminReducer(seeded, {
      type: revokeSuperadminInvitation.fulfilled.type,
      payload: { message: 'revoked', invitation: row({ status: 'revoked' }) },
    });
    expect(patched.invitations?.invitations[0]?.status).toBe('revoked');
    expect(patched.message).toBe('revoked');

    // Unknown id → list untouched; null list → no throw.
    const foreign = superadminReducer(seeded, {
      type: revokeSuperadminInvitation.fulfilled.type,
      payload: { message: 'x', invitation: row({ id: 'other', status: 'revoked' }) },
    });
    expect(foreign.invitations?.invitations[0]?.status).toBe('pending');
    expect(
      superadminReducer(init(), {
        type: revokeSuperadminInvitation.fulfilled.type,
        payload: { message: 'x', invitation: row() },
      }).invitations,
    ).toBeNull();

    expect(
      superadminReducer(init(), {
        type: revokeSuperadminInvitation.rejected.type,
        payload: undefined,
      }).error,
    ).toBe('Could not revoke the invitation.');
  });
});
