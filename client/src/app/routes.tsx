import type { RouteObject } from 'react-router-dom';
import { AppLayout } from '@shared/components/AppLayout';
import { authRoutes } from '@features/auth';
import { dashboardRoutes } from '@features/dashboard';
import { fleetRoutes } from '@features/fleet';
import { healthRoutes } from '@features/health';
import { profileRoutes } from '@features/profile';
import { projectsRoutes } from '@features/projects';
import { snapshotsRoutes } from '@features/snapshots';
import { settingsRoutes } from '@features/settings';
import { RootRedirect } from './RootRedirect';

/**
 * The whole app. A pathless parent so its children resolve to absolute paths
 * (/login, /dashboard, …). There is no public surface: `/` and any unmatched
 * URL fall through to `RootRedirect`.
 */
export const appShellRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <RootRedirect /> },
      ...authRoutes,
      ...dashboardRoutes,
      ...fleetRoutes,
      ...healthRoutes,
      ...profileRoutes,
      ...projectsRoutes,
      ...snapshotsRoutes,
      ...settingsRoutes,
      { path: '*', element: <RootRedirect /> },
    ],
  },
];

export const routes: RouteObject[] = appShellRoutes;
