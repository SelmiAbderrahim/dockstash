import type { RouteObject } from 'react-router-dom';
import { ForgotPassword } from './components/ForgotPassword';
import { Login } from './components/Login';
import { Logout } from './components/Logout';
import { Register } from './components/Register';
import { ResetPassword } from './components/ResetPassword';
import { VerifyEmail } from './components/VerifyEmail';

export const authRoutes: RouteObject[] = [
  { path: 'login', element: <Login /> },
  { path: 'register', element: <Register /> },
  { path: 'logout', element: <Logout /> },
  { path: 'forgot-password', element: <ForgotPassword /> },
  { path: 'reset-password/:resetToken', element: <ResetPassword /> },
  { path: 'verify-email', element: <VerifyEmail /> },
  { path: 'verify-email/:token', element: <VerifyEmail /> },
];
