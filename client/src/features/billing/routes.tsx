import { Navigate } from 'react-router-dom';
import type { RouteObject } from 'react-router-dom';
import { RequireVerified } from '@features/auth';
import { BillingPage } from './components/BillingPage';
import { InvitationClaimPage } from './components/InvitationClaimPage';

// NOTE: the public `/pricing` route is owned by the marketing feature
// (client/src/features/marketing/components/Pricing.tsx) so it is
// server-rendered for SEO; its CTAs deep-link to `/billing?tab=plans`, where
// the authenticated <PricingGrid> handles Polar checkout / plan changes.
export const billingRoutes: RouteObject[] = [
  // Legacy Stripe-era surfaces (/checkout/:plan card form, /billing/settings)
  // called /api/pay/* endpoints that no longer exist. Plan selection and
  // checkout now live on /billing (Polar hosted checkout) — redirect old links.
  { path: 'checkout/:plan', element: <Navigate to="/billing" replace /> },
  { path: 'billing/settings', element: <Navigate to="/billing" replace /> },
  {
    path: 'billing',
    element: (
      <RequireVerified>
        <BillingPage />
      </RequireVerified>
    ),
  },
  // Unguarded on purpose: the public resolve must render for a logged-out
  // visitor, who is then bounced to /login?invite=<token> by the page itself.
  { path: 'invite/:token', element: <InvitationClaimPage /> },
];
