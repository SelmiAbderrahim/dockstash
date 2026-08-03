import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { ProfileScreen } from './components/ProfileScreen';

export const profileRoutes: RouteObject[] = [
  {
    path: 'profile',
    element: (
      <RequireVerified>
        <ProfileScreen />
      </RequireVerified>
    ),
  },
];
