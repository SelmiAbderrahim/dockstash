import { describe, expect, it, vi, afterEach } from 'vitest';
import { authReducer, cancelOtp, clearError, clearMessage } from './slice';
import {
  loginUser,
  logoutUser,
  performPasswordReset,
  registerUser,
  requestPasswordReset,
  resendVerification,
  verifyEmail,
  verifyLoginOtp,
} from './thunks';
import type { AuthState } from '../types';

const base = (over: Partial<AuthState> = {}): AuthState => ({
  authenticated: false,
  emailVerified: false,
  role: '',
  otpChallengeId: '',
  pendingVerificationEmail: '',
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
    document.cookie = `user=${encodeURIComponent(JSON.stringify({ role: 'Superadmin' }))}; path=/`;
    const fresh = await import('./slice');
    const state = fresh.authReducer(undefined, { type: 'unknown' });
    expect(state.role).toBe('Superadmin');
  });

  it('loginUser.fulfilled authenticates and carries emailVerified + role', () => {
    const state = authReducer(base(), {
      type: loginUser.fulfilled.type,
      payload: { otpRequired: false, emailVerified: true, role: 'Member' },
    });
    expect(state.authenticated).toBe(true);
    expect(state.emailVerified).toBe(true);
    expect(state.role).toBe('Member');
    expect(state.otpChallengeId).toBe('');
  });

  it('loginUser.fulfilled with an OTP challenge stays unauthenticated', () => {
    const state = authReducer(base(), {
      type: loginUser.fulfilled.type,
      payload: { otpRequired: true, challengeId: 'ch1' },
    });
    expect(state.authenticated).toBe(false);
    expect(state.otpChallengeId).toBe('ch1');
  });

  it('verifyLoginOtp.fulfilled authenticates and clears the challenge', () => {
    const state = authReducer(base({ otpChallengeId: 'ch1' }), {
      type: verifyLoginOtp.fulfilled.type,
      payload: { emailVerified: true, role: 'Superadmin' },
    });
    expect(state.authenticated).toBe(true);
    expect(state.role).toBe('Superadmin');
    expect(state.otpChallengeId).toBe('');
  });

  it('verifyLoginOtp.rejected keeps the challenge for retry', () => {
    const withPayload = authReducer(base({ otpChallengeId: 'ch1' }), {
      type: verifyLoginOtp.rejected.type,
      payload: 'bad',
    });
    expect(withPayload.error).toBe('bad');
    expect(withPayload.otpChallengeId).toBe('ch1');
    expect(
      authReducer(base({ otpChallengeId: 'ch1' }), {
        type: verifyLoginOtp.rejected.type,
        payload: undefined,
      }).error,
    ).toBe('Verification failed.');
  });

  it('cancelOtp clears the challenge and error', () => {
    const state = authReducer(base({ otpChallengeId: 'ch1', error: 'x' }), cancelOtp());
    expect(state.otpChallengeId).toBe('');
    expect(state.error).toBe('');
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
        role: 'Superadmin',
        otpChallengeId: 'ch1',
        pendingVerificationEmail: 'a@b.co',
      }),
      { type: logoutUser.fulfilled.type, payload: 'bye' },
    );
    expect(state.authenticated).toBe(false);
    expect(state.emailVerified).toBe(false);
    expect(state.role).toBe('');
    expect(state.otpChallengeId).toBe('');
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
