import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import {
  changePlanSchema,
  createCheckoutSchema,
  selectProjectsSchema,
} from './billing.schema.js';
import {
  changePlanForUser,
  getBillingOverviewForUser,
  getPricingTiersForClient,
  getUsageForUser,
  openPortalForUser,
  selectProjectsForUser,
  startCheckoutForUser,
} from './billing.service.js';
import { extractIp, recordAudit } from '../audit/index.js';

export const startCheckout: RequestHandler = asyncHandler(async (req, res) => {
  const input = createCheckoutSchema.parse(req.body);
  const result = await startCheckoutForUser(requireUserId(req.user), input);
  res.status(200).json(result);
});

export const openPortal: RequestHandler = asyncHandler(async (req, res) => {
  const result = await openPortalForUser(requireUserId(req.user));
  res.status(200).json(result);
});

export const changePlan: RequestHandler = asyncHandler(async (req, res) => {
  const input = changePlanSchema.parse(req.body);
  const userId = requireUserId(req.user);
  const result = await changePlanForUser(userId, input);
  await recordAudit({
    actorUserId: userId,
    action: 'plan.change',
    targetType: 'subscription',
    targetId: userId,
    ip: extractIp(req),
    metadata: { productId: input.productId },
  });
  res.status(200).json(result);
});

export const listPricingTiers: RequestHandler = asyncHandler(async (_req, res) => {
  const tiers = await getPricingTiersForClient();
  res.status(200).json({ tiers });
});

export const getOverview: RequestHandler = asyncHandler(async (req, res) => {
  const overview = await getBillingOverviewForUser(requireUserId(req.user));
  res.status(200).json(overview);
});

export const getUsage: RequestHandler = asyncHandler(async (req, res) => {
  const usage = await getUsageForUser(requireUserId(req.user));
  res.status(200).json(usage);
});

export const selectProjectsToKeep: RequestHandler = asyncHandler(async (req, res) => {
  const input = selectProjectsSchema.parse(req.body);
  const result = await selectProjectsForUser(requireUserId(req.user), input);
  res.status(200).json(result);
});
