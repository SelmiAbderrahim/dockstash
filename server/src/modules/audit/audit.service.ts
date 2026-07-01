import type { Request } from 'express';
import { logger } from '../../config/logger.js';
import {
  AuditLog,
  type AuditAction,
  type AuditLogHydrated,
  type AuditTargetType,
} from './audit-log.model.js';

export interface RecordAuditInput {
  actorUserId: string;
  action: AuditAction;
  targetType: AuditTargetType;
  targetId: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Append a single audit entry. Best-effort — a persistence failure is logged
 * but never surfaced to the caller (audit MUST NOT block the primary action).
 */
export async function recordAudit(input: RecordAuditInput): Promise<void> {
  try {
    await AuditLog.create({
      actorUserId: input.actorUserId,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      ip: input.ip ?? '',
      metadata: input.metadata ?? {},
    });
  } catch (err) {
    logger.error(
      { err, action: input.action, actorUserId: input.actorUserId },
      'audit.recordAudit failed',
    );
  }
}

/**
 * Extract the source IP from a request. Trusts `X-Forwarded-For` per the
 * documented `app.set('trust proxy', 1)` config; falls back to socket address.
 */
export function extractIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? '';
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0]).split(',')[0]?.trim() ?? '';
  }
  return req.ip ?? '';
}

export async function listAuditForUser(
  userId: string,
  limit = 100,
): Promise<AuditLogHydrated[]> {
  return AuditLog.find({ actorUserId: userId })
    .sort({ createdAt: -1 })
    .limit(limit);
}
