import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { SettingsScreen } from './components/SettingsScreen';
import { SetupWizard } from './components/SetupWizard';

export const settingsRoutes: RouteObject[] = [
  {
    path: 'settings',
    element: (
      <RequireAuth>
        <SettingsScreen />
      </RequireAuth>
    ),
  },
  {
    path: 'setup',
    element: (
      <RequireAuth>
        <SetupWizard />
      </RequireAuth>
    ),
  },
];
