import { Router } from 'express';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import {
  changePlan,
  getOverview,
  getUsage,
  listPricingTiers,
  openPortal,
  selectProjectsToKeep,
  startCheckout,
} from './billing.controller.js';

// NOTE: The provider-neutral webhook route lives OUTSIDE this router; it is
// mounted separately in `app.ts` with `express.raw({ type: '*/*' })` BEFORE the
// global JSON parser so the ingest pipeline receives the unparsed Buffer.

// Public catalog. `pricing-tiers` is pure catalog data (the controller/service
// never read `req.user`), so it lives on its own router mounted BEFORE the
// `verified` gate in `app.ts`. Keeping it out of `billingRouter` prevents the
// blanket `[requireAuth, requireVerified]` mount from 401-ing anonymous callers
// (e.g. the marketing pricing surface).
export const billingPublicRouter: Router = Router();

billingPublicRouter.get('/pricing-tiers', listPricingTiers);

// Authed surfaces. Mounted behind `verified` in `app.ts`; the per-route
// `requireAuth` here is belt-and-suspenders so the router is safe to mount
// anywhere.
export const billingRouter: Router = Router();

billingRouter.post('/checkout', requireAuth, startCheckout);
billingRouter.get('/portal', requireAuth, openPortal);
billingRouter.post('/change-plan', requireAuth, changePlan);
billingRouter.get('/overview', requireAuth, getOverview);
billingRouter.get('/usage', requireAuth, getUsage);
billingRouter.post('/select-projects', requireAuth, selectProjectsToKeep);
