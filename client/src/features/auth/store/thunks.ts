import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { loadCookie, removeCookie, saveCookie } from '@shared/utils/cookies';
import {
  forgotPasswordRequest,
  loginRequest,
  registerRequest,
  resendVerificationRequest,
  resetPasswordRequest,
  verifyEmailRequest,
} from '../api';
import type { AuthUser, LoginRequest, RegisterRequest } from '../types';

export const loginUser = createAsyncThunk<boolean, LoginRequest, { rejectValue: string }>(
  'auth/login',
  async (body, { rejectWithValue }) => {
    try {
      const data = await loginRequest(body);
      saveCookie('token', data.token, { path: '/' });
      saveCookie('user', data.user, { path: '/' });
      return data.user.emailVerified ?? false;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Login failed.'));
    }
  },
);

export const registerUser = createAsyncThunk<
  { email: string; emailVerified: boolean },
  RegisterRequest,
  { rejectValue: string }
>('auth/register', async (body, { rejectWithValue }) => {
  try {
    const data = await registerRequest(body);
    saveCookie('token', data.token, { path: '/' });
    saveCookie('user', data.user, { path: '/' });
    return { email: data.user.email, emailVerified: data.user.emailVerified ?? false };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Registration failed.'));
  }
});

export const verifyEmail = createAsyncThunk<string, string, { rejectValue: string }>(
  'auth/verifyEmail',
  async (token, { rejectWithValue }) => {
    try {
      const data = await verifyEmailRequest(token);
      // Reflect the confirmed state into the stored user so guards stop
      // redirecting after a refresh.
      const user = loadCookie<AuthUser>('user');
      if (user) saveCookie('user', { ...user, emailVerified: true }, { path: '/' });
      return data.message;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Verification failed.'));
    }
  },
);

export const resendVerification = createAsyncThunk<string, string, { rejectValue: string }>(
  'auth/resendVerification',
  async (email, { rejectWithValue }) => {
    try {
      const data = await resendVerificationRequest(email);
      return data.message;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not resend verification email.'));
    }
  },
);

export const logoutUser = createAsyncThunk<string, string | undefined>(
  'auth/logout',
  async (message) => {
    removeCookie('token', { path: '/' });
    removeCookie('user', { path: '/' });
    return message ?? '';
  },
);

export const requestPasswordReset = createAsyncThunk<
  string,
  { email: string },
  { rejectValue: string }
>('auth/forgotPassword', async ({ email }, { rejectWithValue }) => {
  try {
    const data = await forgotPasswordRequest(email);
    return data.message;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not request password reset.'));
  }
});

export const performPasswordReset = createAsyncThunk<
  string,
  { token: string; password: string },
  { rejectValue: string }
>('auth/resetPassword', async ({ token, password }, { rejectWithValue }) => {
  try {
    const data = await resetPasswordRequest(token, password);
    return data.message;
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Could not reset password.'));
  }
});
