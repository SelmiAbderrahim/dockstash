import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated, selectEmailVerified } from '../store/selectors';

interface RequireVerifiedProps {
  children: ReactNode;
}

/**
 * Product routes are hard-gated behind email verification. Runs alongside
 * {@link RequireAuth}: an unauthenticated user goes to /login, an authenticated
 * but unverified user is bounced to /verify-email — even on a fresh page load,
 * because `emailVerified` is seeded from the stored user cookie.
 */
export const RequireVerified = ({ children }: RequireVerifiedProps) => {
  const authenticated = useAppSelector(selectAuthenticated);
  const emailVerified = useAppSelector(selectEmailVerified);

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  if (!emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }
  return <>{children}</>;
};
