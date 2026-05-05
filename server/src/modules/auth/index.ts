export { authRouter, protectedRouter } from './auth.routes.js';
export { registerStrategies } from './passport.strategies.js';
export { requireRole, signup, login, refresh, forgotPassword, resetPassword } from './auth.controller.js';
export {
  hashPassword,
  verifyPassword,
  signToken,
  registerUser,
  authenticate,
  issueLoginResponse,
  type IssuedToken,
} from './auth.service.js';
