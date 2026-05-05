import { z } from 'zod';

export const userIdParamsSchema = z.object({
  userId: z.string().min(1),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;
