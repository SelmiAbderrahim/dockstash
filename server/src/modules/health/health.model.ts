import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const ALERT_EVENT_KINDS = [
  'backup',
  'restore',
  'drill',
  'mirror',
  'heartbeat',
] as const;
export type AlertEventKind = (typeof ALERT_EVENT_KINDS)[number];

export const ALERT_SEVERITIES = ['warning', 'critical'] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

/**
 * Persisted in-app alert (the alert-center feed). Rows are written on every
 * job failure and heartbeat stall regardless of plan — email/webhook channels
 * are plan-gated, the in-app record is not. The client composes the localized
 * message from `kind` + `projectName` + `error`; no server-side copy stored.
 */
const alertSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    projectName: { type: String, required: true, trim: true },
    kind: { type: String, enum: ALERT_EVENT_KINDS, required: true },
    severity: { type: String, enum: ALERT_SEVERITIES, required: true },
    error: { type: String, default: '' },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

alertSchema.index({ owner: 1, readAt: 1, createdAt: -1 });

export type AlertDocument = InferSchemaType<typeof alertSchema>;
export type AlertHydrated = HydratedDocument<AlertDocument>;

export const Alert =
  (mongoose.models.Alert as mongoose.Model<AlertDocument>) ||
  mongoose.model('Alert', alertSchema);
