import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { HelmetProvider } from 'react-helmet-async';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { VerifyEmail } from './VerifyEmail';
import { authReducer } from '../store/slice';
import type { AuthState } from '../types';
import { i18n, initI18n } from '@shared/i18n';
import * as api from '../api';

vi.mock('../api', () => ({
  verifyEmailRequest: vi.fn(),
  resendVerificationRequest: vi.fn(),
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
        authenticated: true,
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

const renderAt = (entry: string, auth: Partial<AuthState> = {}) =>
  render(
    <Provider store={makeStore(auth)}>
      <I18nextProvider i18n={i18n}>
        <HelmetProvider>
          <MemoryRouter initialEntries={[entry]}>
            <Routes>
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/verify-email/:token" element={<VerifyEmail />} />
              <Route path="/dashboard" element={<div>DASHBOARD</div>} />
            </Routes>
          </MemoryRouter>
        </HelmetProvider>
      </I18nextProvider>
    </Provider>,
  );

describe('VerifyEmail', () => {
  it('consumes the token on mount and navigates to the dashboard on success', async () => {
    mocked.verifyEmailRequest.mockResolvedValue({ message: 'ok' });
    renderAt('/verify-email/tok123');
    expect(await screen.findByText('DASHBOARD')).toBeInTheDocument();
    expect(mocked.verifyEmailRequest).toHaveBeenCalledWith('tok123');
  });

  it('shows an error and stays put when the token is invalid', async () => {
    mocked.verifyEmailRequest.mockRejectedValue(new Error('bad'));
    renderAt('/verify-email/bad');
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('DASHBOARD')).not.toBeInTheDocument();
  });

  it('resends using the pending email and shows the confirmation message', async () => {
    mocked.resendVerificationRequest.mockResolvedValue({ message: 'sent again' });
    renderAt('/verify-email', { pendingVerificationEmail: 'a@b.co' });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(mocked.resendVerificationRequest).toHaveBeenCalledWith('a@b.co'),
    );
    expect(await screen.findByText('sent again')).toBeInTheDocument();
  });

  it('falls back to a typed email when no pending email is present', async () => {
    mocked.resendVerificationRequest.mockResolvedValue({ message: 'sent' });
    renderAt('/verify-email');
    const input = screen.getByLabelText(/email/i);
    fireEvent.change(input, { target: { value: 'typed@b.co' } });
    fireEvent.click(screen.getByRole('button'));
    await waitFor(() =>
      expect(mocked.resendVerificationRequest).toHaveBeenCalledWith('typed@b.co'),
    );
  });

  it('does not resend when neither pending nor typed email is available', () => {
    renderAt('/verify-email');
    fireEvent.click(screen.getByRole('button'));
    expect(mocked.resendVerificationRequest).not.toHaveBeenCalled();
  });
});
