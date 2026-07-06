import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { HealthScreen } from './components/HealthScreen';

export const healthRoutes: RouteObject[] = [
  {
    path: 'health',
    element: (
      <RequireVerified>
        <HealthScreen />
      </RequireVerified>
    ),
  },
];
