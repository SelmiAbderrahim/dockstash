import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { SettingsScreen } from './components/SettingsScreen';
import { SetupWizard } from './components/SetupWizard';

export const settingsRoutes: RouteObject[] = [
  {
    path: 'settings',
    element: (
      <RequireVerified>
        <SettingsScreen />
      </RequireVerified>
    ),
  },
  {
    path: 'setup',
    element: (
      <RequireVerified>
        <SetupWizard />
      </RequireVerified>
    ),
  },
];
