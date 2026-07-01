import type { RouteObject } from 'react-router-dom';
import { RequireAuth } from '@features/auth';
import { BillingSettings } from './components/BillingSettings';
import { InitialCheckout } from './components/InitialCheckout';
import { BillingPage } from './components/BillingPage';

// NOTE: the public `/pricing` route is owned by the marketing feature
// (client/src/features/marketing) so it is server-rendered for SEO. It
// reuses this feature's <PricingPage> component via the billing public API.
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
  {
    path: 'billing',
    element: (
      <RequireAuth>
        <BillingPage />
      </RequireAuth>
    ),
  },
];
