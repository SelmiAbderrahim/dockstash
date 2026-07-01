export { authRouter } from './auth.routes.js';
export { registerStrategies } from './passport.strategies.js';
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
  type IssuedToken,
} from './auth.service.js';
