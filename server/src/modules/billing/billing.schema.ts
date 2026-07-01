import { z } from 'zod';

export const createCheckoutSchema = z.object({
  productId: z.string().min(1),
  successUrl: z.string().url(),
  cancelUrl: z.string().url().optional(),
});
export type CreateCheckoutInput = z.infer<typeof createCheckoutSchema>;

export const changePlanSchema = z.object({
  productId: z.string().min(1),
});
export type ChangePlanInput = z.infer<typeof changePlanSchema>;

export const selectProjectsSchema = z.object({
  keepIds: z.array(z.string().min(1)).min(1),
});
export type SelectProjectsInput = z.infer<typeof selectProjectsSchema>;
