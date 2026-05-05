import { HttpError } from '../../shared/utils/http-error.js';
import { Conversation, Message } from './chat.model.js';

export async function listConversationsForUser(userId: string) {
  const conversations = await Conversation.find({ participants: userId }).select('_id').lean();
  const messages = await Promise.all(
    conversations.map((c) =>
      Message.findOne({ conversationId: c._id })
        .sort('-createdAt')
        .populate({ path: 'author', select: 'profile.firstName profile.lastName' })
        .lean(),
    ),
  );
  return messages.filter((m): m is NonNullable<typeof m> => m !== null);
}

export async function getConversationMessages(conversationId: string) {
  return Message.find({ conversationId })
    .select('createdAt body author')
    .sort('-createdAt')
    .populate({ path: 'author', select: 'profile.firstName profile.lastName' })
    .lean();
}

export async function startConversation(authorId: string, recipientId: string, body: string) {
  if (authorId === recipientId) {
    throw HttpError.badRequest('Cannot start a conversation with yourself.');
  }
  const conversation = await Conversation.create({ participants: [authorId, recipientId] });
  await Message.create({ conversationId: conversation._id, body, author: authorId });
  return { conversationId: conversation._id.toString() };
}

export async function appendReply(authorId: string, conversationId: string, body: string) {
  await Message.create({ conversationId, body, author: authorId });
}
