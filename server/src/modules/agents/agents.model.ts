import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AGENT_STATUSES = ['online', 'offline'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// Mirrors the crypto EncryptedSecret envelope (see shared/crypto). The agent
// API key is stored encrypted at rest, never in plaintext.
const encryptedSecretSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: Number, required: true },
  },
  { _id: false },
);

const agentSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true, default: 22 },
    // The agent's API key, encrypted at rest.
    apiKeyEnc: { type: encryptedSecretSchema, required: true },
    status: { type: String, enum: AGENT_STATUSES, default: 'offline' },
    lastSeenAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type AgentDocument = InferSchemaType<typeof agentSchema>;
export type AgentHydrated = HydratedDocument<AgentDocument>;

export const Agent =
  (mongoose.models.Agent as mongoose.Model<AgentDocument>) ||
  mongoose.model('Agent', agentSchema);
