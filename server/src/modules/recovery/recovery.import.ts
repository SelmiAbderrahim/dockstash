import { HttpError } from '../../shared/utils/http-error.js';
import { decryptSecret, type EncryptedSecret } from '../../shared/crypto/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { Project, type ProjectHydrated } from '../backups/backups.model.js';
import type { ResticRunner } from '../backups/backups.boundaries.js';
import {
  importEnvelopeSchema,
  plaintextGuard,
  type ImportEnvelope,
  type EncryptedSecretEnvelope,
} from './recovery.schema.js';

export type Translator = (key: string, vars?: TranslationVars) => string;

const identityT: Translator = (key) => key;

export interface ImportEnvelopeDeps {
  t?: Translator;
  /**
   * Optional storage-probe hook: after import, run `restic snapshots` against
   * each project's repo to confirm it's reachable with the decrypted password.
   * Left off in tests unless the case exercises it.
   */
  storageProbe?: (
    project: ProjectHydrated,
    password: string,
  ) => Promise<void>;
  /** Injectable for tests — production wires to the real runner. */
  resticRunnerFor?: (project: ProjectHydrated) => ResticRunner;
}

export interface ImportEnvelopeResult {
  imported: number;
  reconciled: number;
  reachable: number;
}

/**
 * Validate + apply an import envelope for `userId`.
 *
 * Guarantees:
 *   - `.strict()` zod schema catches unknown fields.
 *   - `plaintextGuard` catches a hand-crafted plaintext secret field.
 *   - Every ciphertext must decrypt under the running `MASTER_ENCRYPTION_KEY`;
 *     a tampered ciphertext (GCM auth fail) or unknown `keyVersion` throws
 *     `HttpError.badRequest`.
 *   - Idempotent: re-importing reconciles by (owner, id) — never duplicates.
 */
export async function importEnvelope(
  userId: string,
  raw: unknown,
  deps: ImportEnvelopeDeps = {},
): Promise<ImportEnvelopeResult> {
  const t = deps.t ?? identityT;

  const parsed = importEnvelopeSchema.safeParse(raw);
  if (!parsed.success) {
    throw HttpError.badRequest(
      t('recovery.error.importInvalid', {
        message: parsed.error.issues[0]?.message ?? 'invalid envelope',
      }),
    );
  }
  const envelope: ImportEnvelope = parsed.data;

  const plaintextHit = plaintextGuard(envelope);
  if (plaintextHit) {
    throw HttpError.badRequest(
      t('recovery.error.plaintextForbidden', { field: plaintextHit }),
    );
  }

  // Probe every ciphertext: if it doesn't decrypt, either the keyVersion is
  // unknown or the bytes were tampered with. Fail closed.
  for (const p of envelope.projects) {
    assertDecryptable(p.repoPasswordEnc, t);
  }
  if (envelope.storage?.sshKeyEnc) {
    assertDecryptable(envelope.storage.sshKeyEnc, t);
  }

  let imported = 0;
  let reconciled = 0;
  let reachable = 0;

  for (const entry of envelope.projects) {
    const existing = await Project.findOne({ _id: entry.id, owner: userId });
    if (existing) {
      existing.name = entry.name;
      existing.path = entry.path;
      existing.plan = {
        paths: entry.plan.paths,
        databases: entry.plan.databases.map((d) => ({
          service: d.service,
          type: d.type,
          container: d.container,
          enabled: d.enabled,
        })),
        configs: entry.plan.configs,
      } as ProjectHydrated['plan'];
      existing.repoPasswordEnc = entry.repoPasswordEnc as ProjectHydrated['repoPasswordEnc'];
      await existing.save();
      reconciled += 1;
      if (await probeReachable(existing, entry.repoPasswordEnc, deps)) reachable += 1;
      continue;
    }
    // A project id belonging to a different owner is a cross-user leak attempt.
    const foreign = await Project.findById(entry.id);
    if (foreign && foreign.owner.toString() !== userId) {
      throw HttpError.forbidden(t('recovery.error.notOwner'));
    }
    const created = await Project.create({
      _id: entry.id,
      owner: userId,
      name: entry.name,
      path: entry.path,
      plan: {
        paths: entry.plan.paths,
        databases: entry.plan.databases,
        configs: entry.plan.configs,
      },
      repoPasswordEnc: entry.repoPasswordEnc,
      lastStatus: 'idle',
    });
    imported += 1;
    if (await probeReachable(created, entry.repoPasswordEnc, deps)) reachable += 1;
  }

  return { imported, reconciled, reachable };
}

function assertDecryptable(env: EncryptedSecretEnvelope, t: Translator): string {
  try {
    return decryptSecret(env as EncryptedSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // GCM auth-tag failure OR unknown keyVersion — both surface here.
    if (/unsupported key version|Unsupported state|unable to authenticate|auth/i.test(msg)) {
      throw HttpError.badRequest(t('recovery.error.importTampered'));
    }
    throw HttpError.badRequest(
      t('recovery.error.keyVersionMismatch', { version: env.keyVersion }),
    );
  }
}

async function probeReachable(
  project: ProjectHydrated,
  env: EncryptedSecretEnvelope,
  deps: ImportEnvelopeDeps,
): Promise<boolean> {
  if (!deps.storageProbe) return false;
  try {
    const password = decryptSecret(env as EncryptedSecret);
    await deps.storageProbe(project, password);
    return true;
  } catch {
    return false;
  }
}
