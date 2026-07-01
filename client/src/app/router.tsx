import { createBrowserRouter } from 'react-router-dom';
import { routes } from './routes';

export { routes };

/** Build the browser data router (client entry). */
export function createAppRouter() {
  return createBrowserRouter(routes);
}
