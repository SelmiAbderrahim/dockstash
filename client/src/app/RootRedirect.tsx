import { Navigate } from 'react-router-dom';
import { useAppSelector } from '@shared/hooks/redux';
import { selectAuthenticated } from '@features/auth';

/**
 * Entry point of a self-hosted install. There is no public surface, so `/`
 * — and any unmatched URL — resolves to the dashboard for a signed-in user
 * and to the login screen for everyone else.
 */
export const RootRedirect = () => {
  const authenticated = useAppSelector(selectAuthenticated);
  return <Navigate replace to={authenticated ? '/dashboard' : '/login'} />;
};
