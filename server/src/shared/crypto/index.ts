import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import {
  __resetKeyRegistryForTests,
  __restoreKeyRegistryForTests,
  getCurrentKeyVersion,
  getKey,
} from './keyRegistry.js';

/**
 * Envelope for a secret encrypted at rest.
 *
 * All byte fields are base64-encoded so the record is safely embeddable inside
 * a Mongoose sub-schema without extra encoding gymnastics. The record shape is
 * frozen — downstream consumers (billing / backup) will `InferSchemaType` off
 * a Mongoose sub-schema whose fields mirror these exact names & types.
 */
export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
  keyVersion: number;
}

const ALGO = 'aes-256-gcm';
const IV_BYTES = 12;
const AUTH_TAG_BYTES = 16;

const defaultIvGenerator = (): Buffer => randomBytes(IV_BYTES);
let ivGenerator: () => Buffer = defaultIvGenerator;

export function encryptSecret(plaintext: string): EncryptedSecret {
  const keyVersion = getCurrentKeyVersion();
  const key = getKey(keyVersion);
  const iv = ivGenerator();
  if (iv.length !== IV_BYTES) {
    throw new Error(`IV must be ${IV_BYTES} bytes`);
  }
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion,
  };
}

export function decryptSecret(record: EncryptedSecret): string {
  const key = getKey(record.keyVersion);
  const iv = Buffer.from(record.iv, 'base64');
  const authTag = Buffer.from(record.authTag, 'base64');
  const ct = Buffer.from(record.ciphertext, 'base64');
  if (iv.length !== IV_BYTES) {
    throw new Error(`Invalid IV length (expected ${IV_BYTES} bytes)`);
  }
  if (authTag.length !== AUTH_TAG_BYTES) {
    throw new Error(`Invalid auth tag length (expected ${AUTH_TAG_BYTES} bytes)`);
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return pt.toString('utf8');
}

/**
 * Building block for the master-key rotation runbook: decrypt with the record's
 * stored `keyVersion`, then re-encrypt under `targetKeyVersion`. Callers perform
 * the atomic swap of the DB document containing the record.
 */
export function reEncryptSecret(
  record: EncryptedSecret,
  targetKeyVersion?: number,
): EncryptedSecret {
  const plaintext = decryptSecret(record);
  const target = targetKeyVersion ?? getCurrentKeyVersion();
  const key = getKey(target);
  const iv = ivGenerator();
  if (iv.length !== IV_BYTES) {
    throw new Error(`IV must be ${IV_BYTES} bytes`);
  }
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ct.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    keyVersion: target,
  };
}

/** Test-only: inject a deterministic IV generator for round-trip assertions. */
export function __setIvGeneratorForTests(fn: () => Buffer): void {
  ivGenerator = fn;
}

/** Test-only: restore the production random IV generator. */
export function __restoreIvGeneratorForTests(): void {
  ivGenerator = defaultIvGenerator;
}

export { __resetKeyRegistryForTests, __restoreKeyRegistryForTests };
