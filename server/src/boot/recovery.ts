import { spawn as nodeSpawn } from 'node:child_process';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { decryptSecret } from '../shared/crypto/index.js';
import { configureRecoveryController } from '../modules/recovery/index.js';
import type { MongoDumpRunner } from '../modules/recovery/index.js';
import { getSettingsForUser, loadTransportForUser } from '../modules/settings/index.js';
import { ProcessResticRunner } from '../modules/backups/index.js';
import type { ProjectHydrated } from '../modules/backups/index.js';

type SpawnFn = typeof nodeSpawn;

/**
 * Argv-only mongodump of the orchestrator database, streamed to stdout. A
 * non-zero exit destroys the stream so the restic pipe fails loudly.
 */
export function makeMongoDumpRunner(spawnFn: SpawnFn = nodeSpawn): MongoDumpRunner {
  return {
    async dump(): Promise<Readable> {
      const child = spawnFn('mongodump', ['--uri', env.MONGODB_URI, '--archive'], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stderr = '';
      child.stderr?.on('data', (b: Buffer) => {
        stderr += b.toString();
      });
      const out = child.stdout as Readable;
      child.on('close', (code) => {
        if (code !== 0) {
          out.destroy(new Error(`mongodump exit ${code}: ${stderr.trim()}`));
        }
      });
      child.on('error', (err) => out.destroy(err));
      return out;
    },
  };
}

/**
 * Post-import reachability probe: build the importing owner's pinned SFTP
 * transport and `cat config` on the project repo with the imported password.
 */
export async function probeProjectRepo(
  project: ProjectHydrated,
  password: string,
): Promise<void> {
  const owner = project.owner.toString();
  const { transport, settings } = await loadTransportForUser(owner);
  /* c8 ignore next 3 -- unreachable: loadTransportForUser only returns configured settings, which implies sshKeyEnc */
  if (!settings.sshKeyEnc) {
    throw new Error('storage SSH key missing');
  }
  const runner = new ProcessResticRunner({
    repoUrl: transport.repoUrl({ id: String(project._id), owner }),
    password,
    ssh: {
      privateKey: decryptSecret(settings.sshKeyEnc),
      hostKeyLine: settings.hostKeyLine,
    },
  });
  await runner.check(['cat', 'config']);
}

export interface WireRecoveryOptions {
  spawnFn?: SpawnFn;
}

/**
 * Wire the recovery controller at boot. `loadStorage` reads the settings
 * module; self-backup runs synchronously against the reserved
 * `SELF_BACKUP_REPO` (a local path or restic URL reachable from the api
 * container).
 */
export function wireRecoveryController(opts: WireRecoveryOptions = {}): void {
  const spawnFn = opts.spawnFn ?? nodeSpawn;
  const selfBackupRunner = new ProcessResticRunner({
    repoUrl: env.SELF_BACKUP_REPO,
    // The self-backup repo is protected by the master encryption key string —
    // an operator restoring from scratch has it in the root .env by definition.
    password: env.MASTER_ENCRYPTION_KEY,
  });
  configureRecoveryController({
    loadStorage: async (userId: string) => {
      const settings = await getSettingsForUser(userId);
      if (!settings || !settings.sshKeyEnc) return null;
      return {
        host: settings.host,
        user: settings.user,
        sshKeyEnc: {
          ciphertext: settings.sshKeyEnc.ciphertext,
          iv: settings.sshKeyEnc.iv,
          authTag: settings.sshKeyEnc.authTag,
          keyVersion: settings.sshKeyEnc.keyVersion,
        },
      };
    },
    storageProbe: probeProjectRepo,
    resticRunner: selfBackupRunner,
    mongoDump: makeMongoDumpRunner(spawnFn),
  });
}
