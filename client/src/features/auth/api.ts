import { apiClient } from '@shared/api/client';
import type {
  AuthResponse,
  LoginRequest,
  LoginResponse,
  MessageResponse,
  OAuthProviders,
  OtpVerifyRequest,
  RegisterRequest,
} from './types';

export const loginRequest = (body: LoginRequest): Promise<LoginResponse> =>
  apiClient<LoginResponse>('/auth/login', { method: 'POST', body });

export const verifyLoginOtpRequest = (body: OtpVerifyRequest): Promise<AuthResponse> =>
  apiClient<AuthResponse>('/auth/otp/verify', { method: 'POST', body });

export const registerRequest = (body: RegisterRequest): Promise<AuthResponse> =>
  apiClient<AuthResponse>('/auth/signup', { method: 'POST', body });

export const forgotPasswordRequest = (email: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/auth/forgot-password', { method: 'POST', body: { email } });

export const resetPasswordRequest = (token: string, password: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>(`/auth/reset-password/${token}`, {
    method: 'POST',
    body: { password },
  });

export const verifyEmailRequest = (token: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>(`/auth/verify-email/${token}`, { method: 'POST', body: {} });

export const resendVerificationRequest = (email: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/auth/resend-verification', { method: 'POST', body: { email } });

export const oauthProvidersRequest = (): Promise<OAuthProviders> =>
  apiClient<OAuthProviders>('/auth/providers');

export const refreshRequest = (): Promise<AuthResponse> =>
  apiClient<AuthResponse>('/auth/refresh', { method: 'POST', body: {}, auth: true });
