import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AGENT_STATUSES = ['online', 'offline'] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

// Mirrors the crypto HashedSecret shape (see shared/crypto). The agent API
// secret is stored as a deterministic HMAC — non-reversible, so a DB dump
// alone can never yield a usable credential.
const hashedSecretSchema = new mongoose.Schema(
  {
    hash: { type: String, required: true },
    keyVersion: { type: Number, required: true },
  },
  { _id: false },
);

// Raw discovery snapshot reported by the daemon (this host's /var/www folders +
// running containers). Stored verbatim; the read endpoint groups + derives plans.
const discoveredFolderSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    path: { type: String, default: '' },
    hasCompose: { type: Boolean, default: false },
    composeFile: { type: String, default: null },
  },
  { _id: false },
);

const discoveredContainerSchema = new mongoose.Schema(
  {
    id: { type: String, default: '' },
    names: { type: [String], default: [] },
    image: { type: String, default: '' },
    state: { type: String, default: '' },
    labels: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

const agentDiscoverySchema = new mongoose.Schema(
  {
    folders: { type: [discoveredFolderSchema], default: [] },
    containers: { type: [discoveredContainerSchema], default: [] },
    dockerAvailable: { type: Boolean, default: false },
    // The agent's configured DOCKSTASH_PROJECT_ROOTS (sanitized by the
    // heartbeat schema). Empty on pre-0.2.0 agents → readers fall back to
    // DEFAULT_AGENT_ROOTS.
    roots: { type: [String], default: [] },
    snapshotAt: { type: Date, default: null },
    // Named `discoveryErrors`, not `errors` — `errors` is a reserved Mongoose
    // Document pathname (Document.prototype.errors) and collides silently.
    discoveryErrors: { type: [String], default: [] },
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
    // HMAC of the agent's API secret. The composite token (dsa_<id>.<secret>)
    // is returned exactly once at registration / rotation.
    apiKeyHash: { type: hashedSecretSchema, required: true },
    status: { type: String, enum: AGENT_STATUSES, default: 'offline' },
    lastSeenAt: { type: Date, default: null },
    // Self-reported by the daemon on heartbeat.
    agentVersion: { type: String, default: '' },
    hostname: { type: String, default: '' },
    // Latest discovery snapshot (folders + running containers) from the daemon.
    discovery: { type: agentDiscoverySchema, default: null },
    // Set by POST /:agentId/discovery/refresh; cleared + surfaced as
    // `refreshDiscovery: true` on the next machine heartbeat (see
    // agent-api.controller.ts). Server never reaches the agent directly.
    discoveryRequestedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// One agent per (owner, host): a host is registered exactly once per account.
// DB-level uniqueness is the only race-proof guard against two near-simultaneous
// POSTs; the service also pre-checks for a friendly 409. The compound index
// also serves list-by-owner queries, so the standalone `owner` index above is
// redundant but harmless.
agentSchema.index({ owner: 1, host: 1 }, { unique: true });

export type AgentDocument = InferSchemaType<typeof agentSchema>;
export type AgentHydrated = HydratedDocument<AgentDocument>;

export const Agent =
  (mongoose.models.Agent as mongoose.Model<AgentDocument>) ||
  mongoose.model('Agent', agentSchema);
