import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as client from '@shared/api/client';
import {
  loginRequest,
  registerRequest,
  forgotPasswordRequest,
  resetPasswordRequest,
  verifyEmailRequest,
  resendVerificationRequest,
} from './api';

vi.mock('@shared/api/client', () => ({ apiClient: vi.fn() }));
const apiClient = vi.mocked(client.apiClient);

beforeEach(() => {
  vi.clearAllMocks();
  apiClient.mockResolvedValue({} as never);
});

describe('auth api wrappers', () => {
  it('loginRequest posts credentials', async () => {
    await loginRequest({ email: 'a@b.co', password: 'pw' });
    expect(apiClient).toHaveBeenCalledWith('/auth/login', {
      method: 'POST',
      body: { email: 'a@b.co', password: 'pw' },
    });
  });

  it('registerRequest posts the signup body', async () => {
    const body = { email: 'a@b.co', firstName: 'A', lastName: 'B', password: 'pw' };
    await registerRequest(body);
    expect(apiClient).toHaveBeenCalledWith('/auth/signup', { method: 'POST', body });
  });

  it('forgotPasswordRequest posts the email', async () => {
    await forgotPasswordRequest('a@b.co');
    expect(apiClient).toHaveBeenCalledWith('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'a@b.co' },
    });
  });

  it('resetPasswordRequest posts to the token path', async () => {
    await resetPasswordRequest('tok', 'pw');
    expect(apiClient).toHaveBeenCalledWith('/auth/reset-password/tok', {
      method: 'POST',
      body: { password: 'pw' },
    });
  });

  it('verifyEmailRequest posts to the token path', async () => {
    await verifyEmailRequest('tok');
    expect(apiClient).toHaveBeenCalledWith('/auth/verify-email/tok', { method: 'POST', body: {} });
  });

  it('resendVerificationRequest posts the email', async () => {
    await resendVerificationRequest('a@b.co');
    expect(apiClient).toHaveBeenCalledWith('/auth/resend-verification', {
      method: 'POST',
      body: { email: 'a@b.co' },
    });
  });
});
