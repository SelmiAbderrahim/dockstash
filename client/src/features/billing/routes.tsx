import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { BillingSettings } from './components/BillingSettings';
import { InitialCheckout } from './components/InitialCheckout';

export const billingRoutes: RouteObject[] = [
  {
    path: 'checkout/:plan',
    element: (
      <RequireAuth>
        <InitialCheckout />
      </RequireAuth>
    ),
  },
  {
    path: 'billing/settings',
    element: (
      <RequireAuth>
        <BillingSettings />
      </RequireAuth>
    ),
  },
];
