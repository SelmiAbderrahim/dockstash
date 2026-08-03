import { HttpError } from '../../shared/utils/http-error.js';
import { User } from '../users/users.model.js';
import type { Translator } from '../backups/backups.service.js';
import {
  generateRecoveryCodes,
  unwrapWithRecoveryCodes,
  type WrappedMasterKey,
} from './recovery-codes.js';

export interface EnableEscrowResult {
  enabled: true;
  /** Shown to the user ONCE. Never persisted. */
  codes: string[];
  threshold: number;
  shareCount: number;
}

/**
 * Enable opt-in recovery-code escrow for a user: wrap the current master key
 * under a fresh Shamir escrow key, persist the wrapped key, and return the
 * recovery codes to display exactly once. Re-enabling regenerates and replaces
 * any prior escrow (old codes become useless).
 */
export async function enableRecoveryEscrow(
  userId: string,
  opts: { count?: number; threshold?: number; t?: Translator } = {},
): Promise<EnableEscrowResult> {
  const user = await User.findById(userId);
  if (!user) {
    throw HttpError.notFound(
      opts.t ? opts.t('recovery.error.userNotFound') : 'user not found',
    );
  }
  const { codes, wrapped } = generateRecoveryCodes(opts.count, opts.threshold);
  user.set('recoveryEscrow', {
    enabled: true,
    wrappedKey: wrapped,
    createdAt: new Date(),
  });
  await user.save();
  return {
    enabled: true,
    codes,
    threshold: wrapped.threshold,
    shareCount: wrapped.shareCount,
  };
}

/**
 * Operator recovery path: reconstruct the master-key bytes from a user's escrow
 * using ≥ threshold recovery codes. Returns null when escrow is not enabled or
 * the codes are insufficient/incorrect. The caller feeds the recovered key into
 * the master-key rotation runbook (`shared/crypto/rotate.ts`).
 */
export async function recoverMasterKeyBytes(
  userId: string,
  codes: string[],
): Promise<Buffer | null> {
  const user = await User.findById(userId).lean();
  const escrow = user?.recoveryEscrow;
  if (!escrow?.enabled || !escrow.wrappedKey) return null;
  const wrapped: WrappedMasterKey = {
    ciphertext: escrow.wrappedKey.ciphertext,
    iv: escrow.wrappedKey.iv,
    authTag: escrow.wrappedKey.authTag,
    keyVersion: escrow.wrappedKey.keyVersion,
    threshold: escrow.wrappedKey.threshold,
    shareCount: escrow.wrappedKey.shareCount,
  };
  return unwrapWithRecoveryCodes(wrapped, codes);
}
