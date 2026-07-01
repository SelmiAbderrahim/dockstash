import { describe, expect, it, vi } from 'vitest';

/**
 * These three branches in recovery.import.ts are defensive and structurally
 * unreachable through the real `.strict()` zod schema + real crypto:
 *   - line 60: the `?? 'invalid envelope'` fallback (a parse error always has
 *     at least one issue with a message).
 *   - lines 67-71: `plaintextGuard` returning a hit (a parsed strict envelope
 *     can never contain a banned key).
 *   - line 136: the `String(err)` arm (decryptSecret always throws an Error).
 *
 * We drive them by mocking the two collaborators for this file only.
 */
const ctl = vi.hoisted(() => ({
  forceParseFail: false,
  forcePlaintextHit: false,
  forceDecryptNonError: false,
}));

vi.mock('./recovery.schema.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./recovery.schema.js')>();
  return {
    ...actual,
    importEnvelopeSchema: {
      safeParse: (raw: unknown) =>
        ctl.forceParseFail
          ? { success: false as const, error: { issues: [] } }
          : actual.importEnvelopeSchema.safeParse(raw),
    },
    plaintextGuard: (input: unknown, path?: string) =>
      ctl.forcePlaintextHit ? '$.forced.password' : actual.plaintextGuard(input, path),
  };
});

vi.mock('../../shared/crypto/index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../shared/crypto/index.js')>();
  return {
    ...actual,
    decryptSecret: (secret: Parameters<typeof actual.decryptSecret>[0]) => {
      if (ctl.forceDecryptNonError) throw 'non-error-thrown';
      return actual.decryptSecret(secret);
    },
  };
});

const { importEnvelope } = await import('./recovery.import.js');
const { encryptSecret } = await import('../../shared/crypto/index.js');

describe('recovery import: defensive branches', () => {
  it('safeParse failure with no issues → generic "invalid envelope" fallback', async () => {
    ctl.forceParseFail = true;
    try {
      await expect(importEnvelope('u', {})).rejects.toMatchObject({ status: 400 });
    } finally {
      ctl.forceParseFail = false;
    }
  });

  it('plaintextGuard hit → 400 plaintext-forbidden', async () => {
    ctl.forcePlaintextHit = true;
    try {
      const envelope = {
        version: 1,
        exportedAt: new Date().toISOString(),
        keyVersion: 1,
        projects: [],
      };
      await expect(importEnvelope('u', envelope)).rejects.toMatchObject({ status: 400 });
    } finally {
      ctl.forcePlaintextHit = false;
    }
  });

  it('non-Error thrown by decryptSecret → keyVersion-mismatch arm', async () => {
    ctl.forceDecryptNonError = true;
    try {
      const envelope = {
        version: 1,
        exportedAt: new Date().toISOString(),
        keyVersion: 1,
        projects: [
          {
            id: '507f1f77bcf86cd799439011',
            name: 'p',
            path: '/var/www/p',
            plan: { paths: ['/var/www/p'], databases: [], configs: [] },
            repoPasswordEnc: encryptSecret('pw-42'),
          },
        ],
      };
      await expect(importEnvelope('u', envelope)).rejects.toMatchObject({ status: 400 });
    } finally {
      ctl.forceDecryptNonError = false;
    }
  });
});
