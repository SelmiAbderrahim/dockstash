import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AGENT_JOB_STATUSES = ['pending', 'leased', 'succeeded', 'failed'] as const;
export type AgentJobStatus = (typeof AGENT_JOB_STATUSES)[number];

/** Job kinds an agent may execute. `drill` is server-local only (rejected at enqueue). */
export const AGENT_JOB_KINDS = ['backup', 'check', 'prune', 'restore'] as const;
export type AgentJobKind = (typeof AGENT_JOB_KINDS)[number];

const retentionSchema = new mongoose.Schema(
  {
    keepDaily: { type: Number, required: true },
    keepWeekly: { type: Number, required: true },
    keepMonthly: { type: Number, required: true },
  },
  { _id: false },
);

const restorePayloadSchema = new mongoose.Schema(
  {
    snapshotId: { type: String, required: true },
    overwrite: { type: Boolean, required: true },
    targetPath: { type: String, default: null },
  },
  { _id: false },
);

const resultStatsSchema = new mongoose.Schema(
  {
    snapshotCount: { type: Number, default: null },
    totalRepoBytes: { type: Number, default: null },
    lastBackupBytes: { type: Number, default: null },
  },
  { _id: false },
);

/**
 * A unit of work routed to a remote fleet agent instead of the local
 * scheduler worker. NEVER carries secrets — repo password / SSH material are
 * assembled at claim time and exist only in the claim response.
 */
const agentJobSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    agent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Agent',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    scheduleId: { type: String, default: null },
    kind: { type: String, enum: AGENT_JOB_KINDS, required: true },
    retention: { type: retentionSchema, default: null },
    restorePayload: { type: restorePayloadSchema, default: null },
    status: { type: String, enum: AGENT_JOB_STATUSES, default: 'pending', index: true },
    attempts: { type: Number, default: 0 },
    leaseExpiresAt: { type: Date, default: null },
    claimedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: '' },
    // Rolling tail of agent-reported log lines (server-capped at 200).
    logTail: { type: [String], default: [] },
    resultStats: { type: resultStatsSchema, default: null },
  },
  { timestamps: true },
);

agentJobSchema.index({ agent: 1, status: 1, createdAt: 1 });

export type AgentJobDocument = InferSchemaType<typeof agentJobSchema>;
export type AgentJobHydrated = HydratedDocument<AgentJobDocument>;

export const AgentJob =
  (mongoose.models.AgentJob as mongoose.Model<AgentJobDocument>) ||
  mongoose.model('AgentJob', agentJobSchema);
