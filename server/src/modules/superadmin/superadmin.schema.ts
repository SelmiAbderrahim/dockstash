import { z } from 'zod';
import { ASSIGNABLE_ROLES } from '../users/index.js';
import { AUDIT_ACTIONS } from '../audit/index.js';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

export const userIdParamsSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN),
});

export type UserIdParams = z.infer<typeof userIdParamsSchema>;

const pageSchema = z.coerce.number().int().min(1).default(1);

export const listUsersQuerySchema = z.object({
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
});

export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;

// Superadmin is intentionally not assignable — promoting to it via the API is
// rejected at the schema layer (400), not by a service guard.
export const changeRoleSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
});

export type ChangeRoleInput = z.infer<typeof changeRoleSchema>;

export const legalHoldSchema = z.object({
  legalHold: z.boolean(),
});

export type LegalHoldInput = z.infer<typeof legalHoldSchema>;

export const billingQuerySchema = z.object({
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type BillingQuery = z.infer<typeof billingQuerySchema>;

export const auditQuerySchema = z.object({
  page: pageSchema,
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.enum(AUDIT_ACTIONS).optional(),
  actorUserId: z.string().regex(OBJECT_ID_PATTERN).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AuditQuery = z.infer<typeof auditQuerySchema>;
