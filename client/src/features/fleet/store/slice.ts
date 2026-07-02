import { createSlice } from '@reduxjs/toolkit';
import { fetchFleet, registerAgent } from './thunks';
import type { FleetEntry, FleetLockedReason } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface FleetState {
  items: FleetEntry[];
  status: LoadState;
  error: string | null;
  lockedReason: FleetLockedReason | null;
  registerStatus: LoadState;
  registerError: string | null;
}

const initialState: FleetState = {
  items: [],
  status: 'idle',
  error: null,
  lockedReason: null,
  registerStatus: 'idle',
  registerError: null,
};

const slice = createSlice({
  name: 'fleet',
  initialState,
  reducers: {
    resetRegisterState(state) {
      state.registerStatus = 'idle';
      state.registerError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFleet.pending, (state) => {
        state.status = 'loading';
        state.error = null;
        state.lockedReason = null;
      })
      .addCase(fetchFleet.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchFleet.rejected, (state, action) => {
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
      });
  },
});

export const { resetRegisterState } = slice.actions;
export const fleetReducer = slice.reducer;
