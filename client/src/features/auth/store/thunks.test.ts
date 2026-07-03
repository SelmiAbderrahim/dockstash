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
  verifyLoginOtp,
} from './thunks';
import { loadCookie } from '@shared/utils/cookies';
import * as cookies from '@shared/utils/cookies';
import type { AuthUser } from '../types';
import * as api from '../api';

vi.mock('../api', () => ({
  loginRequest: vi.fn(),
  verifyLoginOtpRequest: vi.fn(),
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
  it('loginUser stores cookies and resolves emailVerified + role', async () => {
    mocked.loginRequest.mockResolvedValue({
      token: 'JWT abc',
      user: { id: '1', email: 'a@b.co', emailVerified: true, role: 'Member' },
    });
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    expect(loginUser.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ otpRequired: false, emailVerified: true, role: 'Member' });
    expect(loadCookie<string>('token')).toBe('JWT abc');
    expect(loadCookie<AuthUser>('user')?.email).toBe('a@b.co');
  });

  it('loginUser writes the token/user cookies with sameSite=strict', async () => {
    const spy = vi.spyOn(cookies, 'saveCookie');
    mocked.loginRequest.mockResolvedValue({
      token: 'JWT abc',
      user: { id: '1', email: 'a@b.co', emailVerified: true, role: 'Member' },
    });
    const store = makeStore();
    await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    const tokenCall = spy.mock.calls.find((c) => c[0] === 'token');
    const userCall = spy.mock.calls.find((c) => c[0] === 'user');
    expect(tokenCall?.[2]).toMatchObject({ path: '/', sameSite: 'strict' });
    expect(userCall?.[2]).toMatchObject({ path: '/', sameSite: 'strict' });
    // Under jsdom's http origin, `secure` must NOT be set (would drop the cookie).
    expect((tokenCall?.[2] as { secure?: boolean }).secure).toBeUndefined();
    spy.mockRestore();
  });

  it('loginUser marks the token cookie secure when served over https', async () => {
    const original = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...original, protocol: 'https:' },
    });
    const spy = vi.spyOn(cookies, 'saveCookie');
    try {
      mocked.loginRequest.mockResolvedValue({
        token: 'JWT abc',
        user: { id: '1', email: 'a@b.co', emailVerified: true, role: 'Member' },
      });
      const store = makeStore();
      await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
      const tokenCall = spy.mock.calls.find((c) => c[0] === 'token');
      expect(tokenCall?.[2]).toMatchObject({ path: '/', sameSite: 'strict', secure: true });
    } finally {
      spy.mockRestore();
      Object.defineProperty(window, 'location', { configurable: true, value: original });
    }
  });

  it('loginUser defaults emailVerified and role when the fields are missing', async () => {
    mocked.loginRequest.mockResolvedValue({
      token: 'JWT abc',
      user: { id: '1', email: 'a@b.co' },
    });
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    expect(result.payload).toEqual({ otpRequired: false, emailVerified: false, role: '' });
  });

  it('loginUser returns the OTP challenge and writes no cookies', async () => {
    mocked.loginRequest.mockResolvedValue({ otpRequired: true, challengeId: 'ch1' });
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'root@b.co', password: 'pw' }));
    expect(result.payload).toEqual({ otpRequired: true, challengeId: 'ch1' });
    expect(loadCookie<string>('token')).toBeNull();
    expect(loadCookie<AuthUser>('user')).toBeNull();
  });

  it('verifyLoginOtp stores cookies and returns emailVerified + role', async () => {
    mocked.verifyLoginOtpRequest.mockResolvedValue({
      token: 'JWT xyz',
      user: { id: '9', email: 'root@b.co', emailVerified: true, role: 'Superadmin' },
    });
    const store = makeStore();
    const result = await store.dispatch(
      verifyLoginOtp({ challengeId: 'ch1', code: '123456' }),
    );
    expect(verifyLoginOtp.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ emailVerified: true, role: 'Superadmin' });
    expect(loadCookie<string>('token')).toBe('JWT xyz');
  });

  it('verifyLoginOtp defaults emailVerified and role when absent', async () => {
    mocked.verifyLoginOtpRequest.mockResolvedValue({
      token: 'JWT xyz',
      user: { id: '9', email: 'root@b.co' },
    });
    const store = makeStore();
    const result = await store.dispatch(
      verifyLoginOtp({ challengeId: 'ch1', code: '123456' }),
    );
    expect(result.payload).toEqual({ emailVerified: false, role: '' });
  });

  it('verifyLoginOtp rejects with a message on failure', async () => {
    mocked.verifyLoginOtpRequest.mockRejectedValue(new Error('bad code'));
    const store = makeStore();
    const result = await store.dispatch(
      verifyLoginOtp({ challengeId: 'ch1', code: '000000' }),
    );
    expect(verifyLoginOtp.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });

  it('loginUser rejects with a message on failure', async () => {
    mocked.loginRequest.mockRejectedValue(new Error('boom'));
    const store = makeStore();
    const result = await store.dispatch(loginUser({ email: 'a@b.co', password: 'pw' }));
    expect(loginUser.rejected.match(result)).toBe(true);
    expect(typeof result.payload).toBe('string');
  });

  it('registerUser returns email + emailVerified + role and stores cookies', async () => {
    mocked.registerRequest.mockResolvedValue({
      token: 'JWT r',
      user: { id: '2', email: 'new@b.co', emailVerified: false, role: 'Member' },
    });
    const store = makeStore();
    const result = await store.dispatch(
      registerUser({ email: 'new@b.co', firstName: 'N', lastName: 'U', password: 'pw' }),
    );
    expect(registerUser.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ email: 'new@b.co', emailVerified: false, role: 'Member' });
    expect(loadCookie<string>('token')).toBe('JWT r');
  });

  it('registerUser defaults emailVerified and role when absent', async () => {
    mocked.registerRequest.mockResolvedValue({
      token: 'JWT r',
      user: { id: '2', email: 'new@b.co' },
    });
    const store = makeStore();
    const result = await store.dispatch(
      registerUser({ email: 'new@b.co', firstName: 'N', lastName: 'U', password: 'pw' }),
    );
    expect(result.payload).toEqual({ email: 'new@b.co', emailVerified: false, role: '' });
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
