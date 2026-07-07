import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REDACT_PATHS } from '../../config/logger.js';

/**
 * STEP 5 preventive guards for threat surface #7 (Secrets & Data-at-Rest).
 *
 * Static checks over `server/src/**`. A future edit that either
 *   (a) reintroduces a plaintext secret field on a Mongoose schema without an
 *       explicit `// plaintext-safe: <reason>` annotation, OR
 *   (b) drops a redaction path from `config/logger.ts`, OR
 *   (c) puts a raw `console.log` inside the superadmin module, OR
 *   (d) drops a `.env` file into a subdirectory (`client/` or `server/`), OR
 *   (e) reintroduces `env.NODE_ENV === 'development' ... err.stack` in the
 *       error handler response, OR
 *   (f) reuses `env.MASTER_ENCRYPTION_KEY` verbatim as the self-backup restic
 *       password (S7-03)
 * fails loudly before the suite exercises the runtime.
 *
 * Cross-references:
 *   `prompts/dockstash-security/07-secrets-data-at-rest-opus-4.7.md`
 *   `.claude/rules/secrets-and-rotation.md`
 *   `docs/security-model.en.md` § "Secrets & data-at-rest"
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SERVER_SRC = path.resolve(HERE, '../..');
const REPO_ROOT = path.resolve(SERVER_SRC, '../..');
const MODULES_DIR = path.resolve(SERVER_SRC, 'modules');

function walk(dir: string, filter: (p: string) => boolean, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, filter, out);
    } else if (filter(full)) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// (a) plaintext-secret guard — every String schema field whose name matches
//     /password|secret|privatekey|apikey/i must be one of:
//
//       - an `encryptedSecretSchema` sub-doc (or the crypto envelope shape),
//       - a `hashedSecretSchema` sub-doc,
//       - annotated `// plaintext-safe: <reason>` on the preceding line,
//       - inside the crypto envelope schema itself (the fields OF the
//         envelope: `ciphertext`, `iv`, `authTag`, `keyVersion`) — matched by
//         the parent-declaration heuristic below.
// ---------------------------------------------------------------------------

const SECRET_NAME_RE =
  /^(password|passwordhash|passwd|secret|privatekey|apikey|apikeyhash|token|hash|repopassword|repopasswordenc|sshkey|sshkeyenc)$/i;

interface FieldHit {
  file: string;
  line: number;
  name: string;
  type: string;
}

function collectSchemaFields(src: string, file: string): FieldHit[] {
  const hits: FieldHit[] = [];
  const lines = src.split('\n');
  // Very small hand-parser: match `<name>: { type: <Type> ... }` or
  // `<name>: { type: <SubSchema>, ... }` at any indentation.
  const re = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*\{\s*type:\s*([A-Za-z_][A-Za-z0-9_]*)/;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    const m = re.exec(line);
    if (!m) continue;
    hits.push({ file, line: i + 1, name: m[1] ?? '', type: m[2] ?? '' });
  }
  return hits;
}

function isPlaintextSafeAnnotated(src: string, line: number): boolean {
  const lines = src.split('\n');
  // `line` is 1-indexed; array is 0-indexed. Look at up to 6 lines above
  // (multi-line comment blocks tolerated).
  const startIdx = Math.max(0, line - 7);
  const endIdx = line - 1;
  for (let i = startIdx; i < endIdx; i += 1) {
    if ((lines[i] ?? '').includes('plaintext-safe:')) return true;
  }
  return false;
}

describe('secrets-meta: no plaintext secret field on any Mongoose schema', () => {
  it('every secret-named String field is either an envelope, a hash, or plaintext-safe:', () => {
    const modelFiles = walk(MODULES_DIR, (p) => p.endsWith('.model.ts'));
    const offenders: string[] = [];
    for (const file of modelFiles) {
      const src = readFileSync(file, 'utf8');
      // Skip the envelope + hash schemas themselves — their `ciphertext`/`iv`/
      // `authTag`/`hash`/`keyVersion` fields are the envelope, not a plaintext
      // secret. The heuristic: the field lives inside a schema whose declared
      // name matches `encryptedSecretSchema` / `hashedSecretSchema`.
      for (const hit of collectSchemaFields(src, file)) {
        if (!SECRET_NAME_RE.test(hit.name)) continue;
        // The envelope IS the fix — accept its sub-doc reference.
        if (/^encryptedSecretSchema$|^hashedSecretSchema$/.test(hit.type)) continue;
        if (isPlaintextSafeAnnotated(src, hit.line)) continue;
        offenders.push(`${path.relative(SERVER_SRC, file)}:${hit.line} — ${hit.name}: ${hit.type}`);
      }
    }
    expect(offenders, `Plaintext-looking secret fields need envelope, hash, or // plaintext-safe: annotation:\n${offenders.join('\n')}`).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// (b) pino redaction allowlist — the paths list in `config/logger.ts` MUST
//     cover every required secret key. `REDACT_PATHS` is the exported source
//     of truth so a lint / edit can't diverge without breaking the test.
// ---------------------------------------------------------------------------

describe('secrets-meta: pino redaction covers the required secret-key allowlist', () => {
  const required = [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    '*.password',
    '*.token',
    '*.secret',
    '*.privateKey',
    '*.apiKeyHash',
    '*.repoPassword',
    'MASTER_ENCRYPTION_KEY',
    'SUPERADMIN_PASSWORD',
    'JWT_SECRET',
    'POLAR_ACCESS_TOKEN',
    'POLAR_WEBHOOK_SECRET',
  ];
  for (const key of required) {
    it(`redacts ${key}`, () => {
      expect(REDACT_PATHS).toContain(key);
    });
  }
});

// ---------------------------------------------------------------------------
// (c) no `console.log` inside the superadmin module — the seeder must use
//     the redacted pino logger. ESLint also enforces this at edit time; the
//     static test is belt-and-braces so a suppressed lint doesn't slip past
//     coverage.
// ---------------------------------------------------------------------------

describe('secrets-meta: no console.* in modules/superadmin/**', () => {
  it('every superadmin source file routes through the redacted logger', () => {
    const files = walk(
      path.resolve(MODULES_DIR, 'superadmin'),
      (p) => p.endsWith('.ts') && !p.endsWith('.test.ts'),
    );
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, `${path.relative(SERVER_SRC, file)} must NOT use console.*`).not.toMatch(
        /\bconsole\.(log|error|warn|info|debug)\b/,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// (d) no subdirectory `.env` files. Root `.env` is the single source of truth.
// ---------------------------------------------------------------------------

describe('secrets-meta: no `.env` under client/ or server/', () => {
  it('every subdirectory tree is .env-free', () => {
    for (const sub of ['client', 'server', 'agent']) {
      const root = path.resolve(REPO_ROOT, sub);
      let stubExists = false;
      try {
        stubExists = statSync(root).isDirectory();
      } catch {
        stubExists = false;
      }
      if (!stubExists) continue;
      const offenders = walk(root, (p) => {
        // Skip vendored node_modules trees.
        if (p.includes(`${path.sep}node_modules${path.sep}`)) return false;
        const base = path.basename(p);
        return base === '.env' || base === '.env.local' || base === '.env.production';
      });
      expect(
        offenders,
        `Subdirectory .env files are forbidden — consolidate to root .env:\n${offenders.join('\n')}`,
      ).toEqual([]);
    }
  });
});

// ---------------------------------------------------------------------------
// (e) errorHandler MUST NOT leak `err.stack` on the response (S7-04).
// ---------------------------------------------------------------------------

describe('secrets-meta: errorHandler never exposes err.stack in the response', () => {
  it('does not include a `stack:` key in the 500-branch JSON', () => {
    const src = readFileSync(
      path.resolve(SERVER_SRC, 'shared/middleware/error-handler.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/stack:\s*err\.stack/);
    // And the dev-only branch is gone — no `NODE_ENV === 'development'` gate
    // around a response-body payload.
    expect(src).not.toMatch(/NODE_ENV\s*===\s*'development'/);
  });
});

// ---------------------------------------------------------------------------
// (f) self-backup restic password is derived, not the master key verbatim
//     (S7-03).
// ---------------------------------------------------------------------------

describe('secrets-meta: self-backup restic password is derived, not the master key', () => {
  it('boot/recovery.ts derives via HMAC and never assigns MASTER_ENCRYPTION_KEY as password', () => {
    const src = readFileSync(path.resolve(SERVER_SRC, 'boot/recovery.ts'), 'utf8');
    expect(src).not.toMatch(/password:\s*env\.MASTER_ENCRYPTION_KEY/);
    expect(src).toMatch(/deriveSelfBackupPassword\(env\.MASTER_ENCRYPTION_KEY\)/);
  });
});
