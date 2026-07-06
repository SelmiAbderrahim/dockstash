export { authRouter, oauthPublicRouter } from './auth.routes.js';
export { registerStrategies } from './passport.strategies.js';
export { setOAuthHttp, oauthHttp, type OAuthHttp } from './oauth/oauth-http.js';
export {
  OAUTH_PROVIDERS,
  enabledProviders,
  isOAuthProviderName,
  isProviderEnabled,
  redirectUriFor,
  type OAuthProviderName,
} from './oauth/oauth-providers.js';
export {
  OAuthFlowError,
  buildAuthorizeUrl,
  exchangeCode,
  fetchProfile,
  findOrCreateOAuthUser,
  type OAuthFlowErrorCode,
  type OAuthProfile,
} from './oauth/oauth.service.js';
export {
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_TTL_SECONDS,
  createOAuthState,
  readStateCookie,
  stateCookieOptions,
  verifyOAuthState,
} from './oauth/oauth-state.js';
export {
  requireVerified,
  signup,
  login,
  refresh,
  verifyOtp,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from './auth.controller.js';
export {
  computeFingerprint,
  hashUserAgent,
  generateOtpCode,
  hashOtp,
  isTrustedDevice,
  trustDevice,
  createLoginChallenge,
  verifyLoginChallenge,
} from './login-otp.service.js';
export {
  LoginChallenge,
  OTP_CODE_LENGTH,
  OTP_TTL_MS,
  OTP_MAX_ATTEMPTS,
  type LoginChallengeDocument,
  type LoginChallengeHydrated,
} from './login-challenge.model.js';
export {
  TrustedDevice,
  DEVICE_TRUST_MS,
  type TrustedDeviceDocument,
  type TrustedDeviceHydrated,
} from './trusted-device.model.js';
export {
  hashPassword,
  verifyPassword,
  signToken,
  registerUser,
  authenticate,
  issueLoginResponse,
  verifyEmailWithToken,
  resendVerification as resendVerificationService,
  type IssuedToken,
} from './auth.service.js';
