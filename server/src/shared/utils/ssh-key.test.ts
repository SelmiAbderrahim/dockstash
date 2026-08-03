import { describe, expect, it } from 'vitest';
import { normalizePrivateKey } from './ssh-key.js';

describe('normalizePrivateKey', () => {
  it('adds a trailing newline when missing', () => {
    expect(normalizePrivateKey('-----BEGIN-----\nbody\n-----END-----')).toBe(
      '-----BEGIN-----\nbody\n-----END-----\n',
    );
  });

  it('converts CRLF line endings to LF', () => {
    expect(normalizePrivateKey('line1\r\nline2\r\n')).toBe('line1\nline2\n');
  });

  it('converts lone CR line endings to LF', () => {
    expect(normalizePrivateKey('line1\rline2')).toBe('line1\nline2\n');
  });

  it('collapses surrounding blank lines to one trailing newline', () => {
    expect(normalizePrivateKey('\n\n  key body  \n\n\n')).toBe('key body\n');
  });

  it('leaves an already-normalized key unchanged', () => {
    const key = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----\n';
    expect(normalizePrivateKey(key)).toBe(key);
  });
});
