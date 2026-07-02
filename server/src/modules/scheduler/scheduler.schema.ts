import { z } from 'zod';
import cron from 'node-cron';
import { JOB_KINDS, SCHEDULABLE_JOB_KINDS } from './scheduler.model.js';

const cronString = z
  .string()
  .min(1)
  .refine((v) => cron.validate(v), { message: 'Invalid cron expression' });

const retentionInput = z.object({
  keepDaily: z.number().int().min(0).default(7),
  keepWeekly: z.number().int().min(0).default(4),
  keepMonthly: z.number().int().min(0).default(6),
});

export const createScheduleSchema = z.object({
  projectId: z.string().min(1),
  // Restores are one-shot user actions — never schedulable.
  kind: z.enum(SCHEDULABLE_JOB_KINDS),
  cron: cronString,
  retention: retentionInput.optional(),
  enabled: z.boolean().optional(),
});

export const updateScheduleSchema = z
  .object({
    cron: cronString.optional(),
    retention: retentionInput.partial().optional(),
    enabled: z.boolean().optional(),
  })
  .refine(
    (v) => v.cron !== undefined || v.retention !== undefined || v.enabled !== undefined,
    { message: 'at least one field required' },
  );

export const scheduleIdParamsSchema = z.object({
  scheduleId: z.string().min(1),
});

export const enqueueNowSchema = z.union([
  z.object({ scheduleId: z.string().min(1) }),
  z
    .object({
      projectId: z.string().min(1),
      kind: z.enum(JOB_KINDS),
      retention: retentionInput.optional(),
      // Restore-only fields (ignored for other kinds by the service layer).
      snapshotId: z.string().min(1).optional(),
      overwrite: z.boolean().optional(),
      targetPath: z.string().min(1).optional(),
    })
    .superRefine((v, ctx) => {
      if (v.kind !== 'restore') return;
      if (!v.snapshotId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['snapshotId'],
          message: 'snapshotId is required for restore jobs',
        });
      }
      if (v.overwrite === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['overwrite'],
          message: 'overwrite must be explicitly true or false for restore jobs',
        });
      } else if (!v.overwrite && !v.targetPath) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['targetPath'],
          message: 'targetPath is required when overwrite is false',
        });
      }
    }),
]);

export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
export type EnqueueNowInput = z.infer<typeof enqueueNowSchema>;
