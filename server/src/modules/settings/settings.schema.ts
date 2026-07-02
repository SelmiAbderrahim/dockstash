import { z } from 'zod';

const FINGERPRINT_SHAPE = /^sha256:[A-Za-z0-9+/=_-]+$/;

export const saveStorageSchema = z.object({
  host: z.string().trim().min(1).max(255),
  user: z.string().trim().min(1).max(80),
  port: z.number().int().min(1).max(65535).default(22),
  privateKey: z.string().min(1).max(16_384),
  path: z.string().trim().min(1).max(1024).optional(),
  hostKeyFingerprint: z.string().regex(FINGERPRINT_SHAPE).optional(),
});
export type SaveStorageInput = z.infer<typeof saveStorageSchema>;

export const saveRetentionSchema = z.object({
  keepDaily: z.number().int().min(0).max(400),
  keepWeekly: z.number().int().min(0).max(400),
  keepMonthly: z.number().int().min(0).max(400),
});
export type SaveRetentionInput = z.infer<typeof saveRetentionSchema>;

export const savePasswordSchema = z.object({
  password: z.string().min(8).max(256),
});
export type SavePasswordInput = z.infer<typeof savePasswordSchema>;
