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

/** Which OAuth sign-in providers the server has credentials for. */
export interface OAuthProviders {
  google: boolean;
  github: boolean;
}

export interface AuthState {
  authenticated: boolean;
  emailVerified: boolean;
  role: string;
  /** Non-empty while a superadmin login is waiting on its emailed OTP code. */
  otpChallengeId: string;
  pendingVerificationEmail: string;
  error: string;
  message: string;
  providers: OAuthProviders;
  /** True once /auth/providers has answered — buttons stay hidden until then. */
  providersLoaded: boolean;
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

/** Login answered with an OTP challenge instead of a token (superadmin from an unknown device/IP). */
export interface OtpChallengeResponse {
  otpRequired: true;
  challengeId: string;
  message?: string;
}

export type LoginResponse = AuthResponse | OtpChallengeResponse;

export interface OtpVerifyRequest {
  challengeId: string;
  code: string;
}

export interface MessageResponse {
  message: string;
}
