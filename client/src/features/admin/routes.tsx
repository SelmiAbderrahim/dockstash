import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { AdminDashboard } from './components/AdminDashboard';

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    element: (
      <RequireAuth>
        <AdminDashboard />
      </RequireAuth>
    ),
  },
];
