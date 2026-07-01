import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { Dashboard } from './components/Dashboard';
import { ViewProfile } from './components/ViewProfile';

export const dashboardRoutes: RouteObject[] = [
  {
    path: 'dashboard',
    element: (
      <RequireVerified>
        <Dashboard />
      </RequireVerified>
    ),
  },
  {
    path: 'profile',
    element: (
      <RequireVerified>
        <ViewProfile />
      </RequireVerified>
    ),
  },
];
