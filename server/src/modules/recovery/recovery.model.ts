import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const SELF_BACKUP_STATUSES = ['running', 'success', 'failed'] as const;
export type SelfBackupStatus = (typeof SELF_BACKUP_STATUSES)[number];

const selfBackupRunSchema = new mongoose.Schema(
  {
    repo: { type: String, required: true, index: true },
    status: { type: String, enum: SELF_BACKUP_STATUSES, required: true },
    snapshotId: { type: String, default: '' },
    sizeBytes: { type: Number, default: 0 },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, default: null },
    error: { type: String, default: '' },
  },
  { timestamps: true },
);

export type SelfBackupRunDocument = InferSchemaType<typeof selfBackupRunSchema>;
export type SelfBackupRunHydrated = HydratedDocument<SelfBackupRunDocument>;

export const SelfBackupRun =
  (mongoose.models.SelfBackupRun as mongoose.Model<SelfBackupRunDocument>) ||
  mongoose.model('SelfBackupRun', selfBackupRunSchema);
