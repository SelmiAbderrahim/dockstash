import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Login } from './Login';
import { Register } from './Register';
import { ForgotPassword } from './ForgotPassword';
import { ResetPassword } from './ResetPassword';
import { Logout } from './Logout';
import { RequireAuth } from './RequireAuth';
import { authReducer } from '../store/slice';
import type { AuthState } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  loginRequest: vi.fn(),
  registerRequest: vi.fn(),
  forgotPasswordRequest: vi.fn(),
  resetPasswordRequest: vi.fn(),
  verifyEmailRequest: vi.fn(),
  resendVerificationRequest: vi.fn(),
  // OAuthButtons probes this on mount inside Login/Register; unresolved =
  // buttons stay hidden, which keeps the pre-OAuth assertions stable.
  oauthProvidersRequest: vi.fn(() => new Promise(() => undefined)),
  refreshRequest: vi.fn(),
}));

const mocked = vi.mocked(api);

beforeEach(() => {
  initI18n({ initialLocale: 'en' });
  vi.clearAllMocks();
  document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = 'user=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
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

const renderComp = (
  ui: React.ReactNode,
  { entry = '/', auth = {} }: { entry?: string; auth?: Partial<AuthState> } = {},
) =>
  render(
    <Provider store={makeStore(auth)}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/reset-password/:resetToken" element={ui} />
            <Route path="/dashboard" element={<div>DASHBOARD</div>} />
            <Route path="/verify-email" element={<div>VERIFY</div>} />
            <Route path="/login" element={<div>LOGIN</div>} />
            <Route path="/invite/:token" element={<div>CLAIM</div>} />
          </Routes>
        </MemoryRouter>
      </I18nextProvider>
    </Provider>,
  );

describe('Login', () => {
  it('submits credentials to the login request', async () => {
    mocked.loginRequest.mockResolvedValue({
      token: 'JWT t',
      user: { id: '1', email: 'a@b.co', emailVerified: true },
    });
    renderComp(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(mocked.loginRequest).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret12' }),
    );
  });

  it('shows validation errors on empty submit', async () => {
    renderComp(<Login />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/please enter an email/i)).toBeInTheDocument();
    expect(mocked.loginRequest).not.toHaveBeenCalled();
  });

  it('redirects a verified authenticated user to the dashboard', () => {
    renderComp(<Login />, { auth: { authenticated: true, emailVerified: true } });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('redirects an unverified authenticated user to verify-email', () => {
    renderComp(<Login />, { auth: { authenticated: true, emailVerified: false } });
    expect(screen.getByText('VERIFY')).toBeInTheDocument();
  });

  it('renders the error banner when there is an auth error', () => {
    renderComp(<Login />, { auth: { error: 'Bad login' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Bad login');
  });
});

describe('Register', () => {
  it('submits and routes an unverified new user to verify-email', async () => {
    mocked.registerRequest.mockResolvedValue({
      token: 'JWT r',
      user: { id: '2', email: 'n@b.co', emailVerified: false },
    });
    renderComp(<Register />);
    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: 'N' } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: 'U' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'n@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('VERIFY')).toBeInTheDocument();
  });

  it('shows validation errors on empty submit', async () => {
    renderComp(<Register />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/please enter a first name/i)).toBeInTheDocument();
  });

  it('renders the error banner', () => {
    renderComp(<Register />, { auth: { error: 'Taken' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Taken');
  });

  it('redirects an already-verified authenticated user to the dashboard', () => {
    renderComp(<Register />, { auth: { authenticated: true, emailVerified: true } });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });
});

describe('ForgotPassword', () => {
  it('requests a reset and shows the success message', async () => {
    mocked.forgotPasswordRequest.mockResolvedValue({ message: 'Check your email' });
    renderComp(<ForgotPassword />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mocked.forgotPasswordRequest).toHaveBeenCalledWith('a@b.co'));
    expect(await screen.findByText('Check your email')).toBeInTheDocument();
  });

  it('shows a validation error on empty submit', async () => {
    renderComp(<ForgotPassword />);
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/please enter an email/i)).toBeInTheDocument();
  });

  it('redirects an authenticated user to the dashboard', () => {
    renderComp(<ForgotPassword />, { auth: { authenticated: true } });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('renders the error banner', () => {
    renderComp(<ForgotPassword />, { auth: { error: 'Nope' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Nope');
  });
});

describe('ResetPassword', () => {
  it('resets the password and navigates to login', async () => {
    mocked.resetPasswordRequest.mockResolvedValue({ message: 'Changed' });
    renderComp(<ResetPassword />, { entry: '/reset-password/tok123' });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newsecret1' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newsecret1' },
    });
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
    expect(mocked.resetPasswordRequest).toHaveBeenCalledWith('tok123', 'newsecret1');
  });

  it('shows a per-field error when the confirmation is left empty', async () => {
    renderComp(<ResetPassword />, { entry: '/reset-password/tok123' });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newsecret1' } });
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/please confirm new password/i)).toBeInTheDocument();
    expect(mocked.resetPasswordRequest).not.toHaveBeenCalled();
  });

  it('shows a mismatch error when passwords differ', async () => {
    renderComp(<ResetPassword />, { entry: '/reset-password/tok123' });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'aaaaaaaa' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'bbbbbbbb' },
    });
    fireEvent.click(screen.getByRole('button'));
    expect(await screen.findByText(/passwords must match/i)).toBeInTheDocument();
    expect(mocked.resetPasswordRequest).not.toHaveBeenCalled();
  });

  it('does nothing on submit when the reset token is missing from the URL', async () => {
    renderComp(<ResetPassword />, { entry: '/' });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newsecret1' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password'), {
      target: { value: 'newsecret1' },
    });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() => expect(mocked.resetPasswordRequest).not.toHaveBeenCalled());
  });

  it('redirects an authenticated user to the dashboard', () => {
    renderComp(<ResetPassword />, { entry: '/reset-password/tok', auth: { authenticated: true } });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('renders error and success banners', () => {
    renderComp(<ResetPassword />, { entry: '/reset-password/tok', auth: { error: 'E', message: 'M' } });
    expect(screen.getByRole('alert')).toHaveTextContent('E');
    expect(screen.getByText('M')).toBeInTheDocument();
  });
});

describe('Logout', () => {
  it('logs out and redirects to login', async () => {
    renderComp(<Logout />, { auth: { authenticated: true, emailVerified: true } });
    expect(screen.getByText(/sorry to see you go/i)).toBeInTheDocument();
    expect(await screen.findByText('LOGIN')).toBeInTheDocument();
  });
});

describe('RequireAuth', () => {
  it('redirects an unauthenticated user to login', () => {
    renderComp(
      <RequireAuth>
        <div>SECURE</div>
      </RequireAuth>,
    );
    expect(screen.getByText('LOGIN')).toBeInTheDocument();
  });

  it('renders children for an authenticated user', () => {
    renderComp(
      <RequireAuth>
        <div>SECURE</div>
      </RequireAuth>,
      { auth: { authenticated: true } },
    );
    expect(screen.getByText('SECURE')).toBeInTheDocument();
  });
});

describe('auth page titles (useDocumentTitle)', () => {
  it('sets the Login page title, brand-suffixed', async () => {
    renderComp(<Login />);
    await waitFor(() => {
      expect(document.title).toBe('Log in · Dockstash');
    });
  });

  it('sets the Register page title', async () => {
    renderComp(<Register />);
    await waitFor(() => {
      expect(document.title).toContain('Create your account');
    });
  });
});

describe('?invite= handoff', () => {
  const verified = { authenticated: true, emailVerified: true };

  it('Login sends a verified invitee to the claim page and carries the param cross-link', () => {
    renderComp(<Login />, { entry: '/?invite=tok-1', auth: verified });
    expect(screen.getByText('CLAIM')).toBeInTheDocument();
  });

  it('Login ignores a path-shaped invite value', () => {
    renderComp(<Login />, { entry: '/?invite=%2Fevil', auth: verified });
    expect(screen.getByText('DASHBOARD')).toBeInTheDocument();
  });

  it('Login still routes an unverified invitee to verify-email', () => {
    renderComp(<Login />, {
      entry: '/?invite=tok-1',
      auth: { authenticated: true, emailVerified: false },
    });
    expect(screen.getByText('VERIFY')).toBeInTheDocument();
  });

  it('Login cross-links to register with and without the param', () => {
    const first = renderComp(<Login />, { entry: '/?invite=tok-1' });
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register?invite=tok-1',
    );
    first.unmount();
    renderComp(<Login />);
    expect(screen.getByRole('link', { name: /create an account/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('Register sends a verified invitee to the claim page', () => {
    renderComp(<Register />, { entry: '/?invite=tok-1', auth: verified });
    expect(screen.getByText('CLAIM')).toBeInTheDocument();
  });

  it('Register cross-links to login with and without the param', () => {
    const first = renderComp(<Register />, { entry: '/?invite=tok-1' });
    expect(screen.getByRole('link', { name: /already have an account/i })).toHaveAttribute(
      'href',
      '/login?invite=tok-1',
    );
    first.unmount();

    renderComp(<Register />);
    expect(screen.getByRole('link', { name: /already have an account/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('Register still routes a fresh unverified signup to verify-email', () => {
    renderComp(<Register />, {
      entry: '/?invite=tok-1',
      auth: { authenticated: true, emailVerified: false },
    });
    expect(screen.getByText('VERIFY')).toBeInTheDocument();
  });
});
