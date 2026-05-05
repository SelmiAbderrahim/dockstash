import { createBrowserRouter } from 'react-router-dom';
import { adminRoutes } from '@features/admin';
import { authRoutes } from '@features/auth';
import { billingRoutes } from '@features/billing';
import { dashboardRoutes } from '@features/dashboard';
import { messagingRoutes } from '@features/messaging';
import { pagesRoutes } from '@features/pages';
import { AppLayout } from '@features/template';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      ...authRoutes,
      ...billingRoutes,
      ...dashboardRoutes,
      ...messagingRoutes,
      ...adminRoutes,
      ...pagesRoutes,
    ],
  },
]);
