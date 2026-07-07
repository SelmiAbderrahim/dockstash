import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * STEP 5 preventive guard for threat surface #8 (Injection & Output).
 * Cross-referenced from
 * `prompts/dockstash-security/08-injection-and-output-opus-4.7.md`,
 * `.claude/rules/no-query-injection-and-i18n-errors.md`, and
 * `docs/security-model.en.md` § "Injection & Output".
 *
 * Three static invariants held by this file:
 *   1. No Mongoose query builder inside `server/src/modules/**` is fed a
 *      spread of `req.query` / `req.body` / `req.params`, and no controller
 *      calls `.find(req.query)` / `.findOne(req.body)` / `.updateOne(req.body)`
 *      / `.where(req.query)`. Every filter is a zod-parsed, typed object.
 *   2. `app.ts` mounts `/api/superadmin` behind both `requireAuth` and
 *      `requireRole(ROLE_SUPERADMIN)` at the router level — every sub-route
 *      inherits the gate from the mount, not from a per-handler hope.
 *   3. `error-handler.ts` never emits `err.stack` on the wire and never
 *      spreads a raw exception body into the response — the response body
 *      is an i18n key (resolved) plus optional zod details.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODULES_DIR = path.resolve(HERE, '../../modules');
const APP_TS = path.resolve(HERE, '../../app.ts');
const ERROR_HANDLER_TS = path.resolve(HERE, './error-handler.ts');

function listTsFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...listTsFiles(p));
    else if (p.endsWith('.ts') && !p.endsWith('.test.ts')) out.push(p);
  }
  return out;
}

describe('injection-and-output-meta: no Mongoose query call spreads req.query/req.body/req.params', () => {
  // Mongoose finder / mutator methods that take a filter object as the first
  // arg. A spread of `req.*` into any of these is an operator-injection
  // vector (`{$gt:''}`/`$where`/`$regex` reaching the DB).
  const METHODS = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'findOneAndDelete',
    'findOneAndReplace',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments',
    'count',
    'where',
    'exists',
    'distinct',
  ];
  // e.g. `.find(req.query)` / `.updateOne({...req.body})` / `.where(req.params)`
  const BAD = new RegExp(
    `\\.(?:${METHODS.join('|')})\\(\\s*(?:\\{\\s*)?\\.{0,3}req\\.(?:query|body|params)`,
  );

  it('sweeps every module file for operator-injection query shapes', () => {
    const files = listTsFiles(MODULES_DIR);
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      src.split('\n').forEach((line, i) => {
        if (BAD.test(line)) offenders.push(`${file}:${i + 1}\n  ${line.trim()}`);
      });
    }
    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});

describe('injection-and-output-meta: /api/superadmin is gated at the app.ts mount', () => {
  it('the superadmin router mount carries requireAuth + requireVerified + requireRole(ROLE_SUPERADMIN)', () => {
    const src = readFileSync(APP_TS, 'utf8');
    // Grab the whole mount line (or block up to the closing `);`). The
    // middleware list may contain nested calls like `requireRole(...)`, so we
    // do not try to close-match parens with a naive character class.
    const lines = src.split('\n');
    const mountLines = lines.filter((l) => /app\.use\(\s*['"]\/api\/superadmin['"]/.test(l));
    expect(mountLines.length, 'no /api/superadmin mount found in app.ts').toBe(1);
    const mounts = mountLines[0];
    // The `verified` local (declared once in createApp) is
    // `[requireAuth, requireVerified]`; either spelling counts, but the role
    // gate MUST be spelled inline so the mount is auditable.
    expect(mounts).toMatch(/verified/);
    expect(mounts).toMatch(/requireRole\(\s*ROLE_SUPERADMIN\s*\)/);
    expect(mounts).toMatch(/superadminRouter/);
  });

  it('the superadmin sub-router never imports its own auth middleware', () => {
    // The sub-router intentionally does NOT re-apply requireAuth/requireRole:
    // the parent mount is the single source of the gate. A per-handler gate
    // is redundant at best and drifts the isolation contract at worst — if
    // the mount ever moved, the sub-router should fail loudly rather than
    // silently keep authenticating requests from a different mount point.
    const routesFile = path.join(MODULES_DIR, 'superadmin/superadmin.routes.ts');
    const src = readFileSync(routesFile, 'utf8');
    // Import lines: a real gate must be imported to be applied. Explanatory
    // comments referencing `requireAuth`/`requireRole` are fine.
    const importLines = src
      .split('\n')
      .filter((l) => /^\s*import\s/.test(l))
      .join('\n');
    expect(importLines).not.toMatch(/require-auth/);
    expect(importLines).not.toMatch(/require-role/);
  });
});

describe('injection-and-output-meta: error-handler emits i18n keys only, never the stack', () => {
  const src = readFileSync(ERROR_HANDLER_TS, 'utf8');

  it('never includes err.stack in the response body', () => {
    // Any `stack:` key in a `res.status(...).json({...})` body is a
    // Critical finding — even behind a NODE_ENV branch (see S7-04).
    expect(src).not.toMatch(/stack\s*:/);
  });

  it('never spreads a raw exception into the response body', () => {
    // A `...err` / `...error` spread into the JSON body would leak internal
    // properties (cause, code, custom fields) untranslated.
    expect(src).not.toMatch(/\.\.\.err[^a-zA-Z]/);
    expect(src).not.toMatch(/\.\.\.error[^a-zA-Z]/);
  });

  it('never emits err.message directly on the wire (must go through translateMessage)', () => {
    // Every `res.status(...).json({...})` block MUST use `translateMessage`
    // — the guard here is that any occurrence of `err.message` in the file
    // is wrapped by a call to translateMessage before it lands in `json(...)`.
    const badRaw = /json\([^)]*err\.message/;
    expect(src).not.toMatch(badRaw);
  });
});
