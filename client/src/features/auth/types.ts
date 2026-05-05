export interface AuthUserProfile {
  firstName?: string;
  lastName?: string;
}

export interface AuthUser {
  _id: string;
  email: string;
  role?: string;
  profile?: AuthUserProfile;
}

export interface AuthState {
  authenticated: boolean;
  error: string;
  message: string;
  content: string;
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

export interface ProtectedResponse {
  content: string;
}
