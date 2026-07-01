import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
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
      <RequireVerified>
        <InitialCheckout />
      </RequireVerified>
    ),
  },
  {
    path: 'billing/settings',
    element: (
      <RequireVerified>
        <BillingSettings />
      </RequireVerified>
    ),
  },
  {
    path: 'billing',
    element: (
      <RequireVerified>
        <BillingPage />
      </RequireVerified>
    ),
  },
];
