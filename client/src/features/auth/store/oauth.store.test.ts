import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { loadCookie } from '@shared/utils/cookies';
import type { RootState } from '@app/store';
import { authReducer } from './slice';
import { completeOAuthLogin, fetchOAuthProviders } from './thunks';
import { selectOAuthProviders, selectOAuthProvidersLoaded } from './selectors';
import * as api from '../api';

vi.mock('../api', () => ({
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  forgotPasswordRequest: vi.fn(),
  resetPasswordRequest: vi.fn(),
  verifyEmailRequest: vi.fn(),
  resendVerificationRequest: vi.fn(),
  oauthProvidersRequest: vi.fn(),
  refreshRequest: vi.fn(),
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

describe('completeOAuthLogin', () => {
  it('persists the fragment token, refreshes the user and stores both cookies', async () => {
    mocked.refreshRequest.mockResolvedValue({
      token: 'JWT refreshed',
      user: { id: '1', email: 'o@b.co', emailVerified: true, role: 'Member' },
    });
    const store = makeStore();
    const result = await store.dispatch(completeOAuthLogin({ token: 'JWT fragment' }));
    expect(completeOAuthLogin.fulfilled.match(result)).toBe(true);
    expect(result.payload).toEqual({ emailVerified: true, role: 'Member' });
    expect(loadCookie<string>('token')).toBe('JWT refreshed');
    expect(loadCookie<{ email: string }>('user')?.email).toBe('o@b.co');

    const state = store.getState().auth;
    expect(state.authenticated).toBe(true);
    expect(state.emailVerified).toBe(true);
    expect(state.role).toBe('Member');
  });

  it('defaults missing user fields to safe values', async () => {
    mocked.refreshRequest.mockResolvedValue({
      token: 'JWT refreshed',
      user: { id: '1', email: 'o@b.co' },
    });
    const store = makeStore();
    const result = await store.dispatch(completeOAuthLogin({ token: 'JWT fragment' }));
    expect(result.payload).toEqual({ emailVerified: false, role: '' });
  });

  it('drops the token cookie and reports the error when the refresh fails', async () => {
    mocked.refreshRequest.mockRejectedValue(new Error('expired'));
    const store = makeStore();
    const result = await store.dispatch(completeOAuthLogin({ token: 'JWT bad' }));
    expect(completeOAuthLogin.rejected.match(result)).toBe(true);
    expect(loadCookie<string>('token')).toBeNull();

    const state = store.getState().auth;
    expect(state.authenticated).toBe(false);
    expect(state.error).toBe('expired');
  });
});

describe('completeOAuthLogin.rejected reducer fallback', () => {
  it('uses the default message when the rejection carries no payload', () => {
    const state = authReducer(
      undefined,
      completeOAuthLogin.rejected(new Error('boom'), 'req-1', { token: 'JWT x' }),
    );
    expect(state.error).toBe('Login failed.');
    expect(state.authenticated).toBe(false);
  });
});

describe('fetchOAuthProviders', () => {
  it('stores the provider flags and marks them loaded', async () => {
    mocked.oauthProvidersRequest.mockResolvedValue({ google: true, github: false });
    const store = makeStore();
    await store.dispatch(fetchOAuthProviders());
    const state = store.getState().auth;
    expect(state.providers).toEqual({ google: true, github: false });
    expect(state.providersLoaded).toBe(true);
  });

  it('fails closed when the probe errors', async () => {
    mocked.oauthProvidersRequest.mockRejectedValue(new Error('down'));
    const store = makeStore();
    await store.dispatch(fetchOAuthProviders());
    const state = store.getState().auth;
    expect(state.providers).toEqual({ google: false, github: false });
    expect(state.providersLoaded).toBe(true);
  });
});

describe('oauth selectors', () => {
  it('read providers and loaded flag', () => {
    const store = makeStore();
    const state = store.getState() as unknown as RootState;
    expect(selectOAuthProviders(state)).toEqual({ google: false, github: false });
    expect(selectOAuthProvidersLoaded(state)).toBe(false);
  });
});
