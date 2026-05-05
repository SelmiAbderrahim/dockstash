import { createSlice } from '@reduxjs/toolkit';
import type { DashboardState } from '../types';
import { fetchUser } from './thunks';

const initialState: DashboardState = {
  profile: {},
  error: '',
};

const dashboardSlice = createSlice({
  name: 'dashboard',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.profile = action.payload;
        state.error = '';
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not load user.';
      });
  },
});

export const dashboardReducer = dashboardSlice.reducer;
