import { apiClient } from '@shared/api/client';
import type {
  AuditFilters,
  CreateInvitationInput,
  DeletionResponse,
  InvitationMutationResponse,
  MutationResponse,
  SuperadminAuditPage,
  SuperadminBillingPage,
  SuperadminInvitationsPage,
  SuperadminStats,
  SuperadminSystem,
  SuperadminUsersPage,
} from './types';

// Every caller passes at least `page`, so the query string is never empty.
const withQuery = (path: string, params: Record<string, string>): string =>
  `${path}?${new URLSearchParams(params).toString()}`;

export const fetchStatsRequest = (): Promise<SuperadminStats> =>
  apiClient<SuperadminStats>('/superadmin/stats', { auth: true });

export const fetchUsersRequest = (input: {
  page: number;
  search?: string;
}): Promise<SuperadminUsersPage> => {
  const params: Record<string, string> = { page: String(input.page) };
  if (input.search) params.search = input.search;
  return apiClient<SuperadminUsersPage>(withQuery('/superadmin/users', params), { auth: true });
};

export const changeUserRoleRequest = (userId: string, role: string): Promise<MutationResponse> =>
  apiClient<MutationResponse>(`/superadmin/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
    auth: true,
  });

export const forceVerifyUserRequest = (userId: string): Promise<MutationResponse> =>
  apiClient<MutationResponse>(`/superadmin/users/${userId}/verify`, {
    method: 'POST',
    body: {},
    auth: true,
  });

export const setLegalHoldRequest = (
  userId: string,
  legalHold: boolean,
): Promise<MutationResponse> =>
  apiClient<MutationResponse>(`/superadmin/users/${userId}/legal-hold`, {
    method: 'PATCH',
    body: { legalHold },
    auth: true,
  });

export const scheduleDeletionRequest = (userId: string): Promise<DeletionResponse> =>
  apiClient<DeletionResponse>(`/superadmin/users/${userId}`, { method: 'DELETE', auth: true });

export const fetchBillingRequest = (input: { page: number }): Promise<SuperadminBillingPage> =>
  apiClient<SuperadminBillingPage>(
    withQuery('/superadmin/billing', { page: String(input.page) }),
    { auth: true },
  );

export const fetchAuditRequest = (input: {
  page: number;
  filters: AuditFilters;
}): Promise<SuperadminAuditPage> => {
  const params: Record<string, string> = { page: String(input.page) };
  if (input.filters.action) params.action = input.filters.action;
  if (input.filters.actorUserId) params.actorUserId = input.filters.actorUserId;
  if (input.filters.from) params.from = input.filters.from;
  if (input.filters.to) params.to = input.filters.to;
  return apiClient<SuperadminAuditPage>(withQuery('/superadmin/audit', params), { auth: true });
};

export const fetchSystemRequest = (): Promise<SuperadminSystem> =>
  apiClient<SuperadminSystem>('/superadmin/system', { auth: true });

export const fetchInvitationsRequest = (input: {
  page: number;
}): Promise<SuperadminInvitationsPage> =>
  apiClient<SuperadminInvitationsPage>(
    withQuery('/superadmin/invitations', { page: String(input.page) }),
    { auth: true },
  );

export const createInvitationRequest = (
  input: CreateInvitationInput,
): Promise<InvitationMutationResponse> =>
  apiClient<InvitationMutationResponse>('/superadmin/invitations', {
    method: 'POST',
    body: input,
    auth: true,
  });

export const revokeInvitationRequest = (id: string): Promise<InvitationMutationResponse> =>
  apiClient<InvitationMutationResponse>(`/superadmin/invitations/${id}/revoke`, {
    method: 'PATCH',
    body: {},
    auth: true,
  });
