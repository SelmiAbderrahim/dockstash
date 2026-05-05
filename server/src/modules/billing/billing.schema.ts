import { z } from 'zod';

export const createSubscriptionSchema = z.object({
  plan: z.string().min(1),
  stripeToken: z.string().min(1),
  lastFour: z.string().regex(/^\d{4}$/),
});
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;

export const changeSubscriptionSchema = z.object({
  newPlan: z.string().min(1),
});
export type ChangeSubscriptionInput = z.infer<typeof changeSubscriptionSchema>;

export const updateBillingInfoSchema = z.object({
  stripeToken: z.string().min(1),
});
export type UpdateBillingInfoInput = z.infer<typeof updateBillingInfoSchema>;

export const stripeWebhookSchema = z.object({
  data: z.object({
    id: z.string().min(1),
  }),
});
export type StripeWebhookPayload = z.infer<typeof stripeWebhookSchema>;
