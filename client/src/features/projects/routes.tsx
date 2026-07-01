import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ProjectDetailScreen } from './components/ProjectDetailScreen';

export const projectsRoutes: RouteObject[] = [
  {
    path: 'projects',
    element: (
      <RequireVerified>
        <ProjectsScreen />
      </RequireVerified>
    ),
  },
  {
    path: 'projects/:projectId',
    element: (
      <RequireVerified>
        <ProjectDetailScreen />
      </RequireVerified>
    ),
  },
];
