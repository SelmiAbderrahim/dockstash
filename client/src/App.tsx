import { RouterProvider } from 'react-router-dom';
import { Providers } from './app/providers';
import { router } from './app/router';

export const App = () => {
  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  );
};
