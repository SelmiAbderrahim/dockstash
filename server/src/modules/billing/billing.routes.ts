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
export const billingRouter: Router = Router();

billingRouter.get('/pricing-tiers', listPricingTiers);

billingRouter.post('/checkout', requireAuth, startCheckout);
billingRouter.get('/portal', requireAuth, openPortal);
billingRouter.post('/change-plan', requireAuth, changePlan);
billingRouter.get('/overview', requireAuth, getOverview);
billingRouter.get('/usage', requireAuth, getUsage);
billingRouter.post('/select-projects', requireAuth, selectProjectsToKeep);
