import { z } from 'zod';
import { DATABASE_TYPES } from '../backups/backups.model.js';

/**
 * At-rest secret envelope. Ciphertext + iv + authTag are base64 strings; the
 * plaintext value is meaningless without `MASTER_ENCRYPTION_KEY`. Any field that
 * looks like a plaintext secret (e.g. a top-level `password` string) is refused
 * by `plaintextGuard` before the import ever touches the DB.
 */
export const encryptedSecretSchema = z
  .object({
    ciphertext: z.string().min(1),
    iv: z.string().min(1),
    authTag: z.string().min(1),
    keyVersion: z.number().int().nonnegative(),
  })
  .strict();

const databaseLayerSchema = z
  .object({
    service: z.string().min(1),
    type: z.enum(DATABASE_TYPES),
    container: z.string().min(1),
    enabled: z.boolean(),
  })
  .strict();

const planSchema = z
  .object({
    paths: z.array(z.string().min(1)).default([]),
    databases: z.array(databaseLayerSchema).default([]),
    configs: z.array(z.string().min(1)).default([]),
  })
  .strict();

/** A single project entry in the export envelope. */
export const projectEntrySchema = z
  .object({
    /** Original _id (used for idempotent re-import reconciliation). */
    id: z.string().min(1),
    name: z.string().min(1).max(120),
    path: z.string().min(1),
    plan: planSchema,
    /** Ciphertext + keyVersion only — never plaintext. */
    repoPasswordEnc: encryptedSecretSchema,
  })
  .strict();

/**
 * Storage-VPS connection ref (ssh host + user + encrypted key). Prompt 03 owns
 * the storage model; we accept the encrypted secret verbatim so a round-trip
 * never touches plaintext.
 */
export const storageRefSchema = z
  .object({
    host: z.string().min(1),
    user: z.string().min(1),
    /** Optional — self-host deployments may not have a stored SSH key. */
    sshKeyEnc: encryptedSecretSchema.optional(),
  })
  .strict()
  .optional();

/**
 * Top-level envelope shape. `.strict()` on every object refuses unknown fields
 * — a rogue `password` at the root would be rejected here before `plaintextGuard`
 * runs.
 */
export const importEnvelopeSchema = z
  .object({
    version: z.literal(1),
    exportedAt: z.string().min(1),
    keyVersion: z.number().int().nonnegative(),
    projects: z.array(projectEntrySchema),
    storage: storageRefSchema,
  })
  .strict();

export type ImportEnvelope = z.infer<typeof importEnvelopeSchema>;
export type ProjectEntry = z.infer<typeof projectEntrySchema>;
export type EncryptedSecretEnvelope = z.infer<typeof encryptedSecretSchema>;

/**
 * A last-line-of-defence check against a hand-crafted envelope that carries a
 * plaintext secret in a field name we haven't seen. Walks the tree and refuses
 * any string field named like a plaintext secret (`password`, `secret`, `token`,
 * `apiKey`, `sshKey`) that is NOT inside an `encryptedSecret` shape.
 */
export function plaintextGuard(input: unknown, path = '$'): string | null {
  if (input == null) return null;
  if (Array.isArray(input)) {
    for (let i = 0; i < input.length; i++) {
      const hit = plaintextGuard(input[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (typeof input !== 'object') return null;
  const obj = input as Record<string, unknown>;
  // An encryptedSecret shape is trusted verbatim — skip walking it.
  if (
    typeof obj.ciphertext === 'string' &&
    typeof obj.iv === 'string' &&
    typeof obj.authTag === 'string' &&
    typeof obj.keyVersion === 'number'
  ) {
    return null;
  }
  const banned = /^(password|secret|token|apiKey|sshKey|privateKey)$/i;
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === 'string' && banned.test(k)) {
      return `${path}.${k}`;
    }
    const nested = plaintextGuard(v, `${path}.${k}`);
    if (nested) return nested;
  }
  return null;
}
