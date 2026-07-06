# Surface #2 — Cross-Account / IDOR Isolation — Build Prompt

> **Closes findings under threat surface #2 of `prompts/SECURITY.md`.** Owns
> owner-scoped queries at load time across every module, nested-child IDOR
> (snapshot/schedule/drill/agent-job → project/agent → user), the
> existence-leak policy, and role-gate application. This is one of the two
> highest-value Dockstash surfaces (`SECURITY.md` § Notes for the operator).
> Implements STEP 2 → STEP 3 → STEP 4 → STEP 5 for this surface only.

---

## Agent

`security-review-specialist` (primary — fix + test + prevent). Coordinate with
`backend-dev` for the per-module query rewrites. Run `00-recon-findings` FIRST
and read its surface-#2 rows — the recon's `findById`/`findOne({_id})` grep
output IS the worklist.

## Mission

For every Critical/High finding under surface #2 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 realistic adversarial inputs per finding (a second user's id in
   the URL, a second agent's id, a nested child whose parent belongs to
   another owner).
2. Fix each unscoped load to be owner-scoped **at query time** —
   `Model.findOne({ _id, owner: req.user.id })` (or the equivalent nested
   join).
3. Add supertest cross-account tests: a second user gets 404/403 (per the
   module's convention, NEVER 200) on every touched resource; a second agent
   gets 401/404 on another agent's job.
4. Add a STEP 5 meta-guard: a repo-wide test that scans every product router
   for an owner-scope cross-account test.

## Operating Constraints

| Rule | Detail |
|---|---|
| Scope at query time | `Model.findOne({ _id, owner })` — NEVER `findById(id)` + a separate ownership `if`. The DB must reject the unowned row. |
| Nested ownership | A child (snapshot/schedule/restore-drill/agent-job) JOINs back to `owner` through its parent (project/agent). The parent is owner-scoped first; the child must additionally carry the parent's owner. Do not trust a child's `parentId` field alone — re-derive owner. |
| Existence-leak policy | Match the per-module convention. `requireRole` returns 403 for authenticated lower-privilege users (do NOT "fix" to 404). For OWNER-scoped resources prefer 404 on a non-owned existing id so existence isn't leaked. Flag inconsistency but do not invent a new convention. |
| Agent surface defer | `/api/agent` agent-job IDOR is the highest-value sub-surface but lives in surface #5 — fix the obvious owner-scope gaps here, defer the agent-specific composite-token + per-agent-scope logic to prompt `05`. Note the handoff in `findings.md`. |
| Money caps defer | Entitlement-cap enforcement (remaining==1 TOCTOU) is surface #3 — here we only fix the pure ownership leaks. |
| Docker-only | All build/test cmds in Docker. |
| i18n 7 locales | Any new error (e.g. a "not found" re-cast) is a key in ALL 7 dictionaries. |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#2 rows. Read
  `prompts/SECURITY.md` § "2. CROSS-ACCOUNT / IDOR ISOLATION".
- 0.2 Read `shared/middleware/{require-auth,require-role}.ts`. Read every
  module router: `modules/{backups,scheduler,recovery,agents,alerting,audit,
  settings,billing,legal,users,health,superadmin}/*.routes.ts`.
- 0.3 For each module, list every controller handler that loads a resource by
  id from `req.params`/`req.body`. The recon grep already produced this list —
  use it.
- 0.4 Confirm the existence-leak convention per module by reading 2–3
  existing handlers in that module (do they 403 or 404 on a non-owned id?).

### Phase 1 — Adversarial inputs (STEP 2)
For each finding, write ≥5 inputs into fixtures:
- A second user's `userId` in the JWT, the victim's `projectId` in the URL —
  assert 404/403 today (finding), correct status after fix.
- A nested child id (`snapshotId`, `scheduleId`, `restoreDrillId`,
  `agentJobId`) whose parent project/agent belongs to another owner.
- An `id` that does not exist at all — assert 404 (existence-leak baseline).
- An `id` that is not a valid ObjectId — assert 400 (zod/cast), never a 500.
- For audit-log / settings / billing: a request that tries to read another
  tenant's record by guessing the id.

### Phase 2 — Fix (STEP 3)
For every unscoped load:
- 2.1 Convert `Model.findById(req.params.id)` followed by an ownership `if` →
  `Model.findOne({ _id: req.params.id, owner: req.user.id })`. Return the
  module-convention status (404 if existence-cloaking, 403 if `requireRole`-
  style) when the row is absent.
- 2.2 For nested children: load the parent owner-scoped first
  (`Project.findOne({ _id: parentId, owner: req.user.id })`), then load the
  child with `{ _id: childId, project: parent._id }` (or the equivalent
  relation). Do NOT trust `child.parentId` from the URL without re-deriving.
- 2.3 For `audit` log reads: scope by `owner: req.user.id` on the log record
  (or the project's owner). Never expose another tenant's audit trail.
- 2.4 For `superadmin` console sub-routers: confirm `requireRole(
  ROLE_SUPERADMIN)` is APPLIED in the chain (not just exported) on every sub-
  route. A superadmin listing users/projects must NOT cross-tenant-leak to a
  non-superadmin even if a route is mis-mounted.
- 2.5 For `legal` export/delete: confirm owner-scoped (cannot exfiltrate
  another tenant's data via the GDPR export). Defer the grace-window purge
  logic to surface #8.
- 2.6 Cast/validate every id (`isValidObjectId`) before the query — invalid
  ids return 400, never a Mongoose 500 (overlaps surface #8; fix here if the
  unscoped handler is the one throwing).

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server):
- **Cross-account matrix**: for EVERY touched resource, seed two users + two
  rows; user A's JWT requesting user B's resource → 404 (or 403 per
  convention), NEVER 200. State per-test which fails before the fix.
- **Nested-child IDOR**: seed owner A → project → snapshot; owner B requests
  the snapshot by id → 404. Seed owner B → project → snapshot with a GUESSED
  id shape → 404. Confirm owner B cannot reach owner A's snapshot by tampering
  `parentId` either.
- **Agent-job IDOR** (smoke; full coverage in `05`): a second agent's token
  requesting another agent's job → 401/404.
- **Existence-leak baseline**: a non-existent id with a valid JWT → 404 (same
  body as a non-owned existing id, if the module cloaks existence).
- **Invalid id**: a non-ObjectId id → 400, never 500.
- **Superadmin isolation**: a non-superadmin JWT hitting `/api/superadmin/*`
  → 403; a superadmin JWT sees only superadmin-scoped data (no accidental
  cross-tenant leak in sub-routers).

### Phase 4 — Prevent (STEP 5)
- a) **Repo-wide meta-test** (`server/src/__tests__/security-meta.test.ts` or
  extend the existing one): for every `.routes.ts` under `modules/`, assert
  there EXISTS a cross-account test (a test file that seeds two owners and
  asserts the second gets a non-200). List the routers lacking one and FAIL.
  This is the durable guard — a new module without a cross-account test
  breaks CI.
- b) **ESLint `no-restricted-syntax`**: ban `Model.findById(req.params` and
  `findOne({ _id: req.params` in `modules/**/*.controller.ts` (owner scope
  must go through a `findOne({ _id, owner })` helper). Allow an explicit
  `// idor-safe: parent-scoped` escape hatch with a justification comment,
  audited in code review.
- c) If warranted, add `.claude/rules/owner-scoped-queries.md` (MANDATORY
  REQUIREMENT header, Correct/Forbidden examples, Validation Checklist) and a
  one-line entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5 if
  load-bearing.

## i18n

Any re-cast error ("not found" vs "forbidden" to match the module convention)
uses an existing key where possible. New keys land in ALL 7 server
dictionaries. No user-facing string change is made without locale parity.

## Documentation

- `docs/security-model.en.md` — annotate the owner-scope-at-query-time rule,
  the nested-child join pattern, and the existence-leak policy per module.
- `CLAUDE.md` §5 — reference the new rule file if added.
- No `.env.example` change expected for this surface.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `backend-dev` (per-
  module query rewrites).
- **Skills:** `/security-review` `api` mode (deep semantic pass —
  **required** before merge); `vitest-unit-testing` (the cross-account matrix
  is heavy); `code-review` (final diff pass — assert no `findById(req.params`
  remains in a controller, no nested-child load trusts `parentId` from the URL
  alone).

## Idempotency Contract

Re-running MUST NOT: re-scope an already-owner-scoped query (detect
`findOne({ _id, owner })` and skip), add a second cross-account test for the
same router (detect and skip), re-declare the meta-test/ESLint rule, or
re-write the rule file. Detect existing controls and reconcile in place. A
re-run that finds the surface clean appends "re-verified YYYY-MM-DD — surface
#2 clean" to `findings.md` and exits. Findings fixed here are annotated in
`findings.md` with `— FIXED at file:line (prompt 02)` so `09` can produce the
final report without re-reading every module.
