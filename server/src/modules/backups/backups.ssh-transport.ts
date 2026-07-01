import { HttpError } from '../../shared/utils/http-error.js';
import { DEFAULT_LOCALE, translate } from '../../shared/i18n/index.js';
import type { TranslationVars } from '../../shared/i18n/index.js';
import type { SshTransport } from './backups.boundaries.js';

export type Translator = (key: string, vars?: TranslationVars) => string;
const identityT: Translator = (key, vars) => translate(DEFAULT_LOCALE, key, vars);

const FINGERPRINT_SHAPE = /^sha256:[A-Za-z0-9+/=_-]+$/;

export interface SshTransportOptions {
  host: string;
  user: string;
  /** Pinned peer host-key fingerprint. Format: `sha256:BASE64`. */
  pinnedFingerprint: string;
  t?: Translator;
}

/**
 * Pinned SSH transport: `verifyHostKey` rejects any mismatch against the
 * stored fingerprint. Never falls back to `StrictHostKeyChecking=no`, never
 * auto-accepts. A changed host key surfaces as a loud backup failure.
 */
export class PinnedSshTransport implements SshTransport {
  readonly host: string;
  readonly user: string;
  readonly pinnedFingerprint: string;
  private readonly t: Translator;

  constructor(opts: SshTransportOptions) {
    if (!FINGERPRINT_SHAPE.test(opts.pinnedFingerprint)) {
      throw HttpError.internal(
        (opts.t ?? identityT)('security.error.hostKeyMalformed'),
      );
    }
    this.host = opts.host;
    this.user = opts.user;
    this.pinnedFingerprint = opts.pinnedFingerprint;
    this.t = opts.t ?? identityT;
  }

  repoUrl(project: { id: string; owner: string }): string {
    return `sftp:${this.user}@${this.host}:/backups/${project.owner}/${project.id}`;
  }

  verifyHostKey(observed: { fingerprint: string }): void {
    if (observed.fingerprint !== this.pinnedFingerprint) {
      throw HttpError.internal(
        this.t('security.error.hostKeyMismatch', {
          expected: this.pinnedFingerprint,
          observed: observed.fingerprint,
        }),
      );
    }
  }
}
