export { authReducer } from './store/slice';
export { authRoutes } from './routes';
export { RequireAuth } from './components/RequireAuth';
export { RequireVerified } from './components/RequireVerified';
export { RequireRole } from './components/RequireRole';
export {
  selectAuthenticated,
  selectEmailVerified,
  selectUserRole,
  selectPendingVerificationEmail,
  selectAuthError,
  selectAuthMessage,
} from './store/selectors';
export { logoutUser, verifyEmail, resendVerification } from './store/thunks';
export type { AuthUser, AuthState } from './types';
