import mongoose, { type InferSchemaType, type HydratedDocument } from 'mongoose';

export const JOB_KINDS = [
  'backup',
  'prune',
  'check',
  'drill',
  'restore',
  'mirror',
] as const;
export type JobKind = (typeof JOB_KINDS)[number];

/**
 * Kinds a cron `Schedule` may carry. `restore` is deliberately excluded —
 * restores are always explicit one-shot user actions, never recurring jobs.
 * `mirror` (Business) IS schedulable: one-way source→repo→target replication.
 */
export const SCHEDULABLE_JOB_KINDS = ['backup', 'prune', 'check', 'drill', 'mirror'] as const;
export type SchedulableJobKind = (typeof SCHEDULABLE_JOB_KINDS)[number];

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
    // Continuous-backup keeps. 0 = omit the flag from `restic forget` (the
    // pre-continuous behaviour), so legacy schedules are unaffected.
    keepHourly: { type: Number, default: 0, min: 0 },
    keepLast: { type: Number, default: 0, min: 0 },
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
    kind: { type: String, enum: SCHEDULABLE_JOB_KINDS, required: true },
    cron: { type: String, required: true, trim: true },
    retention: { type: retentionSchema, default: () => ({}) },
    enabled: { type: Boolean, default: true },
    // Set when a billing pause disabled this schedule (prompt 13 / F5). Only a
    // schedule paused BY billing is re-enabled on re-upgrade — a schedule the
    // user disabled independently stays disabled. `enabled:false` alone is
    // ambiguous, so this flag disambiguates the two.
    pausedByBilling: { type: Boolean, required: true, default: false },
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
