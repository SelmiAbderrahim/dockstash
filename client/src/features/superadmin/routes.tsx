import type { RouteObject } from 'react-router-dom';
import { RequireRole } from '@features/auth';
import { SuperadminScreen } from './components/SuperadminScreen';

export const superadminRoutes: RouteObject[] = [
  {
    path: 'superadmin',
    element: (
      <RequireRole role="Superadmin">
        <SuperadminScreen />
      </RequireRole>
    ),
  },
];
