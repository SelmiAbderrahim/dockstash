import { Project, type ProjectHydrated } from '../backups/backups.model.js';
import type { EncryptedSecretEnvelope, ImportEnvelope, ProjectEntry } from './recovery.schema.js';

/**
 * Build a portable export envelope for `userId`.
 *
 * Rules (from prompt 09):
 *   - Never call `decryptSecret`. Every secret ciphertext is copied verbatim
 *     alongside its `keyVersion`.
 *   - JSON-serializable — the controller streams the return value as an
 *     `attachment` download.
 *   - Ownership-scoped — never emits another user's projects.
 */
export interface StorageEnvelopeInput {
  host?: string;
  user?: string;
  sshKeyEnc?: EncryptedSecretEnvelope;
}

export interface BuildExportEnvelopeDeps {
  now?: Date;
  /** Injectable finder — tests avoid hitting the DB. */
  findProjects?: (userId: string) => Promise<ProjectHydrated[]>;
  /** Injectable storage lookup — prompt 03 owns the real model. */
  loadStorage?: (userId: string) => Promise<StorageEnvelopeInput | null>;
}

function extractEncryptedSecret(raw: unknown): EncryptedSecretEnvelope {
  // Mongoose sub-doc — coerce to a plain object so we don't leak Mongoose internals.
  const src = raw as {
    ciphertext: string;
    iv: string;
    authTag: string;
    keyVersion: number;
  };
  return {
    ciphertext: src.ciphertext,
    iv: src.iv,
    authTag: src.authTag,
    keyVersion: src.keyVersion,
  };
}

export async function buildExportEnvelope(
  userId: string,
  deps: BuildExportEnvelopeDeps = {},
): Promise<ImportEnvelope> {
  const now = deps.now ?? new Date();
  const finder = deps.findProjects ?? ((uid: string) => Project.find({ owner: uid }));
  const projects = await finder(userId);

  const entries: ProjectEntry[] = projects.map((p) => ({
    id: p._id.toString(),
    name: p.name,
    path: p.path,
    plan: {
      paths: [...p.plan.paths],
      databases: p.plan.databases.map((d) => ({
        service: d.service,
        type: d.type,
        container: d.container,
        enabled: Boolean(d.enabled),
      })),
      configs: [...p.plan.configs],
    },
    repoPasswordEnc: extractEncryptedSecret(p.repoPasswordEnc),
  }));

  const storage = deps.loadStorage ? await deps.loadStorage(userId) : null;
  const storageOut = storage && storage.host && storage.user
    ? {
        host: storage.host,
        user: storage.user,
        ...(storage.sshKeyEnc ? { sshKeyEnc: storage.sshKeyEnc } : {}),
      }
    : undefined;

  // Derive a summary keyVersion for humans. Falls back to 0 when the user
  // has no projects yet — the envelope is still valid but empty.
  const versions = entries.map((e) => e.repoPasswordEnc.keyVersion);
  const summaryKeyVersion = versions.length > 0 ? Math.max(...versions) : 0;

  return {
    version: 1,
    exportedAt: now.toISOString(),
    keyVersion: summaryKeyVersion,
    projects: entries,
    storage: storageOut,
  };
}
