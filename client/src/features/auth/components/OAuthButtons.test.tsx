import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import { GitHubMark, GoogleMark, OAuthButtons } from './OAuthButtons';
import { authReducer } from '../store/slice';
import type { AuthState } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import { redirectToOAuth } from '../oauth';
import * as api from '../api';

vi.mock('../api', () => ({
  oauthProvidersRequest: vi.fn(),
  refreshRequest: vi.fn(),
}));

vi.mock('../oauth', () => ({
  redirectToOAuth: vi.fn(),
}));

const mocked = vi.mocked(api);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
});

const makeStore = (auth: Partial<AuthState> = {}) =>
  configureStore({
    reducer: { auth: authReducer },
    preloadedState: {
      auth: {
        authenticated: false,
        emailVerified: false,
        role: '',
        otpChallengeId: '',
        pendingVerificationEmail: '',
        providers: { google: false, github: false },
        providersLoaded: false,
        error: '',
        message: '',
        ...auth,
      },
    },
  });

const renderButtons = (auth: Partial<AuthState> = {}) =>
  render(
    <Provider store={makeStore(auth)}>
      <I18nextProvider i18n={i18n}>
        <OAuthButtons />
      </I18nextProvider>
    </Provider>,
  );

describe('OAuthButtons', () => {
  it('renders nothing before the capability probe answers', () => {
    mocked.oauthProvidersRequest.mockReturnValue(new Promise(() => undefined));
    const { container } = renderButtons();
    expect(container.firstChild).toBeNull();
  });

  it('fetches the providers on mount and shows both buttons', async () => {
    mocked.oauthProvidersRequest.mockResolvedValue({ google: true, github: true });
    renderButtons();
    expect(await screen.findByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
    expect(screen.getByText(/or continue with/i)).toBeInTheDocument();
  });

  it('does not re-fetch when the flags are already loaded', () => {
    renderButtons({ providersLoaded: true, providers: { google: true, github: false } });
    expect(mocked.oauthProvidersRequest).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /continue with google/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue with github/i })).not.toBeInTheDocument();
  });

  it('renders nothing when no provider is configured', () => {
    const { container } = renderButtons({ providersLoaded: true });
    expect(container.firstChild).toBeNull();
  });

  it('shows only GitHub when Google is off', () => {
    renderButtons({ providersLoaded: true, providers: { google: false, github: true } });
    expect(screen.queryByRole('button', { name: /continue with google/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /continue with github/i })).toBeInTheDocument();
  });

  it('starts the OAuth navigation on click', async () => {
    renderButtons({ providersLoaded: true, providers: { google: true, github: true } });
    fireEvent.click(screen.getByRole('button', { name: /continue with google/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue with github/i }));
    await waitFor(() => {
      expect(vi.mocked(redirectToOAuth)).toHaveBeenCalledWith('google');
      expect(vi.mocked(redirectToOAuth)).toHaveBeenCalledWith('github');
    });
  });
});

describe('brand marks', () => {
  it('render as monochrome currentColor SVGs', () => {
    const { container: google } = render(<GoogleMark />);
    const { container: github } = render(<GitHubMark />);
    expect(google.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
    expect(github.querySelector('svg')).toHaveAttribute('fill', 'currentColor');
  });
});
