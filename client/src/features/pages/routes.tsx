import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { ComponentSamplesPage } from './components/ComponentSamplesPage';
import { ContactPage } from './components/ContactPage';
import { HomePage } from './components/HomePage';
import { NotFoundPage } from './components/NotFoundPage';

export const pagesRoutes: RouteObject[] = [
  { index: true, element: <HomePage /> },
  { path: 'contact-us', element: <ContactPage /> },
  {
    path: 'component-samples',
    element: (
      <RequireAuth>
        <ComponentSamplesPage />
      </RequireAuth>
    ),
  },
  { path: '*', element: <NotFoundPage /> },
];
