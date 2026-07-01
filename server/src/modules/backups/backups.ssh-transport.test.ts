import { describe, expect, it } from 'vitest';
import { PinnedSshTransport } from './backups.ssh-transport.js';
import { HttpError } from '../../shared/utils/http-error.js';

const PIN = 'sha256:AAAAB3NzaC1yc2EAAAADAQABAAAB';

describe('PinnedSshTransport', () => {
  it('constructs a project-scoped sftp URL', () => {
    const t = new PinnedSshTransport({ host: 'storage.example.com', user: 'backup', pinnedFingerprint: PIN });
    expect(t.repoUrl({ id: 'p1', owner: 'u1' })).toBe('sftp:backup@storage.example.com:/backups/u1/p1');
  });

  it('rejects a malformed fingerprint at construction', () => {
    expect(() => new PinnedSshTransport({ host: 'h', user: 'u', pinnedFingerprint: 'plain-string' }))
      .toThrow(HttpError);
  });

  it('verifyHostKey accepts a matching pin', () => {
    const t = new PinnedSshTransport({ host: 'h', user: 'u', pinnedFingerprint: PIN });
    expect(() => t.verifyHostKey({ fingerprint: PIN })).not.toThrow();
  });

  it('verifyHostKey rejects on mismatch (no auto-accept)', () => {
    const t = new PinnedSshTransport({ host: 'h', user: 'u', pinnedFingerprint: PIN });
    let caught: unknown = null;
    try {
      t.verifyHostKey({ fingerprint: 'sha256:DIFFERENT' });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(HttpError);
    expect((caught as HttpError).status).toBe(500);
  });
});
