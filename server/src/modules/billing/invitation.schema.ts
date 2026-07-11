import { z } from 'zod';
import { GRANTABLE_PLAN_SLUGS, GRANT_DURATIONS } from './invitation.model.js';

const OBJECT_ID_PATTERN = /^[0-9a-fA-F]{24}$/;

/** Token shape as it may appear in a URL. NEVER a path — `[A-Za-z0-9_-]` only. */
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+$/;

export const createInvitationSchema = z.object({
  planSlug: z.enum(GRANTABLE_PLAN_SLUGS),
  grantDuration: z.enum(GRANT_DURATIONS),
  /** Link expiry, not grant duration. */
  expiresInDays: z.coerce.number().int().min(1).max(365).default(30),
  label: z.string().trim().max(120).optional(),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export const listInvitationsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type ListInvitationsQuery = z.infer<typeof listInvitationsSchema>;

export const invitationIdParamsSchema = z.object({
  id: z.string().regex(OBJECT_ID_PATTERN),
});

export type InvitationIdParams = z.infer<typeof invitationIdParamsSchema>;

export const invitationTokenParamsSchema = z.object({
  token: z.string().trim().min(1).max(128).regex(TOKEN_PATTERN),
});

export type InvitationTokenParams = z.infer<typeof invitationTokenParamsSchema>;
