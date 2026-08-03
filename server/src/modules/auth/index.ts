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
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
} from './auth.controller.js';
export {
  hashPassword,
  verifyPassword,
  signToken,
  registerUser,
  authenticate,
  issueLoginResponse,
  verifyEmailWithToken,
  resendVerification as resendVerificationService,
  setAuthTimingPadMs,
  getAuthTimingPadMs,
  type IssuedToken,
} from './auth.service.js';
