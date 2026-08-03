import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { OAuthCallback } from './OAuthCallback';
import { authReducer } from '../store/slice';
import type { AuthState } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import { loadCookie } from '@shared/utils/cookies';
import * as api from '../api';

vi.mock('../api', () => ({
  oauthProvidersRequest: vi.fn(),
  refreshRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  window.location.hash = '';
});

const makeStore = (auth: Partial<AuthState> = {}) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated: false,
        emailVerified: false,
        role: '',
        pendingVerificationEmail: '',
        providers: { google: false, github: false },
        providersLoaded: false,
        error: '',
        message: '',
        ...auth,
      },
    },
  });

const renderCallback = (hash: string, auth: Partial<AuthState> = {}) => {
  window.location.hash = hash;
  const store = makeStore(auth);
  render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/oauth/callback']}>
          <Routes>
            <Route path="/oauth/callback" element={<OAuthCallback />} />
            <Route path="/dashboard" element={<div>DASHBOARD</div>} />
            <Route path="/verify-email" element={<div>VERIFY</div>} />
            <Route path="/login" element={<div>LOGIN</div>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );
  return store;
};

describe('OAuthCallback', () => {
  it('completes the login from a token fragment and lands on the dashboard', async () => {
    mocked.refreshRequest.mockResolvedValue({
      token: 'JWT refreshed',
      user: { id: '1', email: 'o@b.co', emailVerified: true, role: 'Member' },
    });
    renderCallback('#token=JWT%20fragment');
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument();
    expect(loadCookie<string>('token')).toBe('JWT refreshed');
    // The token fragment must be scrubbed from the address bar.
    expect(window.location.hash).toBe('');
  });

  it('shows the completing state while the refresh is pending', () => {
    mocked.refreshRequest.mockReturnValue(new Promise(() => undefined));
    renderCallback('#token=JWT%20fragment');
    expect(screen.getByText('Completing sign-in…')).toBeInTheDocument();
  });

  it('routes an unverified user to verify-email', async () => {
    mocked.refreshRequest.mockResolvedValue({
      token: 'JWT refreshed',
      user: { id: '1', email: 'o@b.co', emailVerified: false, role: 'Member' },
    });
    renderCallback('#token=JWT%20fragment');
    expect(await screen.findByText('VERIFY')).toBeInTheDocument();
  });

  it.each([
    ['accessDenied', /cancelled/i],
    ['invalidState', /expired or was invalid/i],
    ['emailUnavailable', /verified email address/i],
    ['providerError', /failed/i],
  ])('renders the %s error with a way back to login', async (code, text) => {
    renderCallback(`#error=${code}`);
    expect(await screen.findByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('link', { name: /back to sign in/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('treats an unknown error code and an empty hash as a provider error', async () => {
    renderCallback('#error=whatever');
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed/i);
  });

  it('shows the refresh failure message when completing the session fails', async () => {
    mocked.refreshRequest.mockRejectedValue(new Error('token expired'));
    renderCallback('#token=JWT%20bad');
    expect(await screen.findByRole('alert')).toHaveTextContent('token expired');
    expect(loadCookie<string>('token')).toBeNull();
  });

  it('falls back to a provider error when the hash carries nothing', async () => {
    renderCallback('');
    expect(await screen.findByRole('alert')).toHaveTextContent(/failed/i);
  });
});
