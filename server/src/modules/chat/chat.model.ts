import mongoose, { type HydratedDocument, type InferSchemaType } from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true },
);

conversationSchema.index({ participants: 1 });

export type ConversationDocument = InferSchemaType<typeof conversationSchema>;
export type ConversationHydrated = HydratedDocument<ConversationDocument>;

export const Conversation = mongoose.model('Conversation', conversationSchema);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

messageSchema.index({ conversationId: 1, createdAt: -1 });

export type MessageDocument = InferSchemaType<typeof messageSchema>;
export type MessageHydrated = HydratedDocument<MessageDocument>;

export const Message = mongoose.model('Message', messageSchema);
