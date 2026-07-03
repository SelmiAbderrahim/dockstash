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
  verifyLoginOtpRequest,
} from '../api';
import type { AuthUser, LoginRequest, OtpVerifyRequest, RegisterRequest } from '../types';

/**
 * Cookie attributes for the auth token/user cookies. `sameSite: 'strict'`
 * shrinks the cross-site attack surface, and `secure` is set whenever the page
 * is served over HTTPS so the bearer token never rides a plaintext request
 * (it is left off under http:// so local dev keeps working). Computed at call
 * time so this is SSR-safe (no `location` access at module load).
 */
function authCookieOptions(): { path: string; sameSite: 'strict'; secure?: boolean } {
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:';
  return secure
    ? { path: '/', sameSite: 'strict', secure: true }
    : { path: '/', sameSite: 'strict' };
}

export type LoginResult =
  | { otpRequired: true; challengeId: string }
  | { otpRequired: false; emailVerified: boolean; role: string };

export const loginUser = createAsyncThunk<LoginResult, LoginRequest, { rejectValue: string }>(
  'auth/login',
  async (body, { rejectWithValue }) => {
    try {
      const data = await loginRequest(body);
      if ('otpRequired' in data) {
        // No cookies yet — the session starts only after the OTP verifies.
        return { otpRequired: true, challengeId: data.challengeId };
      }
      saveCookie('token', data.token, authCookieOptions());
      saveCookie('user', data.user, authCookieOptions());
      return {
        otpRequired: false,
        emailVerified: data.user.emailVerified ?? false,
        role: data.user.role ?? '',
      };
    } catch (err) {
      return rejectWithValue(messageFromError(err, 'Login failed.'));
    }
  },
);

export const verifyLoginOtp = createAsyncThunk<
  { emailVerified: boolean; role: string },
  OtpVerifyRequest,
  { rejectValue: string }
>('auth/verifyLoginOtp', async (body, { rejectWithValue }) => {
  try {
    const data = await verifyLoginOtpRequest(body);
    saveCookie('token', data.token, authCookieOptions());
    saveCookie('user', data.user, authCookieOptions());
    return {
      emailVerified: data.user.emailVerified ?? false,
      role: data.user.role ?? '',
    };
  } catch (err) {
    return rejectWithValue(messageFromError(err, 'Verification failed.'));
  }
});

export const registerUser = createAsyncThunk<
  { email: string; emailVerified: boolean; role: string },
  RegisterRequest,
  { rejectValue: string }
>('auth/register', async (body, { rejectWithValue }) => {
  try {
    const data = await registerRequest(body);
    saveCookie('token', data.token, authCookieOptions());
    saveCookie('user', data.user, authCookieOptions());
    return {
      email: data.user.email,
      emailVerified: data.user.emailVerified ?? false,
      role: data.user.role ?? '',
    };
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
      if (user) saveCookie('user', { ...user, emailVerified: true }, authCookieOptions());
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
