import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const JOB_KINDS = ['backup', 'prune', 'check', 'drill'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const SCHEDULE_STATUSES = [
  'idle',
  'queued',
  'running',
  'success',
  'failed',
] as const;
export type ScheduleStatus = (typeof SCHEDULE_STATUSES)[number];

const retentionSchema = new mongoose.Schema(
  {
    keepDaily: { type: Number, default: 7, min: 0 },
    keepWeekly: { type: Number, default: 4, min: 0 },
    keepMonthly: { type: Number, default: 6, min: 0 },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
      index: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    kind: { type: String, enum: JOB_KINDS, required: true },
    cron: { type: String, required: true, trim: true },
    retention: { type: retentionSchema, default: () => ({}) },
    enabled: { type: Boolean, default: true },
    lastEnqueuedAt: { type: Date, default: null },
    lastRunStatus: { type: String, enum: SCHEDULE_STATUSES, default: 'idle' },
  },
  { timestamps: true },
);

export type ScheduleDocument = InferSchemaType<typeof scheduleSchema>;
export type ScheduleHydrated = HydratedDocument<ScheduleDocument>;

export const Schedule =
  (mongoose.models.Schedule as mongoose.Model<ScheduleDocument>) ||
  mongoose.model('Schedule', scheduleSchema);
