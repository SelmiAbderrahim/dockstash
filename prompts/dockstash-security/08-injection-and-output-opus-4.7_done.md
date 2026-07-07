# Surface #8 — Injection & Output — Build Prompt

> **Closes findings under threat surface #8 of `prompts/SECURITY.md`.** Owns
> the no-Mongo-operator-injection discipline (cast every id, never spread
> `req.query` into a filter), the superadmin tenant-isolation-in-output
> guarantee, the data-rights (legal module) owner-scope + grace-window purge,
> and the i18n-keys-only error-output rule (no stack/secret leakage through
> the error handler). Implements STEP 2 → STEP 3 → STEP 4 → STEP 5 for this
> surface only.

---

## Agent

`security-review-specialist` (primary). Coordinate with `backend-dev` for the
per-module query fixes and the error-handler tightening. Run `00-recon-
findings` FIRST and read its surface-#8 rows. Cross-link with prompt `02`
(owner-scope overlap) and prompt `07` (log/secret-leak overlap).

## Mission

For every Critical/High finding under surface #8 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 adversarial inputs per finding: a `{$gt:''}` operator, a `$where`,
   a `$regex` DoS payload, an invalid id (not ObjectId), a superadmin
   endpoint hit by a non-superadmin.
2. Fix: cast/validate every id (`isValidObjectId`); never spread `req.query`/
  `req.body` into a Mongoose filter; superadmin sub-routers all inherit
  `requireRole(ROLE_SUPERADMIN)`; data-rights flows are owner-scoped with a
  grace-window purge; error handler returns i18n keys only.
3. Add supertest tests: operator injection → 400/cast (no data leak); invalid
   id → 400; non-superadmin → 403; data-rights export owner-scoped; error
   response has no stack/secret.
4. Add a STEP 5 meta-guard: "no Mongoose `.find(`/`.findOne(` call spreads
  `req.query`/`req.body`" + "every superadmin sub-router inherits the role
  gate".

## Operating Constraints

| Rule | Detail |
|---|---|
| No operator injection | Never build a Mongoose query from unsanitized `req.body`/`req.query`. Cast every id (`isValidObjectId`); use the zod-parsed, typed value, never a spread. Reject `{$…}` keys at the schema boundary. |
| No `$where` / `$regex` DoS | Flag any user-controlled `$where`/`$regex`/`$expr` reaching a query; prefer typed field matchers. |
| Superadmin isolation | `/api/superadmin` is gated by `requireRole(ROLE_SUPERADMIN)` in `app.ts`; every sub-route inherits it (the mount-level gate, not a per-handler hope). Superadmin output must not leak other tenants' data beyond what the console is documented to show. |
| Data-rights | `legal` export/delete is owner-scoped (cannot exfiltrate another tenant). Deletion schedules a purge after the grace window (`docs/data-rights.en.md`) — never a synchronous hard purge. A `legalHold` flag beats retention/purge. |
| Error output | Error messages reaching the client are i18n keys (resolved per `Accept-Language`), not raw exception text. No stack trace, no secret, no internal path in a 4xx/5xx body. The error handler does NOT log secrets (overlaps surface #7). |
| Existence-leak | Match the per-module convention (surface #2 owns the policy; here we only ensure the error output is uniform). |
| Docker-only | All build/test cmds in Docker. |
| i18n 7 locales | Every new/changed error key is present in ALL 7 server dictionaries + client locale files where rendered. Parity test green. |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#8 rows. Read
  `prompts/SECURITY.md` § "8. INJECTION & OUTPUT".
- 0.2 Grep for `.find(req.` / `.findOne(req.` / `...req.query` / `...req.body`
  across `server/src/modules/**`. The recon produced the suspect list.
- 0.3 Read `shared/middleware/error-handler.ts` and `shared/utils/http-error.ts`.
  Confirm the handler returns i18n keys + localized message, never `err.stack`
  /`err.message` raw.
- 0.4 Read `modules/superadmin/` — every sub-router; confirm the mount-level
  `requireRole(ROLE_SUPERADMIN)`.
- 0.5 Read `modules/legal/` — export + delete-account flows; confirm owner
  scope + grace-window purge + legalHold.

### Phase 1 — Adversarial inputs (STEP 2)
For each finding, write ≥5 inputs:
- A query string `?field[$gt]=` / `?field[$regex]=.*.*.*` / `?field[$where]=…`
  reaching a `.find(` built from `req.query` — assert it returns more rows
  than intended today (finding), 400/cast after fix.
- An invalid id `?id=zzz` (not ObjectId) — assert 500 today (finding), 400
  after fix.
- A non-superadmin JWT hitting `/api/superadmin/users` — assert 403 today
  (correct) OR 200 today (finding — sub-router missing the gate) → 403 after
  fix.
- A data-rights export (`POST /api/legal/export`) with a tampered `userId` in
  the body — assert it returns another tenant's data today (finding), only
  the caller's data after fix.
- A delete-account request that should respect `legalHold` — assert it purges
  immediately today (finding), respects the hold + grace window after fix.
- A request triggering a 500 — assert the response body contains a
  stack/internal path today (finding), only an i18n key + correlation id
  after fix.

### Phase 2 — Fix (STEP 3)
- 2.1 **No operator injection**: replace every `.find(req.query)` / spread of
  `req.query`/`req.body` into a filter with an explicit, typed object built
  from zod-parsed values. Strip/reject any key starting with `$` at the schema
  boundary (`z.object(...).strict()` rejects unknown keys). Cast every id
  with `isValidObjectId` → 400 on invalid.
- 2.2 **No `$where`/`$regex` DoS**: remove any user-controlled `$where`/
  `$regex`/`$expr`; replace with a typed matcher (e.g. a guarded
  `escapeRegExp` + anchored match, or a trigram index). If a regex search is
  genuinely needed, document the DoS mitigation (length cap + timeout) inline.
- 2.3 **Superadmin isolation**: confirm `app.ts` mounts `/api/superadmin`
  behind `requireRole(ROLE_SUPERADMIN)` AT THE ROUTER LEVEL. Any sub-router
  that bypasses the mount (e.g. a router mounted before the gate) is moved
  under the gated mount. Add a meta-test asserting the mount.
- 2.4 **Data-rights**: `legal` export is owner-scoped (`userId: req.user.id`)
  and never trusts a body `userId`. Deletion marks the account + schedules a
  purge after the env-configured grace window (a serialized BullMQ job, NOT a
  synchronous hard purge) + sends the final warning email (Resend). A
  `legalHold` flag (joint with surface #7 / the threat-model doc) makes the
  purge skip held projects. Confirm the grace window is env-configured
  (`DATA_DELETION_GRACE_HOURS`) in `config/env.ts` + `.env.example`.
- 2.5 **Error output i18n-only**: the error handler returns
  `{ error: { code, message: t(key, vars, lang), correlationId } }` — never
  `err.stack`, never `err.message` raw, never an internal file path. In
  `NODE_ENV !== 'production'` a redacted dev detail MAY be included behind a
  flag, but never a secret. Audit thrown errors across modules: anything
  thrown as `new Error('raw text')` reaching the handler becomes an
  `HttpError.badRequest(…)` (or the matching status) with an i18n key.
- 2.6 **No secret in error/log**: confirm the error handler + any
  `error-handler`-adjacent logger does NOT emit the request body/headers
  when an error occurs (overlaps surface #7's pino redaction — confirm
  jointly).

### Phase 2 — Reference fix shapes (illustrative — match the repo's real types)

```ts
// strict zod rejects operator-injection keys ($gt, $where, $regex) at the boundary
const listSchema = z.object({
  status: z.enum(['active', 'archived']).optional(),
  page: z.coerce.number().int().min(1).default(1),
}).strict();                                             // unknown / `$`-prefixed keys → 400

const q = listSchema.parse(req.query);                  // typed values — NEVER spread req.query
if (req.params.id && !isValidObjectId(req.params.id)) throw HttpError.badRequest('errors.invalidId');
const rows = await Project.find({
  owner: req.user.id,                                    // always owner-scoped
  ...(q.status ? { status: q.status } : {}),            // explicit typed fields only
});

// error-handler.ts — i18n key + correlation id ONLY; never err.stack / err.message raw
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const status = err instanceof HttpError ? err.status : 500;
  const key = err instanceof HttpError ? err.i18nKey : 'errors.internal';
  logger.error({ err, correlationId: req.id }, 'request failed');   // full detail to logs (redacted), not the client
  res.status(status).json({ error: { code: key, message: req.t(key), correlationId: req.id } });
}
```

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server):
- **Operator injection**: a `GET` with `?role[$gt]=` / `?email[$regex]=…`
  against a vulnerable route → 400 (or the cast value), and the response does
  NOT contain more rows than the plain query. State fail-before status.
- **Invalid id**: `?id=zzz` → 400, never 500.
- **Strict-schema reject**: a body with an unknown `$set`/`$inc` key → 400
  (zod `.strict()`).
- **Superadmin isolation**: a non-superadmin JWT → 403 on every
  `/api/superadmin/*` sub-route (parametrize across the sub-routers). A
  superadmin JWT sees only the documented console data.
- **Data-rights owner scope**: a `POST /api/legal/export` with a tampered
  body `userId` returns only the caller's data; a cross-tenant export
  attempt → only the caller's rows (never the victim's).
- **Grace-window purge**: `POST /api/legal/delete-account` marks the account
  + enqueues a purge job `DATA_DELETION_GRACE_HOURS` in the future + sends
  the warning email (assert via mocked send) — NOT a synchronous purge. A
  `legalHold` project's purge is skipped.
- **Error output**: a triggered 500 → the body is `{ error: { code,
  message: <localized>, correlationId } }`; assert NO `stack`, NO raw
  `message` from the thrown `Error`, NO internal path, NO secret. A 400 from
  a thrown `new Error('…')` (regression) becomes an `HttpError.badRequest`
  with an i18n key.

### Phase 4 — Prevent (STEP 5)
- a) **Meta-test**: "no `.find(`/`.findOne(`/`.updateOne(` call in
  `server/src/modules/**` spreads `req.query` or `req.body` directly". A
  scan (regex/AST) over the controllers; FAIL on regression.
- b) **Meta-test**: "every route mounted under `/api/superadmin` in `app.ts`
  is behind `requireRole(ROLE_SUPERADMIN)`". A static scan of `createApp`.
- c) **ESLint `no-restricted-syntax`**: ban `MemberExpression[object.name='
  req'][property.name='query']` appearing inside a `CallExpression` whose
  callee is `.find`/`.findOne`/`.where` (best-effort; the meta-test is the
  strong guard).
- d) **Meta-test**: "the error handler returns an i18n key, not
  `err.message`/`err.stack`". A scan of `error-handler.ts` (and any
  per-module catch) asserting the response shape.
- e) **i18n parity test** (existing — keep green): every error key the error
  handler can emit exists in ALL 7 server dictionaries.
- f) Add `.claude/rules/no-query-injection-and-i18n-errors.md` (MANDATORY
  REQUIREMENT header, Correct/Forbidden examples, Validation Checklist) and
  a one-line entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5.
  Cross-reference `docs/data-rights.en.md` + `docs/security-model.en.md`.

## Coverage & Success Gate — NON-NEGOTIABLE

This surface is DONE only when, **inside Docker**, the suite is 100% passing and
v8 coverage is **100% on lines / branches / functions / statements** for the code
this prompt touched:

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run --coverage
```

Hard requirements:
- Every fix ships a test that FAILS before the change and PASSES after — stated per test.
- Cover both error-handler branches (`HttpError` → mapped status/key; unknown → 500/internal),
  the strict-zod reject (`$`-key → 400), the invalid-ObjectId reject (→ 400, never 500), and
  the superadmin gate on every sub-route. Assert the 500 body carries NO stack / path / secret.
- No `.skip`/`.only`, no lowered `vitest.config.ts` thresholds, no `/* c8 ignore */`,
  no `eslint-disable`, no `@ts-ignore` to reach green (`docs/ci-gates.en.md`).
- If a line is genuinely unreachable, delete/refactor it — never ignore it.
- The 7-locale i18n parity test stays green (every new key in en/ar/fr/de/es/ru/zh).
- Re-run until green AND 100%. A red or sub-100% run is not "almost done" — it is not done.

## i18n

Every new/changed error key lands in ALL 7 server dictionaries (`en, ar, fr,
de, es, ru, zh`) + client locale files where rendered. The error handler
resolves the key per `Accept-Language`. Parity test green. RTL for `ar`.

## Documentation

- `docs/data-rights.en.md` — annotate the owner-scoped export, the grace-
  window purge (`DATA_DELETION_GRACE_HOURS`), the final warning email, and
  the `legalHold` beats-purge rule.
- `docs/security-model.en.md` — annotate no-operator-injection (strict zod +
  cast ids), superadmin mount-level isolation, and i18n-keys-only error
  output.
- `.env.example` — document `DATA_DELETION_GRACE_HOURS` (root only).
- `CLAUDE.md` §5 — reference the new rule file.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `backend-dev` (per-
  module query fixes + error-handler tightening).
- **Skills:** `/security-review` `api` mode (deep semantic pass — **required**
  before merge); `backend-i18n` (7-locale error-key parity); `code-review`
  (final diff pass — assert no `.find(req.query)`, no `$where` from user
  input, every `/api/superadmin` sub-router behind the role gate, error body
  shape uniform).

## Idempotency Contract

Re-running MUST NOT: re-tighten an already-strict zod schema (detect
`.strict()` and skip), re-cast an already-cast id, re-mount the superadmin
gate if present, re-add the grace-window purge if scheduled, re-tighten the
error handler if it already returns i18n keys, or duplicate the meta-tests /
ESLint rule. Detect existing controls and reconcile in place. A re-run that
finds the surface clean appends "re-verified YYYY-MM-DD — surface #8 clean"
to `findings.md`. Findings fixed here are annotated with `— FIXED at
file:line (prompt 08)` for `09`'s report.
