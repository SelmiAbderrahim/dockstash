import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import {
  changeSubscriptionSchema,
  createSubscriptionSchema,
  stripeWebhookSchema,
  updateBillingInfoSchema,
} from './billing.schema.js';
import {
  changeSubscriptionForUser,
  createSubscriptionForUser,
  deleteSubscriptionForUser,
  getCustomerForUser,
  handleStripeWebhook,
  updateCustomerBillingInfoForUser,
} from './billing.service.js';

export const webhook: RequestHandler = asyncHandler(async (req, res) => {
  const payload = stripeWebhookSchema.parse(req.body);
  await handleStripeWebhook(payload.data.id);
  res.status(200).json({ received: true });
});

export const createSubscription: RequestHandler = asyncHandler(async (req, res) => {
  const input = createSubscriptionSchema.parse(req.body);
  const result = await createSubscriptionForUser(requireUserId(req.user), input);
  res.status(200).json(result);
});

export const changeSubscription: RequestHandler = asyncHandler(async (req, res) => {
  const { newPlan } = changeSubscriptionSchema.parse(req.body);
  const result = await changeSubscriptionForUser(requireUserId(req.user), newPlan);
  res.status(200).json(result);
});

export const deleteSubscription: RequestHandler = asyncHandler(async (req, res) => {
  const result = await deleteSubscriptionForUser(requireUserId(req.user));
  res.status(200).json(result);
});

export const getCustomer: RequestHandler = asyncHandler(async (req, res) => {
  const result = await getCustomerForUser(requireUserId(req.user));
  res.status(200).json(result);
});

export const updateCustomerBillingInfo: RequestHandler = asyncHandler(async (req, res) => {
  const { stripeToken } = updateBillingInfoSchema.parse(req.body);
  const result = await updateCustomerBillingInfoForUser(requireUserId(req.user), stripeToken);
  res.status(200).json(result);
});
