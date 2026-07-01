import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const AUDIT_ACTIONS = [
  'backup.run',
  'backup.restore',
  'backup.delete',
  'plan.change',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_TARGET_TYPES = ['project', 'subscription'] as const;
export type AuditTargetType = (typeof AUDIT_TARGET_TYPES)[number];

const auditLogSchema = new mongoose.Schema(
  {
    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetType: { type: String, enum: AUDIT_TARGET_TYPES, required: true },
    targetId: { type: String, required: true },
    ip: { type: String, default: '' },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: () => ({}),
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ actorUserId: 1, createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof auditLogSchema>;
export type AuditLogHydrated = HydratedDocument<AuditLogDocument>;

export const AuditLog =
  (mongoose.models.AuditLog as mongoose.Model<AuditLogDocument>) ||
  mongoose.model('AuditLog', auditLogSchema);
