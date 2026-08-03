import { reEncryptSecret, type EncryptedSecret } from './index.js';
import { getCurrentKeyVersion } from './keyRegistry.js';

export interface RotationTarget {
  id: string;
  record: EncryptedSecret;
}

export interface RotationStore {
  list(): Promise<RotationTarget[]>;
  swap(id: string, next: EncryptedSecret): Promise<void>;
}

export interface RotationResult {
  targetKeyVersion: number;
  rotated: number;
  skipped: number;
  failedAt?: string;
}

/**
 * Master-key rotation orchestrator.
 *
 * All-or-nothing per store: iterate every ciphertext under the store,
 * `decrypt-with-old → re-encrypt-at-new → swap`. If any single swap throws,
 * the orchestrator stops and reports `failedAt`; callers roll back by
 * *not* bumping `currentKeyVersion` in the registry — every un-swapped
 * record still decrypts under the old key, and every already-swapped record
 * decrypts under the new key that is still registered.
 *
 * Rotation NEVER logs or returns plaintext. On failure, the operator inspects
 * `failedAt`, resolves the underlying error, and re-runs; already-swapped
 * records are idempotent because `reEncryptSecret` short-circuits when the
 * record's `keyVersion` already equals the target.
 */
export async function rotateStore(
  store: RotationStore,
  targetKeyVersion: number = getCurrentKeyVersion(),
): Promise<RotationResult> {
  const targets = await store.list();
  let rotated = 0;
  let skipped = 0;
  for (const target of targets) {
    if (target.record.keyVersion === targetKeyVersion) {
      skipped += 1;
      continue;
    }
    try {
      const next = reEncryptSecret(target.record, targetKeyVersion);
      await store.swap(target.id, next);
      rotated += 1;
    } catch {
      return {
        targetKeyVersion,
        rotated,
        skipped,
        failedAt: target.id,
      };
    }
  }
  return { targetKeyVersion, rotated, skipped };
}
