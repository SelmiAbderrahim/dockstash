import { createAsyncThunk } from '@reduxjs/toolkit';
import { messageFromError } from '@shared/utils/errors';
import { removeCookie, saveCookie } from '@shared/utils/cookies';
import {
  forgotPasswordRequest,
  loginRequest,
  protectedRequest,
  registerRequest,
  resetPasswordRequest,
} from '../api';
import type { LoginRequest, RegisterRequest } from '../types';

export const loginUser = createAsyncThunk<void, LoginRequest, { rejectValue: string }>(
  'auth/login',
  async (body, { rejectWithValue }) => {
    try {
      const data = await loginRequest(body);
      saveCookie('token', data.token, { path: '/' });
      saveCookie('user', data.user, { path: '/' });
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Login failed.'));
    }
  },
);

export const registerUser = createAsyncThunk<void, RegisterRequest, { rejectValue: string }>(
  'auth/register',
  async (body, { rejectWithValue }) => {
    try {
      const data = await registerRequest(body);
      saveCookie('token', data.token, { path: '/' });
      saveCookie('user', data.user, { path: '/' });
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Registration failed.'));
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

export const fetchProtected = createAsyncThunk<string, void, { rejectValue: string }>(
  'auth/protected',
  async (_, { rejectWithValue }) => {
    try {
      const data = await protectedRequest();
      return data.content;
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Could not fetch protected content.'));
    }
  },
);
