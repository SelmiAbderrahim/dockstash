import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { superadminReducer } from './slice';
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
import * as api from '../api';

vi.mock('../api', () => ({
  fetchStatsRequest: vi.fn(),
  fetchUsersRequest: vi.fn(),
  changeUserRoleRequest: vi.fn(),
  forceVerifyUserRequest: vi.fn(),
  setLegalHoldRequest: vi.fn(),
  scheduleDeletionRequest: vi.fn(),
  fetchBillingRequest: vi.fn(),
  fetchAuditRequest: vi.fn(),
  fetchSystemRequest: vi.fn(),
  fetchInvitationsRequest: vi.fn(),
  createInvitationRequest: vi.fn(),
  revokeInvitationRequest: vi.fn(),
}));

const mocked = vi.mocked(api);
const makeStore = () => configureStore({ reducer: { superadmin: superadminReducer } });

beforeEach(() => vi.clearAllMocks());

describe('superadmin thunks', () => {
  it('fetchSuperadminStats resolves and rejects', async () => {
    mocked.fetchStatsRequest.mockResolvedValue({ users: {} } as never);
    const store = makeStore();
    const ok = await store.dispatch(fetchSuperadminStats());
    expect(fetchSuperadminStats.fulfilled.match(ok)).toBe(true);

    mocked.fetchStatsRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(fetchSuperadminStats());
    expect(fetchSuperadminStats.rejected.match(bad)).toBe(true);
    expect(typeof bad.payload).toBe('string');
  });

  it('fetchSuperadminUsers resolves and rejects', async () => {
    mocked.fetchUsersRequest.mockResolvedValue({ users: [] } as never);
    const store = makeStore();
    expect(
      fetchSuperadminUsers.fulfilled.match(await store.dispatch(fetchSuperadminUsers({ page: 1 }))),
    ).toBe(true);
    mocked.fetchUsersRequest.mockRejectedValue(new Error('x'));
    expect(
      fetchSuperadminUsers.rejected.match(await store.dispatch(fetchSuperadminUsers({ page: 1 }))),
    ).toBe(true);
  });

  it('changeUserRole resolves and rejects', async () => {
    mocked.changeUserRoleRequest.mockResolvedValue({ message: 'm', user: {} } as never);
    const store = makeStore();
    expect(
      changeUserRole.fulfilled.match(
        await store.dispatch(changeUserRole({ userId: 'u1', role: 'Owner' })),
      ),
    ).toBe(true);
    mocked.changeUserRoleRequest.mockRejectedValue(new Error('x'));
    expect(
      changeUserRole.rejected.match(
        await store.dispatch(changeUserRole({ userId: 'u1', role: 'Owner' })),
      ),
    ).toBe(true);
  });

  it('forceVerifyUser resolves and rejects', async () => {
    mocked.forceVerifyUserRequest.mockResolvedValue({ message: 'm', user: {} } as never);
    const store = makeStore();
    expect(
      forceVerifyUser.fulfilled.match(await store.dispatch(forceVerifyUser({ userId: 'u1' }))),
    ).toBe(true);
    mocked.forceVerifyUserRequest.mockRejectedValue(new Error('x'));
    expect(
      forceVerifyUser.rejected.match(await store.dispatch(forceVerifyUser({ userId: 'u1' }))),
    ).toBe(true);
  });

  it('setLegalHold resolves and rejects', async () => {
    mocked.setLegalHoldRequest.mockResolvedValue({ message: 'm', user: {} } as never);
    const store = makeStore();
    expect(
      setLegalHold.fulfilled.match(
        await store.dispatch(setLegalHold({ userId: 'u1', legalHold: true })),
      ),
    ).toBe(true);
    mocked.setLegalHoldRequest.mockRejectedValue(new Error('x'));
    expect(
      setLegalHold.rejected.match(
        await store.dispatch(setLegalHold({ userId: 'u1', legalHold: true })),
      ),
    ).toBe(true);
  });

  it('scheduleUserDeletion resolves with the userId and rejects', async () => {
    mocked.scheduleDeletionRequest.mockResolvedValue({
      message: 'm',
      scheduledAt: 's',
      purgeAt: 'p',
      warningEmailQueued: false,
    } as never);
    const store = makeStore();
    const ok = await store.dispatch(scheduleUserDeletion({ userId: 'u1' }));
    expect(scheduleUserDeletion.fulfilled.match(ok)).toBe(true);
    expect((ok.payload as { userId: string }).userId).toBe('u1');
    mocked.scheduleDeletionRequest.mockRejectedValue(new Error('x'));
    expect(
      scheduleUserDeletion.rejected.match(
        await store.dispatch(scheduleUserDeletion({ userId: 'u1' })),
      ),
    ).toBe(true);
  });

  it('fetchSuperadminBilling resolves and rejects', async () => {
    mocked.fetchBillingRequest.mockResolvedValue({ customers: [] } as never);
    const store = makeStore();
    expect(
      fetchSuperadminBilling.fulfilled.match(
        await store.dispatch(fetchSuperadminBilling({ page: 1 })),
      ),
    ).toBe(true);
    mocked.fetchBillingRequest.mockRejectedValue(new Error('x'));
    expect(
      fetchSuperadminBilling.rejected.match(
        await store.dispatch(fetchSuperadminBilling({ page: 1 })),
      ),
    ).toBe(true);
  });

  it('fetchSuperadminAudit resolves and rejects', async () => {
    mocked.fetchAuditRequest.mockResolvedValue({ entries: [] } as never);
    const store = makeStore();
    const filters = { action: '', actorUserId: '', from: '', to: '' };
    expect(
      fetchSuperadminAudit.fulfilled.match(
        await store.dispatch(fetchSuperadminAudit({ page: 1, filters })),
      ),
    ).toBe(true);
    mocked.fetchAuditRequest.mockRejectedValue(new Error('x'));
    expect(
      fetchSuperadminAudit.rejected.match(
        await store.dispatch(fetchSuperadminAudit({ page: 1, filters })),
      ),
    ).toBe(true);
  });

  it('fetchSuperadminSystem resolves and rejects', async () => {
    mocked.fetchSystemRequest.mockResolvedValue({ health: {} } as never);
    const store = makeStore();
    expect(
      fetchSuperadminSystem.fulfilled.match(await store.dispatch(fetchSuperadminSystem())),
    ).toBe(true);
    mocked.fetchSystemRequest.mockRejectedValue(new Error('x'));
    expect(
      fetchSuperadminSystem.rejected.match(await store.dispatch(fetchSuperadminSystem())),
    ).toBe(true);
  });

  it('fetchSuperadminInvitations resolves and rejects', async () => {
    mocked.fetchInvitationsRequest.mockResolvedValue({ invitations: [] } as never);
    const store = makeStore();
    expect(
      fetchSuperadminInvitations.fulfilled.match(
        await store.dispatch(fetchSuperadminInvitations({ page: 1 })),
      ),
    ).toBe(true);
    mocked.fetchInvitationsRequest.mockRejectedValue(new Error('x'));
    expect(
      fetchSuperadminInvitations.rejected.match(
        await store.dispatch(fetchSuperadminInvitations({ page: 1 })),
      ),
    ).toBe(true);
  });

  it('createSuperadminInvitation resolves and rejects', async () => {
    const input = { planSlug: 'pro', grantDuration: 'one_month', expiresInDays: 30 } as const;
    mocked.createInvitationRequest.mockResolvedValue({ message: 'ok' } as never);
    const store = makeStore();
    expect(
      createSuperadminInvitation.fulfilled.match(
        await store.dispatch(createSuperadminInvitation(input)),
      ),
    ).toBe(true);
    mocked.createInvitationRequest.mockRejectedValue(new Error('x'));
    expect(
      createSuperadminInvitation.rejected.match(
        await store.dispatch(createSuperadminInvitation(input)),
      ),
    ).toBe(true);
  });

  it('revokeSuperadminInvitation resolves and rejects', async () => {
    mocked.revokeInvitationRequest.mockResolvedValue({ message: 'ok' } as never);
    const store = makeStore();
    expect(
      revokeSuperadminInvitation.fulfilled.match(
        await store.dispatch(revokeSuperadminInvitation({ id: 'i1' })),
      ),
    ).toBe(true);
    mocked.revokeInvitationRequest.mockRejectedValue(new Error('x'));
    expect(
      revokeSuperadminInvitation.rejected.match(
        await store.dispatch(revokeSuperadminInvitation({ id: 'i1' })),
      ),
    ).toBe(true);
  });
});
