import { z } from 'zod';

export const oauthCallbackQuerySchema = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
});

export type OAuthCallbackQuery = z.infer<typeof oauthCallbackQuerySchema>;
