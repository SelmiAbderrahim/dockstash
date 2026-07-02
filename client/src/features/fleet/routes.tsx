import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { FleetScreen } from './components/FleetScreen';

export const fleetRoutes: RouteObject[] = [
  {
    path: 'fleet',
    element: (
      <RequireVerified>
        <FleetScreen />
      </RequireVerified>
    ),
  },
];
