export interface AuthUserProfile {
  firstName?: string;
  lastName?: string;
}

export interface AuthUser {
  _id?: string;
  id?: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  profile?: AuthUserProfile;
}

export interface AuthState {
  authenticated: boolean;
  emailVerified: boolean;
  pendingVerificationEmail: string;
  error: string;
  message: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: AuthUser;
}

export interface MessageResponse {
  message: string;
}
