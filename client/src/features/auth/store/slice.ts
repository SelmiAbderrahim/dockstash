import { createSlice } from '@reduxjs/toolkit';
import { loadCookie } from '@shared/utils/cookies';
import type { AuthState } from '../types';
import {
  fetchProtected,
  loginUser,
  logoutUser,
  performPasswordReset,
  registerUser,
  requestPasswordReset,
} from './thunks';

const initialState: AuthState = {
  authenticated: loadCookie<string>('token') !== null,
  error: '',
  message: '',
  content: '',
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError(state) {
      state.error = '';
    },
    clearMessage(state) {
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.fulfilled, (state) => {
        state.authenticated = true;
        state.error = '';
        state.message = '';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.authenticated = false;
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.authenticated = true;
        state.error = '';
        state.message = '';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.error = action.payload ?? 'Registration failed.';
      })
      .addCase(logoutUser.fulfilled, (state, action) => {
        state.authenticated = false;
        state.error = action.payload;
        state.message = '';
        state.content = '';
      })
      .addCase(requestPasswordReset.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(requestPasswordReset.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not request password reset.';
      })
      .addCase(performPasswordReset.fulfilled, (state, action) => {
        state.message = action.payload;
      })
      .addCase(performPasswordReset.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not reset password.';
      })
      .addCase(fetchProtected.fulfilled, (state, action) => {
        state.content = action.payload;
      })
      .addCase(fetchProtected.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not fetch protected content.';
      });
  },
});

export const { clearError, clearMessage } = authSlice.actions;
export const authReducer = authSlice.reducer;
