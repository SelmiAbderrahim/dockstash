import { createSlice } from '@reduxjs/toolkit';
import { deleteAgent, fetchFleet, registerAgent, rotateAgentKey } from './thunks';
import type { FleetEntry, FleetLockedReason } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface FleetState {
  items: FleetEntry[];
  status: LoadState;
  error: string | null;
  lockedReason: FleetLockedReason | null;
  registerStatus: LoadState;
  registerError: string | null;
  rotateStatus: LoadState;
  rotateError: string | null;
  deleteStatus: LoadState;
  deleteError: string | null;
}

const initialState: FleetState = {
  items: [],
  status: 'idle',
  error: null,
  lockedReason: null,
  registerStatus: 'idle',
  registerError: null,
  rotateStatus: 'idle',
  rotateError: null,
  deleteStatus: 'idle',
  deleteError: null,
};

const slice = createSlice({
  name: 'fleet',
  initialState,
  reducers: {
    resetRegisterState(state) {
      state.registerStatus = 'idle';
      state.registerError = null;
    },
    resetRotateState(state) {
      state.rotateStatus = 'idle';
      state.rotateError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFleet.pending, (state, action) => {
        // Silent background polls keep the current data + status so the table
        // never flashes skeletons on the 30s refresh.
        const silent = action.meta?.arg?.silent === true;
        if (silent && state.status === 'succeeded') return;
        state.status = 'loading';
        state.error = null;
        state.lockedReason = null;
      })
      .addCase(fetchFleet.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchFleet.rejected, (state, action) => {
        // Keep last-good data on a silent failure — the next tick retries.
        if (action.meta?.arg?.silent === true && state.status === 'succeeded') return;
        state.status = 'failed';
        state.error = action.payload?.message ?? 'Could not load the fleet.';
        state.lockedReason = action.payload?.lockedReason ?? null;
      })
      .addCase(registerAgent.pending, (state) => {
        state.registerStatus = 'loading';
        state.registerError = null;
      })
      .addCase(registerAgent.fulfilled, (state) => {
        state.registerStatus = 'succeeded';
      })
      .addCase(registerAgent.rejected, (state, action) => {
        state.registerStatus = 'failed';
        state.registerError = action.payload?.message ?? 'Could not register the agent.';
      })
      .addCase(rotateAgentKey.pending, (state) => {
        state.rotateStatus = 'loading';
        state.rotateError = null;
      })
      .addCase(rotateAgentKey.fulfilled, (state) => {
        state.rotateStatus = 'succeeded';
      })
      .addCase(rotateAgentKey.rejected, (state, action) => {
        state.rotateStatus = 'failed';
        state.rotateError = action.payload?.message ?? 'Could not rotate the agent key.';
      })
      .addCase(deleteAgent.pending, (state) => {
        state.deleteStatus = 'loading';
        state.deleteError = null;
      })
      .addCase(deleteAgent.fulfilled, (state, action) => {
        state.deleteStatus = 'succeeded';
        // Optimistic removal; the silent refetch reconciles totals.
        state.items = state.items.filter((entry) => entry.id !== action.payload);
      })
      .addCase(deleteAgent.rejected, (state, action) => {
        state.deleteStatus = 'failed';
        state.deleteError = action.payload?.message ?? 'Could not remove the agent.';
      });
  },
});

export const { resetRegisterState, resetRotateState } = slice.actions;
export const fleetReducer = slice.reducer;
