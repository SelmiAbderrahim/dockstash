import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { SnapshotsScreen } from './components/SnapshotsScreen';

export const snapshotsRoutes: RouteObject[] = [
  {
    path: 'snapshots',
    element: (
      <RequireVerified>
        <SnapshotsScreen />
      </RequireVerified>
    ),
  },
];
