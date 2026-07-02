import type { RouteObject } from 'react-router-dom';
import { AppLayout } from '@shared/components/AppLayout';
import { authRoutes } from '@features/auth';
import { billingRoutes } from '@features/billing';
import { dashboardRoutes } from '@features/dashboard';
import { adminRoutes } from '@features/admin';
import { fleetRoutes } from '@features/fleet';
import { marketingRoutes } from '@features/marketing';
import { profileRoutes } from '@features/profile';
import { projectsRoutes } from '@features/projects';
import { snapshotsRoutes } from '@features/snapshots';
import { settingsRoutes } from '@features/settings';
import { superadminRoutes } from '@features/superadmin';

/**
 * Authenticated SPA shell. A pathless parent so its children resolve to
 * absolute paths (/login, /dashboard, …). Rendered client-side only.
 */
export const appShellRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      ...authRoutes,
      ...billingRoutes,
      ...dashboardRoutes,
      ...adminRoutes,
      ...fleetRoutes,
      ...profileRoutes,
      ...projectsRoutes,
      ...snapshotsRoutes,
      ...settingsRoutes,
      ...superadminRoutes,
    ],
  },
];

/**
 * Full route tree. Marketing routes come first (server-rendered, public);
 * the app shell follows (client-rendered, authenticated). Consumed by both
 * the browser router (entry-client) and the static handler (entry-server).
 */
export const routes: RouteObject[] = [...marketingRoutes, ...appShellRoutes];
