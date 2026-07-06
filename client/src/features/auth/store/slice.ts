import { createSlice } from '@reduxjs/toolkit';
import { loadCookie } from '@shared/utils/cookies';
import type { AuthState, AuthUser } from '../types';
import {
  completeOAuthLogin,
  fetchOAuthProviders,
  loginUser,
  logoutUser,
  performPasswordReset,
  registerUser,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
  verifyLoginOtp,
} from './thunks';

const initialState: AuthState = {
  authenticated: loadCookie<string>('token') !== null,
  emailVerified: loadCookie<AuthUser>('user')?.emailVerified ?? false,
  role: loadCookie<AuthUser>('user')?.role ?? '',
  otpChallengeId: '',
  pendingVerificationEmail: '',
  error: '',
  message: '',
  providers: { google: false, github: false },
  providersLoaded: false,
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
    cancelOtp(state) {
      state.otpChallengeId = '';
      state.error = '';
    },
    /** OAuth callback for a superadmin: adopt the emailed-OTP challenge and
     * let the Login page's existing OTP form take over. */
    beginOtpChallenge(state, action: { payload: string }) {
      state.otpChallengeId = action.payload;
      state.error = '';
      state.message = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginUser.fulfilled, (state, action) => {
        if (action.payload.otpRequired) {
          // Password accepted, session pending the emailed code.
          state.otpChallengeId = action.payload.challengeId;
          state.error = '';
          state.message = '';
          return;
        }
        state.authenticated = true;
        state.emailVerified = action.payload.emailVerified;
        state.role = action.payload.role;
        state.otpChallengeId = '';
        state.error = '';
        state.message = '';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.authenticated = false;
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(verifyLoginOtp.fulfilled, (state, action) => {
        state.authenticated = true;
        state.emailVerified = action.payload.emailVerified;
        state.role = action.payload.role;
        state.otpChallengeId = '';
        state.error = '';
        state.message = '';
      })
      .addCase(verifyLoginOtp.rejected, (state, action) => {
        // Keep the challenge so the user can retry the code.
        state.error = action.payload ?? 'Verification failed.';
      })
      .addCase(completeOAuthLogin.fulfilled, (state, action) => {
        state.authenticated = true;
        state.emailVerified = action.payload.emailVerified;
        state.role = action.payload.role;
        state.otpChallengeId = '';
        state.error = '';
        state.message = '';
      })
      .addCase(completeOAuthLogin.rejected, (state, action) => {
        state.authenticated = false;
        state.error = action.payload ?? 'Login failed.';
      })
      .addCase(fetchOAuthProviders.fulfilled, (state, action) => {
        state.providers = action.payload;
        state.providersLoaded = true;
      })
      .addCase(registerUser.fulfilled, (state, action) => {
        state.authenticated = true;
        state.emailVerified = action.payload.emailVerified;
        state.role = action.payload.role;
        state.pendingVerificationEmail = action.payload.email;
        state.error = '';
        state.message = '';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.error = action.payload ?? 'Registration failed.';
      })
      .addCase(logoutUser.fulfilled, (state, action) => {
        state.authenticated = false;
        state.emailVerified = false;
        state.role = '';
        state.otpChallengeId = '';
        state.pendingVerificationEmail = '';
        state.error = action.payload;
        state.message = '';
      })
      .addCase(verifyEmail.fulfilled, (state, action) => {
        state.emailVerified = true;
        state.message = action.payload;
        state.error = '';
      })
      .addCase(verifyEmail.rejected, (state, action) => {
        state.error = action.payload ?? 'Verification failed.';
      })
      .addCase(resendVerification.fulfilled, (state, action) => {
        state.message = action.payload;
        state.error = '';
      })
      .addCase(resendVerification.rejected, (state, action) => {
        state.error = action.payload ?? 'Could not resend verification email.';
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
      });
  },
});

export const { clearError, clearMessage, cancelOtp, beginOtpChallenge } = authSlice.actions;
export const authReducer = authSlice.reducer;
