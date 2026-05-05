import type { RequestHandler } from 'express';
import { asyncHandler } from '../../shared/utils/async-handler.js';
import { requireUserId } from '../../shared/utils/require-user-id.js';
import {
  composedMessageSchema,
  conversationIdParamsSchema,
  recipientParamsSchema,
} from './chat.schema.js';
import {
  appendReply,
  getConversationMessages,
  listConversationsForUser,
  startConversation,
} from './chat.service.js';

export const listConversations: RequestHandler = asyncHandler(async (req, res) => {
  const conversations = await listConversationsForUser(requireUserId(req.user));
  res.status(200).json({ conversations });
});

export const getConversation: RequestHandler = asyncHandler(async (req, res) => {
  const { conversationId } = conversationIdParamsSchema.parse(req.params);
  const messages = await getConversationMessages(conversationId);
  res.status(200).json({ conversation: messages });
});

export const newConversation: RequestHandler = asyncHandler(async (req, res) => {
  const { recipient } = recipientParamsSchema.parse(req.params);
  const { composedMessage } = composedMessageSchema.parse(req.body);
  const { conversationId } = await startConversation(
    requireUserId(req.user),
    recipient,
    composedMessage,
  );
  res.status(201).json({ message: 'Conversation started!', conversationId });
});

export const sendReply: RequestHandler = asyncHandler(async (req, res) => {
  const { conversationId } = conversationIdParamsSchema.parse(req.params);
  const { composedMessage } = composedMessageSchema.parse(req.body);
  await appendReply(requireUserId(req.user), conversationId, composedMessage);
  res.status(200).json({ message: 'Reply successfully sent!' });
});
