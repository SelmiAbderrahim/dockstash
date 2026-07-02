import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import {
  changeUserRoleRequest,
  fetchAuditRequest,
  fetchBillingRequest,
  fetchStatsRequest,
  fetchSystemRequest,
  fetchUsersRequest,
  forceVerifyUserRequest,
  scheduleDeletionRequest,
  setLegalHoldRequest,
} from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.mockResolvedValue({} as never);
});

describe('superadmin api wrappers', () => {
  it('fetchStatsRequest gets stats with auth', async () => {
    await fetchStatsRequest();
    expect(apiClient).toHaveBeenCalledWith('/superadmin/stats', { auth: true });
  });

  it('fetchUsersRequest omits an empty search', async () => {
    await fetchUsersRequest({ page: 2 });
    expect(apiClient).toHaveBeenCalledWith('/superadmin/users?page=2', { auth: true });
  });

  it('fetchUsersRequest includes a non-empty search', async () => {
    await fetchUsersRequest({ page: 1, search: 'nadia' });
    expect(apiClient).toHaveBeenCalledWith('/superadmin/users?page=1&search=nadia', {
      auth: true,
    });
  });

  it('changeUserRoleRequest patches the role', async () => {
    await changeUserRoleRequest('u1', 'Owner');
    expect(apiClient).toHaveBeenCalledWith('/superadmin/users/u1/role', {
      method: 'PATCH',
      body: { role: 'Owner' },
      auth: true,
    });
  });

  it('forceVerifyUserRequest posts to the verify path', async () => {
    await forceVerifyUserRequest('u1');
    expect(apiClient).toHaveBeenCalledWith('/superadmin/users/u1/verify', {
      method: 'POST',
      body: {},
      auth: true,
    });
  });

  it('setLegalHoldRequest patches the legal hold', async () => {
    await setLegalHoldRequest('u1', true);
    expect(apiClient).toHaveBeenCalledWith('/superadmin/users/u1/legal-hold', {
      method: 'PATCH',
      body: { legalHold: true },
      auth: true,
    });
  });

  it('scheduleDeletionRequest deletes the user', async () => {
    await scheduleDeletionRequest('u1');
    expect(apiClient).toHaveBeenCalledWith('/superadmin/users/u1', {
      method: 'DELETE',
      auth: true,
    });
  });

  it('fetchBillingRequest passes the page', async () => {
    await fetchBillingRequest({ page: 3 });
    expect(apiClient).toHaveBeenCalledWith('/superadmin/billing?page=3', { auth: true });
  });

  it('fetchAuditRequest builds the full query and skips empty filters', async () => {
    await fetchAuditRequest({
      page: 1,
      filters: { action: 'backup.run', actorUserId: 'a1', from: '2026-01-01', to: '2026-02-01' },
    });
    expect(apiClient).toHaveBeenCalledWith(
      '/superadmin/audit?page=1&action=backup.run&actorUserId=a1&from=2026-01-01&to=2026-02-01',
      { auth: true },
    );
  });

  it('fetchAuditRequest omits all empty filters', async () => {
    await fetchAuditRequest({
      page: 1,
      filters: { action: '', actorUserId: '', from: '', to: '' },
    });
    expect(apiClient).toHaveBeenCalledWith('/superadmin/audit?page=1', { auth: true });
  });

  it('fetchSystemRequest gets the system summary', async () => {
    await fetchSystemRequest();
    expect(apiClient).toHaveBeenCalledWith('/superadmin/system', { auth: true });
  });
});
