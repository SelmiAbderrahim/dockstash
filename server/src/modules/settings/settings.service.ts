import { HttpError } from '../../shared/utils/http-error.js';
import { decryptSecret, encryptSecret } from '../../shared/crypto/index.js';
import { translate, DEFAULT_LOCALE } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import { PinnedSshTransport } from '../backups/backups.ssh-transport.js';
import { StorageSettings, type StorageSettingsHydrated } from './settings.model.js';
import { isStorageConfigured } from './settings.serialize.js';
import type { SaveRetentionInput, SaveStorageInput } from './settings.schema.js';

type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

/**
 * Connection probe boundary. The concrete implementation opens an SSH
 * connection to the storage VPS and reports the observed host key; tests
 * inject fakes. Kept injectable so the 100% coverage gate holds without a
 * network.
 */
export interface SshProbe {
  connect(opts: {
    host: string;
    user: string;
    port: number;
    privateKey: string;
  }): Promise<{ fingerprint: string; hostKeyLine: string }>;
}

export async function getSettingsForUser(
  userId: string,
): Promise<StorageSettingsHydrated | null> {
  return StorageSettings.findOne({ owner: userId });
}

/** Create-or-update the caller's storage settings. Private key is encrypted. */
export async function upsertStorage(
  userId: string,
  input: SaveStorageInput,
): Promise<StorageSettingsHydrated> {
  const existing = await StorageSettings.findOne({ owner: userId });
  const hostChanged = existing !== null && existing.host !== input.host;
  const settings =
    existing ??
    new StorageSettings({
      owner: userId,
      host: input.host,
      user: input.user,
    });
  settings.host = input.host;
  settings.user = input.user;
  settings.port = input.port;
  if (input.path) settings.basePath = input.path;
  settings.sshKeyEnc = encryptSecret(input.privateKey);
  if (input.hostKeyFingerprint) {
    settings.hostKeyFingerprint = input.hostKeyFingerprint;
  } else if (hostChanged) {
    // A different host has a different host key — drop the stale pin so the
    // next connection test re-pins rather than hard-failing on mismatch.
    settings.hostKeyFingerprint = '';
    settings.hostKeyLine = '';
  }
  settings.lastTestOk = null;
  settings.lastTestAt = null;
  await settings.save();
  return settings;
}

/**
 * Probe the storage VPS. Pins the observed host key on first success; after
 * pinning, any mismatch is a loud failure (never auto-accepted).
 */
export async function testStorage(
  userId: string,
  deps: { probe: SshProbe; t?: Translator; now?: Date },
): Promise<StorageSettingsHydrated> {
  const t = deps.t ?? identityT;
  const settings = await StorageSettings.findOne({ owner: userId });
  if (!settings || !isStorageConfigured(settings) || !settings.sshKeyEnc) {
    throw HttpError.badRequest(t('settings.error.storageNotConfigured'));
  }
  let observed: { fingerprint: string; hostKeyLine: string };
  try {
    observed = await deps.probe.connect({
      host: settings.host,
      user: settings.user,
      port: settings.port,
      privateKey: decryptSecret(settings.sshKeyEnc),
    });
  } catch (err) {
    settings.lastTestOk = false;
    settings.lastTestAt = deps.now ?? new Date();
    await settings.save();
    throw HttpError.badRequest(
      t('settings.error.connectionFailed', {
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
  if (settings.hostKeyFingerprint) {
    const transport = new PinnedSshTransport({
      host: settings.host,
      user: settings.user,
      pinnedFingerprint: settings.hostKeyFingerprint,
      t,
    });
    try {
      transport.verifyHostKey({ fingerprint: observed.fingerprint });
    } catch (err) {
      settings.lastTestOk = false;
      settings.lastTestAt = deps.now ?? new Date();
      await settings.save();
      throw err;
    }
  } else {
    // First successful test: pin the observed key.
    settings.hostKeyFingerprint = observed.fingerprint;
    settings.hostKeyLine = observed.hostKeyLine;
  }
  settings.lastTestOk = true;
  settings.lastTestAt = deps.now ?? new Date();
  await settings.save();
  return settings;
}

export async function saveRetention(
  userId: string,
  input: SaveRetentionInput,
): Promise<StorageSettingsHydrated> {
  const settings =
    (await StorageSettings.findOne({ owner: userId })) ??
    new StorageSettings({ owner: userId, host: '', user: '' });
  settings.retention.keepDaily = input.keepDaily;
  settings.retention.keepWeekly = input.keepWeekly;
  settings.retention.keepMonthly = input.keepMonthly;
  await settings.save();
  return settings;
}

export async function setEncryptionPassword(
  userId: string,
  password: string,
): Promise<StorageSettingsHydrated> {
  const settings =
    (await StorageSettings.findOne({ owner: userId })) ??
    new StorageSettings({ owner: userId, host: '', user: '' });
  settings.defaultRepoPasswordEnc = encryptSecret(password);
  await settings.save();
  return settings;
}

export interface UserTransport {
  transport: PinnedSshTransport;
  settings: StorageSettingsHydrated;
}

/**
 * Build the pinned SFTP transport for a user's configured storage. Consumed by
 * the restic runner factory and the recovery module. Throws 400 when storage
 * is unconfigured or the host key has not been pinned yet.
 */
export async function loadTransportForUser(
  userId: string,
  t: Translator = identityT,
): Promise<UserTransport> {
  const settings = await StorageSettings.findOne({ owner: userId });
  if (!settings || !isStorageConfigured(settings)) {
    throw HttpError.badRequest(t('settings.error.storageNotConfigured'));
  }
  if (!settings.hostKeyFingerprint) {
    throw HttpError.badRequest(t('settings.error.hostKeyNotPinned'));
  }
  const transport = new PinnedSshTransport({
    host: settings.host,
    user: settings.user,
    port: settings.port,
    basePath: settings.basePath,
    pinnedFingerprint: settings.hostKeyFingerprint,
    t,
  });
  return { transport, settings };
}
