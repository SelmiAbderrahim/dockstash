import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
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
  verifyLoginOtpRequest: vi.fn(),
  registerRequest: vi.fn(),
  forgotPasswordRequest: vi.fn(),
  resetPasswordRequest: vi.fn(),
  verifyEmailRequest: vi.fn(),
  resendVerificationRequest: vi.fn(),
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
        otpChallengeId: '',
        pendingVerificationEmail: '',
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
        <HelmetProvider>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/" element={ui} />
              <Route path="/reset-password/:resetToken" element={ui} />
              <Route path="/dashboard" element={<div>DASHBOARD</div>} />
              <Route path="/verify-email" element={<div>VERIFY</div>} />
              <Route path="/login" element={<div>LOGIN</div>} />
              <Route path="/superadmin" element={<div>SUPERADMIN</div>} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
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

  it('redirects an authenticated superadmin to the console', () => {
    renderComp(<Login />, {
      auth: { authenticated: true, emailVerified: true, role: 'Superadmin' },
    });
    expect(screen.getByText('SUPERADMIN')).toBeInTheDocument();
  });

  it('renders the error banner when there is an auth error', () => {
    renderComp(<Login />, { auth: { error: 'Bad login' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Bad login');
  });

  it('shows the OTP step, submits the code, and lands on the superadmin console', async () => {
    mocked.loginRequest.mockResolvedValue({ otpRequired: true, challengeId: 'ch1' });
    mocked.verifyLoginOtpRequest.mockResolvedValue({
      token: 'JWT t',
      user: { id: '1', email: 'root@b.co', emailVerified: true, role: 'Superadmin' },
    });
    renderComp(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'root@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    const codeInput = await screen.findByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));

    await waitFor(() =>
      expect(mocked.verifyLoginOtpRequest).toHaveBeenCalledWith({
        challengeId: 'ch1',
        code: '123456',
      }),
    );
    expect(await screen.findByText('SUPERADMIN')).toBeInTheDocument();
  });

  it('rejects a malformed OTP code without calling the API', async () => {
    mocked.loginRequest.mockResolvedValue({ otpRequired: true, challengeId: 'ch1' });
    renderComp(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'root@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    const codeInput = await screen.findByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    expect(await screen.findByText(/enter the 6-digit code/i)).toBeInTheDocument();
    expect(mocked.verifyLoginOtpRequest).not.toHaveBeenCalled();
  });

  it('keeps the OTP step and shows the error when verification fails', async () => {
    mocked.loginRequest.mockResolvedValue({ otpRequired: true, challengeId: 'ch1' });
    mocked.verifyLoginOtpRequest.mockRejectedValue(new Error('bad code'));
    renderComp(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'root@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    const codeInput = await screen.findByLabelText(/verification code/i);
    fireEvent.change(codeInput, { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: /^verify$/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('bad code');
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
  });

  it('returns to the credentials form when Back is clicked', async () => {
    mocked.loginRequest.mockResolvedValue({ otpRequired: true, challengeId: 'ch1' });
    renderComp(<Login />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'root@b.co' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret12' } });
    fireEvent.click(screen.getByRole('button', { name: /log in/i }));

    await screen.findByLabelText(/verification code/i);
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(await screen.findByLabelText(/password/i)).toBeInTheDocument();
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

describe('auth page head tags (PageMeta)', () => {
  it('sets a noindex robots meta and a page title on Login', async () => {
    renderComp(<Login />);
    await waitFor(() => {
      expect(document.title).toContain('Log in');
    });
    const robots = document.head.querySelector('meta[name="robots"]');
    expect(robots?.getAttribute('content')).toBe('noindex, follow');
    const description = document.head.querySelector('meta[name="description"]');
    expect(description?.getAttribute('content')).toContain('Dockstash');
  });

  it('sets the Register page title', async () => {
    renderComp(<Register />);
    await waitFor(() => {
      expect(document.title).toContain('Create your account');
    });
  });
});
