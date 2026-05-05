import { apiClient } from '@shared/api/client';
import type {
  AuthResponse,
  LoginRequest,
  MessageResponse,
  ProtectedResponse,
  RegisterRequest,
} from './types';

export const loginRequest = (body: LoginRequest): Promise<AuthResponse> =>
  apiClient<AuthResponse>('/auth/login', { method: 'POST', body });

export const registerRequest = (body: RegisterRequest): Promise<AuthResponse> =>
  apiClient<AuthResponse>('/auth/register', { method: 'POST', body });

export const forgotPasswordRequest = (email: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>('/auth/forgot-password', { method: 'POST', body: { email } });

export const resetPasswordRequest = (token: string, password: string): Promise<MessageResponse> =>
  apiClient<MessageResponse>(`/auth/reset-password/${token}`, {
    method: 'POST',
    body: { password },
  });

export const protectedRequest = (): Promise<ProtectedResponse> =>
  apiClient<ProtectedResponse>('/protected', { auth: true });
