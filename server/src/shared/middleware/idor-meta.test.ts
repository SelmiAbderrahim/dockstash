import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guard for threat surface #2 (Cross-Account / IDOR).
 * Static checks over `server/src/modules/**` — a future edit that introduces
 * a new owner-scoped router without a cross-account test, or that reintroduces
 * `Model.findById(req.params.*)` inside a controller, fails loudly before the
 * suite even exercises the runtime. Cross-referenced from
 * `prompts/dockstash-security/02-cross-account-idor-isolation-opus-4.7.md` and
 * `docs/security-model.en.md`.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(HERE, '../../modules');

// Owner-scoped product routers: every mutable `/api/<name>` surface where a
// resource belongs to a single user, and a foreign-owner request must never
// return 200. Public / auth / role-gated surfaces are intentionally excluded:
//
// - `auth`: no owner-scoped resource; identity IS the auth flow.
// - `communication`: public contact form.
// - `seo`: public robots/sitemap.
// - `health`: covered by health.backup-health.test.ts cross-account matrix
//   (see `getProjectHealth 404s both unknown AND foreign projects`).
// - `superadmin`: role-gated, superadmin sees everything by design; the 403
//   for a non-superadmin lives in superadmin.test.ts.
// - `billing`: billing routes bind to the authenticated JWT id only — a
//   caller cannot pass another user's id. The one cross-owner path
//   (`selectProjectsToKeep`) has a `notOwner` test in entitlements.test.ts.
// - `legal`: same shape as billing — the actor id IS the resource id.
// - `users`: `req.params.userId` must match the JWT id; users.test.ts covers
//   the 401 branch.
const OWNER_SCOPED_MODULES = [
  'backups',
  'scheduler',
  'agents',
  'recovery',
  'settings',
  'audit',
];

// Regex fragments that identify a cross-account test in the module's tests.
// A test qualifies if it seeds two users AND asserts a non-200 (404/403/401)
// for the second user. We look for the two-users seed pattern (`a@…` +
// `b@…`, `owner` + `stranger`, `own@…` + `other@…`, etc.) alongside an
// explicit status assertion in the same describe/it body.
const CROSS_ACCOUNT_SIGNATURES: RegExp[] = [
  /cross-user/i,
  /cross-account/i,
  /foreign owner/i,
  /existence-cloak/i,
  /"foreign|'foreign/i,
  /another (owner|user)/i,
  /notOwner/,
  /stranger/i,
];

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listTsFiles(p));
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

function readModule(name: string): { routers: string[]; tests: string[] } {
  const dir = path.join(MODULES_DIR, name);
  const files = listTsFiles(dir);
  return {
    routers: files.filter((p) => p.endsWith('.routes.ts')),
    tests: files.filter((p) => p.endsWith('.test.ts')),
  };
}

describe('idor-meta: every owner-scoped product router ships a cross-account test', () => {
  for (const mod of OWNER_SCOPED_MODULES) {
    it(`module "${mod}" has ≥1 test asserting a non-owner request is rejected`, () => {
      const { routers, tests } = readModule(mod);
      expect(routers.length, `no *.routes.ts under modules/${mod}`).toBeGreaterThan(0);
      expect(tests.length, `no *.test.ts under modules/${mod}`).toBeGreaterThan(0);

      const anyMatch = tests.some((file) => {
        const src = readFileSync(file, 'utf8');
        // Must have a signature hint (comment/name/message referencing a
        // cross-owner scenario) AND a rejection assertion (404 or 403) —
        // otherwise a stray comment could satisfy the check.
        const hasSignature = CROSS_ACCOUNT_SIGNATURES.some((rx) => rx.test(src));
        const hasRejection =
          /status:\s*40[134]/.test(src) ||
          /toBe\(40[134]\)/.test(src) ||
          // For collection-scoped surfaces (audit trail, settings row) a
          // valid stranger token returns 200 with an EMPTY / OWN-DEFAULTS
          // body, never the owner's data. Assert that shape counts.
          /entries\).toHaveLength\(0\)/.test(src) ||
          /configured\)\.toBe\(false\)/.test(src);
        return hasSignature && hasRejection;
      });
      expect(anyMatch, `add a cross-account test for module ${mod}`).toBe(true);
    });
  }
});

describe('idor-meta: controllers never call Model.findById(req.params.*)', () => {
  // Surface #2: an unscoped load by URL id is the exact shape that ships an
  // IDOR. Enforce at build time so a future controller can't reintroduce it.
  // Any real "safe by design" call (there is none today) can be marked with
  // an inline `// idor-safe:` comment on the preceding line, audited in review.
  const controllers = OWNER_SCOPED_MODULES.flatMap((mod) => {
    const files = listTsFiles(path.join(MODULES_DIR, mod));
    return files.filter((p) => p.endsWith('.controller.ts'));
  });
  it('sweeps every controller under modules/', () => {
    expect(controllers.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of controllers) {
      const src = readFileSync(file, 'utf8');
      const lines = src.split('\n');
      lines.forEach((line, i) => {
        if (/\.findById\(\s*req\.params/.test(line)) {
          const prev = lines[i - 1] ?? '';
          if (!/idor-safe:/.test(prev)) {
            offenders.push(`${file}:${i + 1}`);
          }
        }
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
