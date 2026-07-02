import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated, selectUserRole } from '../store/selectors';

interface RequireRoleProps {
  role: string;
  children: ReactNode;
}

/**
 * Exact-role route guard. Role is read from Redux, which is seeded from the
 * stored `user` cookie so the gate holds across page refreshes (same trick as
 * {@link RequireVerified}).
 */
export const RequireRole = ({ role, children }: RequireRoleProps) => {
  const authenticated = useAppSelector(selectAuthenticated);
  const userRole = useAppSelector(selectUserRole);

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }
  if (userRole !== role) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
};
