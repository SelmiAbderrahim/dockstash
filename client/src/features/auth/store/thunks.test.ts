import { describe, expect, it, vi, beforeEach } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { authReducer } from './slice';
import {
  loginUser,
  logoutUser,
  registerUser,
  requestPasswordReset,
  performPasswordReset,
  resendVerification,
  verifyEmail,
} from './thunks';
import { loadCookie } from '@shared/utils/cookies';
import type { AuthUser } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  forgotPasswordRequest: vi.fn(),
  resetPasswordRequest: vi.fn(),
  verifyEmailRequest: vi.fn(),
  resendVerificationRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

const makeStore = () => configureStore({ reducer: { auth: authReducer } });

const clearCookies = () => {
  for (const name of ['token', 'user']) {
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
};

beforeEach(() => {
  vi.clearAllMocks();
  clearCookies();
});

describe('auth thunks', () => {
  it('loginUser stores cookies and resolves emailVerified', async () => {
    mocked.loginRequest.mockResolvedValue({
      token: 'JWT abc',
      user: { id: '1', email: 'a@b.co', emailVerified: true },
    });
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    expect(loginUser.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBe(true);
    expect(loadCookie<string>('token')).toBe('JWT abc');
    expect(loadCookie<AuthUser>('user')?.email).toBe('a@b.co');
  });

  it('loginUser defaults emailVerified to false when the field is missing', async () => {
    mocked.loginRequest.mockResolvedValue({
      token: 'JWT abc',
      user: { id: '1', email: 'a@b.co' },
    });
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    expect(result.payload).toBe(false);
  });

  it('loginUser rejects with a message on failure', async () => {
    mocked.loginRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    expect(loginUser.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });

  it('registerUser returns email + emailVerified and stores cookies', async () => {
    mocked.registerRequest.mockResolvedValue({
      token: 'JWT r',
      user: { id: '2', email: 'new@b.co', emailVerified: false },
    });
    const store = makeStore();
    const result = await store.dispatch(
      registerUser({ email: 'new@b.co', firstName: 'N', lastName: 'U', password: 'pw' }),
    );
    expect(registerUser.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ email: 'new@b.co', emailVerified: false });
    expect(loadCookie<string>('token')).toBe('JWT r');
  });

  it('registerUser defaults emailVerified to false when absent', async () => {
    mocked.registerRequest.mockResolvedValue({
      token: 'JWT r',
      user: { id: '2', email: 'new@b.co' },
    });
    const store = makeStore();
    const result = await store.dispatch(
      registerUser({ email: 'new@b.co', firstName: 'N', lastName: 'U', password: 'pw' }),
    );
    expect(result.payload).toEqual({ email: 'new@b.co', emailVerified: false });
  });

  it('registerUser rejects with a message on failure', async () => {
    mocked.registerRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(
      registerUser({ email: 'x@b.co', firstName: 'N', lastName: 'U', password: 'pw' }),
    );
    expect(registerUser.rejected.match(result)).toBe(true);
  });

  it('verifyEmail flips the stored user to verified and returns the message', async () => {
    document.cookie = `user=${encodeURIComponent(
      JSON.stringify({ id: '1', email: 'a@b.co', emailVerified: false }),
    )}; path=/`;
    mocked.verifyEmailRequest.mockResolvedValue({ message: 'ok' });
    const store = makeStore();
    const result = await store.dispatch(verifyEmail('tok'));
    expect(verifyEmail.fulfilled.match(result)).toBe(true);
    expect(result.payload).toBe('ok');
    expect(loadCookie<AuthUser>('user')?.emailVerified).toBe(true);
  });

  it('verifyEmail works even when no user cookie is present', async () => {
    mocked.verifyEmailRequest.mockResolvedValue({ message: 'ok' });
    const store = makeStore();
    const result = await store.dispatch(verifyEmail('tok'));
    expect(verifyEmail.fulfilled.match(result)).toBe(true);
  });

  it('verifyEmail rejects with a message on failure', async () => {
    mocked.verifyEmailRequest.mockRejectedValue(new Error('bad'));
    const store = makeStore();
    const result = await store.dispatch(verifyEmail('tok'));
    expect(verifyEmail.rejected.match(result)).toBe(true);
  });

  it('resendVerification returns the message', async () => {
    mocked.resendVerificationRequest.mockResolvedValue({ message: 'sent' });
    const store = makeStore();
    const result = await store.dispatch(resendVerification('a@b.co'));
    expect(result.payload).toBe('sent');
  });

  it('resendVerification rejects with a message on failure', async () => {
    mocked.resendVerificationRequest.mockRejectedValue(new Error('bad'));
    const store = makeStore();
    const result = await store.dispatch(resendVerification('a@b.co'));
    expect(resendVerification.rejected.match(result)).toBe(true);
  });

  it('logoutUser clears cookies and passes the message through', async () => {
    document.cookie = 'token=x; path=/';
    const store = makeStore();
    const result = await store.dispatch(logoutUser('bye'));
    expect(result.payload).toBe('bye');
    expect(loadCookie<string>('token')).toBeNull();
  });

  it('logoutUser defaults the message to empty string', async () => {
    const store = makeStore();
    const result = await store.dispatch(logoutUser(undefined));
    expect(result.payload).toBe('');
  });

  it('requestPasswordReset returns the message and rejects on failure', async () => {
    mocked.forgotPasswordRequest.mockResolvedValue({ message: 'check email' });
    const store = makeStore();
    const ok = await store.dispatch(requestPasswordReset({ email: 'a@b.co' }));
    expect(ok.payload).toBe('check email');

    mocked.forgotPasswordRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(requestPasswordReset({ email: 'a@b.co' }));
    expect(requestPasswordReset.rejected.match(bad)).toBe(true);
  });

  it('performPasswordReset returns the message and rejects on failure', async () => {
    mocked.resetPasswordRequest.mockResolvedValue({ message: 'changed' });
    const store = makeStore();
    const ok = await store.dispatch(performPasswordReset({ token: 't', password: 'pw' }));
    expect(ok.payload).toBe('changed');

    mocked.resetPasswordRequest.mockRejectedValue(new Error('x'));
    const bad = await store.dispatch(performPasswordReset({ token: 't', password: 'pw' }));
    expect(performPasswordReset.rejected.match(bad)).toBe(true);
  });
});
