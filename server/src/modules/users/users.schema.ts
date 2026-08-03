import { z } from 'zod';

export const userIdParamsSchema = z.object({
  userId: z.string().min(1),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;

export const updatePreferencesSchema = z.object({
  guideMe: z.boolean(),
});

export type UpdatePreferencesInput = z.infer<typeof updatePreferencesSchema>;

export const updateProfileSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
