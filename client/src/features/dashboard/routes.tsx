import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { Dashboard } from './components/Dashboard';
import { ViewProfile } from './components/ViewProfile';

export const dashboardRoutes: RouteObject[] = [
  {
    path: 'dashboard',
    element: (
      <RequireAuth>
        <Dashboard />
      </RequireAuth>
    ),
  },
  {
    path: 'profile',
    element: (
      <RequireAuth>
        <ViewProfile />
      </RequireAuth>
    ),
  },
];
