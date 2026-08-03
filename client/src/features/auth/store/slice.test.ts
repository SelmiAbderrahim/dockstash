import { describe, expect, it, vi, afterEach } from 'vitest';
import { authReducer, clearError, clearMessage } from './slice';
import {
  loginUser,
  logoutUser,
  performPasswordReset,
  registerUser,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
} from './thunks';
import type { AuthState } from '../types';

const base = (over: Partial<AuthState> = {}): AuthState => ({
  authenticated: false,
  emailVerified: false,
  role: '',
  pendingVerificationEmail: '',
  providers: { google: false, github: false },
  providersLoaded: false,
  error: '',
  message: '',
  ...over,
});

afterEach(() => {
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
});

describe('auth slice', () => {
  it('derives emailVerified from the user cookie at module load', async () => {
    vi.resetModules();
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ emailVerified: true }))}; path=/`;
    const fresh = await import('./slice');
    const state = fresh.authReducer(undefined, { type: 'unknown' });
    expect(state.emailVerified).toBe(true);
  });

  it('returns the initial state for an unknown action', () => {
    const state = authReducer(undefined, { type: 'unknown' });
    expect(state.error).toBe('');
    expect(state.message).toBe('');
    expect(state.emailVerified).toBe(false);
    expect(state.pendingVerificationEmail).toBe('');
  });

  it('clearError / clearMessage reset their fields', () => {
    expect(authReducer(base({ error: 'x' }), clearError()).error).toBe('');
    expect(authReducer(base({ message: 'x' }), clearMessage()).message).toBe('');
  });

  it('derives role from the user cookie at module load', async () => {
    vi.resetModules();
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ role: 'Admin' }))}; path=/`;
    const fresh = await import('./slice');
    const state = fresh.authReducer(undefined, { type: 'unknown' });
    expect(state.role).toBe('Admin');
  });

  it('loginUser.fulfilled authenticates and carries emailVerified + role', () => {
    const state = authReducer(base(), {
      type: loginUser.fulfilled.type,
      payload: { emailVerified: true, role: 'Member' },
    });
    expect(state.authenticated).toBe(true);
    expect(state.emailVerified).toBe(true);
    expect(state.role).toBe('Member');
  });

  it('loginUser.rejected records the error (payload and fallback)', () => {
    expect(
      authReducer(base(), { type: loginUser.rejected.type, payload: 'bad' }).error,
    ).toBe('bad');
    expect(
      authReducer(base(), { type: loginUser.rejected.type, payload: undefined }).error,
    ).toBe('Login failed.');
  });

  it('registerUser.fulfilled stores the pending email and stays unverified', () => {
    const state = authReducer(base(), {
      type: registerUser.fulfilled.type,
      payload: { email: 'a@b.co', emailVerified: false, role: 'Member' },
    });
    expect(state.authenticated).toBe(true);
    expect(state.emailVerified).toBe(false);
    expect(state.role).toBe('Member');
    expect(state.pendingVerificationEmail).toBe('a@b.co');
  });

  it('registerUser.rejected records the error (payload and fallback)', () => {
    expect(
      authReducer(base(), { type: registerUser.rejected.type, payload: 'nope' }).error,
    ).toBe('nope');
    expect(
      authReducer(base(), { type: registerUser.rejected.type, payload: undefined }).error,
    ).toBe('Registration failed.');
  });

  it('logoutUser.fulfilled clears session state', () => {
    const state = authReducer(
      base({
        authenticated: true,
        emailVerified: true,
        role: 'Admin',
        pendingVerificationEmail: 'a@b.co',
        providers: { google: false, github: false },
        providersLoaded: false,
      }),
      { type: logoutUser.fulfilled.type, payload: 'bye' },
    );
    expect(state.authenticated).toBe(false);
    expect(state.emailVerified).toBe(false);
    expect(state.role).toBe('');
    expect(state.pendingVerificationEmail).toBe('');
    expect(state.error).toBe('bye');
  });

  it('verifyEmail.fulfilled marks verified and sets the message', () => {
    const state = authReducer(base({ error: 'old' }), {
      type: verifyEmail.fulfilled.type,
      payload: 'verified',
    });
    expect(state.emailVerified).toBe(true);
    expect(state.message).toBe('verified');
    expect(state.error).toBe('');
  });

  it('verifyEmail.rejected records the error (payload and fallback)', () => {
    expect(
      authReducer(base(), { type: verifyEmail.rejected.type, payload: 'x' }).error,
    ).toBe('x');
    expect(
      authReducer(base(), { type: verifyEmail.rejected.type, payload: undefined }).error,
    ).toBe('Verification failed.');
  });

  it('resendVerification.fulfilled sets the message', () => {
    const state = authReducer(base({ error: 'old' }), {
      type: resendVerification.fulfilled.type,
      payload: 'sent',
    });
    expect(state.message).toBe('sent');
    expect(state.error).toBe('');
  });

  it('resendVerification.rejected records the error (payload and fallback)', () => {
    expect(
      authReducer(base(), { type: resendVerification.rejected.type, payload: 'x' }).error,
    ).toBe('x');
    expect(
      authReducer(base(), { type: resendVerification.rejected.type, payload: undefined }).error,
    ).toBe('Could not resend verification email.');
  });

  it('requestPasswordReset fulfilled/rejected update message/error', () => {
    expect(
      authReducer(base(), { type: requestPasswordReset.fulfilled.type, payload: 'm' }).message,
    ).toBe('m');
    expect(
      authReducer(base(), { type: requestPasswordReset.rejected.type, payload: 'e' }).error,
    ).toBe('e');
    expect(
      authReducer(base(), { type: requestPasswordReset.rejected.type, payload: undefined }).error,
    ).toBe('Could not request password reset.');
  });

  it('performPasswordReset fulfilled/rejected update message/error', () => {
    expect(
      authReducer(base(), { type: performPasswordReset.fulfilled.type, payload: 'm' }).message,
    ).toBe('m');
    expect(
      authReducer(base(), { type: performPasswordReset.rejected.type, payload: 'e' }).error,
    ).toBe('e');
    expect(
      authReducer(base(), { type: performPasswordReset.rejected.type, payload: undefined }).error,
    ).toBe('Could not reset password.');
  });
});
