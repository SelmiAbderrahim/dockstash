import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AuditFilters, SuperadminState, SuperadminUser } from '../types';
import {
  changeUserRole,
  fetchSuperadminAudit,
  fetchSuperadminBilling,
  fetchSuperadminStats,
  fetchSuperadminSystem,
  fetchSuperadminUsers,
  forceVerifyUser,
  scheduleUserDeletion,
  setLegalHold,
} from './thunks';

export const EMPTY_AUDIT_FILTERS: AuditFilters = {
  action: '',
  actorUserId: '',
  from: '',
  to: '',
};

const initialState: SuperadminState = {
  stats: null,
  loadingStats: false,
  users: null,
  loadingUsers: false,
  usersSearch: '',
  billing: null,
  loadingBilling: false,
  audit: null,
  loadingAudit: false,
  auditFilters: EMPTY_AUDIT_FILTERS,
  system: null,
  loadingSystem: false,
  actionPending: false,
  error: '',
  message: '',
};

function patchUserRow(state: SuperadminState, user: SuperadminUser): void {
  if (!state.users) return;
  const index = state.users.users.findIndex((row) => row.id === user.id);
  if (index !== -1) {
    state.users.users[index] = user;
  }
}

const superadminSlice = createSlice({
  name: 'superadmin',
  initialState,
  reducers: {
    clearSuperadminMessages(state) {
      state.error = '';
      state.message = '';
    },
    setUsersSearch(state, action: PayloadAction<string>) {
      state.usersSearch = action.payload;
    },
    setAuditFilters(state, action: PayloadAction<AuditFilters>) {
      state.auditFilters = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSuperadminStats.pending, (state) => {
        state.loadingStats = true;
        state.error = '';
      })
      .addCase(fetchSuperadminStats.fulfilled, (state, action) => {
        state.loadingStats = false;
        state.stats = action.payload;
      })
      .addCase(fetchSuperadminStats.rejected, (state, action) => {
        state.loadingStats = false;
        state.error = action.payload ?? 'Could not load stats.';
      })
      .addCase(fetchSuperadminUsers.pending, (state) => {
        state.loadingUsers = true;
        state.error = '';
      })
      .addCase(fetchSuperadminUsers.fulfilled, (state, action) => {
        state.loadingUsers = false;
        state.users = action.payload;
      })
      .addCase(fetchSuperadminUsers.rejected, (state, action) => {
        state.loadingUsers = false;
        state.error = action.payload ?? 'Could not load users.';
      })
      .addCase(fetchSuperadminBilling.pending, (state) => {
        state.loadingBilling = true;
        state.error = '';
      })
      .addCase(fetchSuperadminBilling.fulfilled, (state, action) => {
        state.loadingBilling = false;
        state.billing = action.payload;
      })
      .addCase(fetchSuperadminBilling.rejected, (state, action) => {
        state.loadingBilling = false;
        state.error = action.payload ?? 'Could not load billing.';
      })
      .addCase(fetchSuperadminAudit.pending, (state) => {
        state.loadingAudit = true;
        state.error = '';
      })
      .addCase(fetchSuperadminAudit.fulfilled, (state, action) => {
        state.loadingAudit = false;
        state.audit = action.payload;
      })
      .addCase(fetchSuperadminAudit.rejected, (state, action) => {
        state.loadingAudit = false;
        state.error = action.payload ?? 'Could not load the audit log.';
      })
      .addCase(fetchSuperadminSystem.pending, (state) => {
        state.loadingSystem = true;
        state.error = '';
      })
      .addCase(fetchSuperadminSystem.fulfilled, (state, action) => {
        state.loadingSystem = false;
        state.system = action.payload;
      })
      .addCase(fetchSuperadminSystem.rejected, (state, action) => {
        state.loadingSystem = false;
        state.error = action.payload ?? 'Could not load system status.';
      })
      .addCase(changeUserRole.pending, (state) => {
        state.actionPending = true;
        state.error = '';
      })
      .addCase(changeUserRole.fulfilled, (state, action) => {
        state.actionPending = false;
        state.message = action.payload.message;
        patchUserRow(state, action.payload.user);
      })
      .addCase(changeUserRole.rejected, (state, action) => {
        state.actionPending = false;
        state.error = action.payload ?? 'Could not change the role.';
      })
      .addCase(forceVerifyUser.pending, (state) => {
        state.actionPending = true;
        state.error = '';
      })
      .addCase(forceVerifyUser.fulfilled, (state, action) => {
        state.actionPending = false;
        state.message = action.payload.message;
        patchUserRow(state, action.payload.user);
      })
      .addCase(forceVerifyUser.rejected, (state, action) => {
        state.actionPending = false;
        state.error = action.payload ?? 'Could not verify the user.';
      })
      .addCase(setLegalHold.pending, (state) => {
        state.actionPending = true;
        state.error = '';
      })
      .addCase(setLegalHold.fulfilled, (state, action) => {
        state.actionPending = false;
        state.message = action.payload.message;
        patchUserRow(state, action.payload.user);
      })
      .addCase(setLegalHold.rejected, (state, action) => {
        state.actionPending = false;
        state.error = action.payload ?? 'Could not update the legal hold.';
      })
      .addCase(scheduleUserDeletion.pending, (state) => {
        state.actionPending = true;
        state.error = '';
      })
      .addCase(scheduleUserDeletion.fulfilled, (state, action) => {
        state.actionPending = false;
        state.message = action.payload.message;
        if (state.users) {
          const row = state.users.users.find((user) => user.id === action.payload.userId);
          if (row) row.deletionScheduledAt = action.payload.purgeAt;
        }
      })
      .addCase(scheduleUserDeletion.rejected, (state, action) => {
        state.actionPending = false;
        state.error = action.payload ?? 'Could not schedule the deletion.';
      });
  },
});

export const { clearSuperadminMessages, setUsersSearch, setAuditFilters } =
  superadminSlice.actions;
export const superadminReducer = superadminSlice.reducer;
