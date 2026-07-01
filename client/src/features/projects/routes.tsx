import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { ProjectsScreen } from './components/ProjectsScreen';
import { ProjectDetailScreen } from './components/ProjectDetailScreen';

export const projectsRoutes: RouteObject[] = [
  {
    path: 'projects',
    element: (
      <RequireAuth>
        <ProjectsScreen />
      </RequireAuth>
    ),
  },
  {
    path: 'projects/:projectId',
    element: (
      <RequireAuth>
        <ProjectDetailScreen />
      </RequireAuth>
    ),
  },
];
