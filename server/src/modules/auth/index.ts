export { authRouter } from './auth.routes.js';
export { registerStrategies } from './passport.strategies.js';
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
