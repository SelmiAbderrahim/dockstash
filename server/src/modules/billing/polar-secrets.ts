import { env } from '../../config/env.js';
import {
  encryptSecret,
  decryptSecret,
  type EncryptedSecret,
} from '../../shared/crypto/index.js';

// The Polar access token is read from the root .env (prompt 02 zod-validated)
// but MUST NOT be persisted or logged in plaintext. On first read we wrap it in
// an at-rest EncryptedSecret record (AES-256-GCM via MASTER_ENCRYPTION_KEY) and
// only decrypt in-process at call time. Never returned to the client.

let cachedEncrypted: EncryptedSecret | null = null;

export function getEncryptedPolarToken(): EncryptedSecret | null {
  const token = env.POLAR_ACCESS_TOKEN;
  if (!token) return null;
  if (!cachedEncrypted) {
    cachedEncrypted = encryptSecret(token);
  }
  return cachedEncrypted;
}

export function getDecryptedPolarToken(): string | null {
  const rec = getEncryptedPolarToken();
  return rec ? decryptSecret(rec) : null;
}

export function __resetPolarSecretsForTests(): void {
  cachedEncrypted = null;
}
