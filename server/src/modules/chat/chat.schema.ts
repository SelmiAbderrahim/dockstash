import { z } from 'zod';

const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'invalid id');

export const conversationIdParamsSchema = z.object({
  conversationId: objectIdSchema,
});
export type ConversationIdParams = z.infer<typeof conversationIdParamsSchema>;

export const recipientParamsSchema = z.object({
  recipient: objectIdSchema,
});
export type RecipientParams = z.infer<typeof recipientParamsSchema>;

export const composedMessageSchema = z.object({
  composedMessage: z.string().min(1),
});
export type ComposedMessageInput = z.infer<typeof composedMessageSchema>;
