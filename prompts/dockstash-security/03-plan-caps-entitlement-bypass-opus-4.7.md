# Surface #3 — Plan Caps / Entitlement Bypass (Tier Gating) — Build Prompt

> **Closes findings under threat surface #3 of `prompts/SECURITY.md`.** Owns
> the parse→own→assert→reserve→enqueue ordering for every gated create/enable,
> the TOCTOU window at the cap boundary (two concurrent requests at
> `remaining==1`), tier-source discipline (no ad-hoc numeric limits), and
> server-derived money. Implements STEP 2 → STEP 3 → STEP 4 → STEP 5 for this
> surface only.

---

## Agent

`security-review-specialist` (primary). Coordinate with `backend-dev` for the
per-feature assert placement and the atomic-guard/unique-index work. Run
`00-recon-findings` FIRST and read its surface-#3 rows.

## Mission

For every Critical/High finding under surface #3 in
`prompts/dockstash-security/findings.md`:
1. Write ≥5 adversarial inputs per finding, including a **concurrent**
   double-request at the cap boundary.
2. Move/add the matching entitlement assert to the API layer (BEFORE the
   record is reserved or a queue job enqueued), preserving
   parse→own→assert→reserve→enqueue.
3. Add supertest cap-bypass tests + a concurrency test proving no over-cap
   under parallel requests.
4. Add a STEP 5 meta-guard: "every gated create calls an entitlements assert
   at the API layer".

## Operating Constraints

| Rule | Detail |
|---|---|
| Assert at the API layer | Caps checked ONLY in a BullMQ worker, ONLY in a tRPC/GraphQL resolver, or skipped on a create path are findings. The assert fires BEFORE the record is reserved or a job enqueued. |
| Order | parse (zod) → own (load owner-scoped) → assertCapacity → reserve → enqueue. Never assert after enqueue. |
| TOCTOU closed | A read-then-write count must be guarded by a unique index or an atomic conditional update. Two concurrent requests at `remaining==1` must not both succeed. |
| Tier source | Tier definitions come from `plans.ts` + the pricing-tier model. Ad-hoc numeric limits hardcoded in a feature module are a finding — route them through the tier. |
| Server-derived money | Subscription/order amounts come from the provider webhook + tier catalog, never a client-supplied amount trusted without re-derivation. |
| Idempotency | A replayed entitlement-granting event (handled jointly with surface #4) does not double-grant. Here we only guarantee the cap math is correct per current entitlements. |
| Docker-only | All build/test cmds in Docker. |
| i18n 7 locales | Cap-exceeded errors use existing keys where possible; new keys land in ALL 7 dictionaries. |
| No control weakened | Never disable a coverage gate or lint rule to pass a test. |

## Phases

### Phase 0 — Map
- 0.1 Read `prompts/dockstash-security/findings.md` surface-#3 rows. Read
  `prompts/SECURITY.md` § "3. PLAN CAPS / ENTITLEMENT BYPASS".
- 0.2 Read `modules/billing/entitlements.service.ts` end-to-end:
  `assertProjectCap`, `assertScheduleAllowed`, `assertRestoreDrillAllowed`,
  `assertAlertsAllowed`, `assertMultiVpsAllowed`, `assertMirrorAllowed`,
  `assertPitrAllowed`, `clampRetentionDays`/`clampRetentionPolicy`,
  `classifyCron`.
- 0.3 Read `modules/billing/plans.ts` + the pricing-tier model — the source of
  cap values.
- 0.4 For each gated feature, find the create/enable controller and trace the
  order. The recon already produced the suspect list.
- 0.5 Identify the cap-count queries (e.g.
  `Project.countDocuments({ owner })`) and whether they have a unique index or
  atomic guard closing the TOCTOU window.

### Phase 1 — Adversarial inputs (STEP 2)
For each finding, write ≥5 inputs:
- A `POST /api/projects` at `remaining==1` — assert 201 today, 402/409 after
  fix.
- TWO concurrent `POST /api/projects` at `remaining==1` — assert BOTH 201
  today (finding), exactly one 201 + one 402/409 after fix.
- A `POST /api/schedules` for a project whose tier disallows schedules —
  assert the assert fires before the BullMQ job is enqueued (no job row in the
  queue table/collection).
- A `POST` with a client-supplied `amount`/`price`/`tier` field that disagrees
  with the server-derived catalog — assert the server ignores/re-derives it.
- An ad-hoc numeric limit hardcoded in a feature module (e.g. a literal `<= 5`
  in a controller) — assert it routes through the tier (finding), then routes
  through the tier after fix.

### Phase 2 — Fix (STEP 3)
- 2.1 For each gated create/enable controller lacking an API-layer assert, add
  `await assertXxxAllowed(req.user.id, entitlements, t)` BEFORE the reserve
  call. Preserve parse→own→assert→reserve→enqueue.
- 2.2 For TOCTOU: where the cap is `countDocuments` + insert, add a **unique
  index** that bounds the count (e.g. a per-owner sequence field with a unique
  compound index, or a conditional atomic update
  `findOneAndUpdate({ owner, count: { $lt: cap } }, { $inc: { count: 1 } })`)
  so the second concurrent request fails the atomic guard. Document the chosen
  guard per cap.
- 2.3 Replace ad-hoc numeric limits with `plans.ts`/tier resolution. If a cap
  genuinely must be hardcoded (e.g. a security floor), document it with a
  comment and a meta-test exemption.
- 2.4 Confirm money is server-derived: the order/subscription amount is read
  from the Polar webhook payload + the tier catalog, never from a client body
  field. Strip/ignore any client-supplied `amount`/`price`/`currency` from the
  create-order path. (The webhook-integrity half of this is surface #4.)
- 2.5 Confirm `clampRetentionDays`/`clampRetentionPolicy` is applied on every
  create/update path that sets retention (so a Free-tier user cannot set a
  365-day retention by raw API).

### Phase 3 — Tests (STEP 4)
Server (vitest node, supertest against `createApp()`, mongodb-memory-server):
- **Cap math**: set a cap to N, create N successfully, assert the N+1th is
  rejected with the localized cap-exceeded message + correct status (402/409
  per convention). State per-test which fails before the fix.
- **Concurrency**: fire N+1 parallel `POST` requests (e.g. via
  `Promise.allSettled`) at `remaining==1`; assert EXACTLY one 201 and N 402/
  409; assert the persisted count is exactly the cap. This is the TOCTOU
  proof.
- **Assert-before-enqueue**: after a rejected cap, assert NO BullMQ job row
  was created (query the queue collection or the BullMQ in-memory state in
  the test harness).
- **Tier source**: a tier change (e.g. downgrade) immediately reduces the cap
  on the next create — no cached stale value.
- **Server-derived money**: a create-order request with a tampered
  `amount`/`price` is ignored; the created order matches the tier catalog.
- **Retention clamp**: a Free-tier `POST` with `retentionDays: 365` is
  clamped to the Free max (assert the persisted value).

### Phase 4 — Prevent (STEP 5)
- a) **Meta-test**: "every gated create/enable controller calls an
  entitlements assert at the API layer". Implement by scanning the
  controllers for the gated verbs and asserting each handler's body references
  an `assert*Allowed` call (or an equivalent) BEFORE a reserve/enqueue call.
  List gated routes lacking one and FAIL. This is the durable guard.
- b) **Concurrency meta-test** (heavier): a parametrized test that runs the
  cap-boundary concurrent-request scenario for EVERY gated resource, asserting
  no over-cap. If too slow for unit CI, gate it behind a `CONCURRENCY_META=
  1` env and run it in the CI matrix nightly.
- c) **ESLint `no-restricted-syntax`**: ban `countDocuments({ owner })`
  immediately followed by an insert without an atomic guard — hard to express
  precisely; prefer the meta-test.
- d) If warranted, add `.claude/rules/entitlement-cap-ordering.md` and a
  one-line entry in `.claude/rules/README.md`. Update `CLAUDE.md` §5 if
  load-bearing. Cross-reference `docs/plans-and-limits.en.md`.

## i18n

Cap-exceeded messages reuse `errors.tier*` keys where they exist. New keys
(e.g. a TOCTOU-specific "concurrent request exceeded cap" if surfaced) land in
ALL 7 server dictionaries + client locale files where rendered. Parity test
green. RTL for `ar`.

## Documentation

- `docs/plans-and-limits.en.md` — annotate the parse→own→assert→reserve→
  enqueue order and the TOCTOU guard chosen per cap.
- `docs/security-model.en.md` — note that caps are enforced at the API layer
  (not only in the worker) and that money is server-derived.
- `CLAUDE.md` §5 — reference the new rule file if added.

## Agents & Skills

- **Agents:** `security-review-specialist` (primary); `backend-dev` (assert
  placement + atomic guards).
- **Skills:** `/security-review` `api` mode (deep semantic pass — **required**
  before merge); `spec-driven-development` (spec the unique-index/atomic-guard
  per cap before implementing); `code-review` (final diff pass — assert no
  gated create lacks an API-layer assert, no `countDocuments`+insert without a
  guard).

## Idempotency Contract

Re-running MUST NOT: add an assert twice to the same controller (detect
existing `assert*Allowed` call and skip), re-create a unique index that
exists, re-clamp retention twice, duplicate the meta-tests, or re-write the
rule file. Detect existing controls and reconcile in place. A re-run that
finds the surface clean appends "re-verified YYYY-MM-DD — surface #3 clean" to
`findings.md`. Findings fixed here are annotated with `— FIXED at file:line
(prompt 03)` for `09`'s report.
