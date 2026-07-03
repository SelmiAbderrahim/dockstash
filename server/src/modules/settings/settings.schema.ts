import { z } from 'zod';

const FINGERPRINT_SHAPE = /^sha256:[A-Za-z0-9+/=_-]+$/;

// Hostname / IPv4 or a unix username. Both MUST start with an alphanumeric so a
// leading `-` can never be swallowed as an option by `ssh` / `ssh-keyscan`
// (argument injection). No shell metacharacters, no whitespace.
const HOST_SHAPE = /^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$/;
const USER_SHAPE = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

export const saveStorageSchema = z.object({
  host: z.string().trim().min(1).max(255).regex(HOST_SHAPE, 'invalid host'),
  user: z.string().trim().min(1).max(80).regex(USER_SHAPE, 'invalid user'),
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
