import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const DATABASE_TYPES = ['postgres', 'mysql', 'mariadb', 'mongo'] as const;
export type DatabaseType = (typeof DATABASE_TYPES)[number];

export const BACKUP_STATUSES = ['idle', 'running', 'success', 'failed'] as const;
export type BackupStatus = (typeof BACKUP_STATUSES)[number];

export const VERIFY_STATUSES = ['pass', 'fail'] as const;
export type VerifyStatus = (typeof VERIFY_STATUSES)[number];

const encryptedSecretSchema = new mongoose.Schema(
  {
    ciphertext: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },
    keyVersion: { type: Number, required: true },
  },
  { _id: false },
);

const databaseLayerSchema = new mongoose.Schema(
  {
    service: { type: String, required: true },
    type: { type: String, enum: DATABASE_TYPES, required: true },
    container: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    paths: { type: [String], default: [] },
    databases: { type: [databaseLayerSchema], default: [] },
    configs: { type: [String], default: [] },
  },
  { _id: false },
);

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    path: { type: String, required: true, trim: true },
    plan: { type: planSchema, required: true, default: () => ({}) },
    repoPasswordEnc: { type: encryptedSecretSchema, required: true },
    lastStatus: { type: String, enum: BACKUP_STATUSES, default: 'idle' },
    lastError: { type: String, default: '' },
    lastRunAt: { type: Date },
    // Last successful backup completion — read by the dead-man's-switch
    // heartbeat sweep (prompt 08) to detect silent stalls.
    lastSuccessAt: { type: Date, default: null },
    // Dedupe window for the heartbeat sweep. Cleared on next success.
    lastHeartbeatAlertAt: { type: Date, default: null },
    lastCheckAt: { type: Date, default: null },
    lastCheckStatus: {
      type: String,
      enum: [...VERIFY_STATUSES, null] as unknown as (VerifyStatus | null)[],
      default: null,
    },
    lastCheckDetail: { type: String, default: '' },
    lastDrillAt: { type: Date, default: null },
    lastDrillStatus: {
      type: String,
      enum: [...VERIFY_STATUSES, null] as unknown as (VerifyStatus | null)[],
      default: null,
    },
    lastDrillDetail: { type: String, default: '' },
    // Lifecycle (prompt 07). A `paused` project is read-only: no new backups
    // run, but existing snapshots are retained. Set on downgrade-over-cap and
    // during lapse; cleared when the user reactivates or picks the project as
    // the survivor of a downgrade selection.
    paused: { type: Boolean, required: true, default: false },
    // Legal hold (prompt 11). When true, the retention `forget --prune` job
    // MUST skip this project — auto-prune never deletes held data. The
    // account-deletion purge also respects the hold.
    legalHold: { type: Boolean, required: true, default: false },
    legalHoldReason: { type: String, default: '' },
  },
  { timestamps: true },
);

export type ProjectDocument = InferSchemaType<typeof projectSchema>;
export type ProjectHydrated = HydratedDocument<ProjectDocument>;

export const Project =
  (mongoose.models.Project as mongoose.Model<ProjectDocument>) ||
  mongoose.model('Project', projectSchema);
