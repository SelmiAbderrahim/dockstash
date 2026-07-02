import { createSlice } from '@reduxjs/toolkit';
import { fetchUser, saveProfile } from './thunks';
import type { UserProfile } from '../types';

export type LoadState = 'idle' | 'loading' | 'succeeded' | 'failed';

export interface ProfileState {
  profile: UserProfile;
  status: LoadState;
  saveStatus: LoadState;
  error: string | null;
}

const initialState: ProfileState = {
  profile: {},
  status: 'idle',
  saveStatus: 'idle',
  error: null,
};

const slice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    resetSaveStatus(state) {
      state.saveStatus = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchUser.fulfilled, (state, action) => {
        state.status = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(fetchUser.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload ?? 'Could not load profile.';
      })
      .addCase(saveProfile.pending, (state) => {
        state.saveStatus = 'loading';
      })
      .addCase(saveProfile.fulfilled, (state, action) => {
        state.saveStatus = 'succeeded';
        state.profile = action.payload;
      })
      .addCase(saveProfile.rejected, (state, action) => {
        state.saveStatus = 'failed';
        state.error = action.payload ?? 'Could not save profile.';
      });
  },
});

export const { resetSaveStatus } = slice.actions;
export const profileReducer = slice.reducer;
