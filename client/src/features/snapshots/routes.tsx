import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { SnapshotsScreen } from './components/SnapshotsScreen';

export const snapshotsRoutes: RouteObject[] = [
  {
    path: 'snapshots',
    element: (
      <RequireAuth>
        <SnapshotsScreen />
      </RequireAuth>
    ),
  },
];
