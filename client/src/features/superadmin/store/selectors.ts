import type { RootState } from '@app/store';
import type {
  AuditFilters,
  SuperadminAuditPage,
  SuperadminBillingPage,
  SuperadminStats,
  SuperadminSystem,
  SuperadminUsersPage,
} from '../types';

export const selectSuperadminStats = (state: RootState): SuperadminStats | null =>
  state.superadmin.stats;
export const selectLoadingStats = (state: RootState): boolean => state.superadmin.loadingStats;
export const selectSuperadminUsers = (state: RootState): SuperadminUsersPage | null =>
  state.superadmin.users;
export const selectLoadingUsers = (state: RootState): boolean => state.superadmin.loadingUsers;
export const selectUsersSearch = (state: RootState): string => state.superadmin.usersSearch;
export const selectSuperadminBilling = (state: RootState): SuperadminBillingPage | null =>
  state.superadmin.billing;
export const selectLoadingBilling = (state: RootState): boolean => state.superadmin.loadingBilling;
export const selectSuperadminAudit = (state: RootState): SuperadminAuditPage | null =>
  state.superadmin.audit;
export const selectLoadingAudit = (state: RootState): boolean => state.superadmin.loadingAudit;
export const selectAuditFilters = (state: RootState): AuditFilters =>
  state.superadmin.auditFilters;
export const selectSuperadminSystem = (state: RootState): SuperadminSystem | null =>
  state.superadmin.system;
export const selectLoadingSystem = (state: RootState): boolean => state.superadmin.loadingSystem;
export const selectActionPending = (state: RootState): boolean => state.superadmin.actionPending;
export const selectSuperadminError = (state: RootState): string => state.superadmin.error;
export const selectSuperadminMessage = (state: RootState): string => state.superadmin.message;
