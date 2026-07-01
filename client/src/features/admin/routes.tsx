import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { AdminDashboard } from './components/AdminDashboard';

export const adminRoutes: RouteObject[] = [
  {
    path: 'admin',
    element: (
      <RequireVerified>
        <AdminDashboard />
      </RequireVerified>
    ),
  },
];
