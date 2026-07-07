# Billing-Lapse Data Integrity & Dunning Notifications — Build Prompt

> **Closes the gap between what `docs/plans-and-limits.en.md` promises on
> non-payment ("Existing backups are never deleted... Nothing is deleted")
> and what the code actually does.** Prompt `07` built the dunning/grace/
> downgrade lifecycle engine; prompt `08` built dunning/receipt email
> templates but never wired the call site its own instructions required.
> This prompt closes 8 findings across retention integrity, webhook-path
> parity, user notification, drift-healing, schedule hygiene, fleet-agent
> re-assertion, a documented storage-retention policy, and a GDPR purge-orphan
> bug — all discovered by tracing every path that can land a user on the Free
> tier.

---

## Agent

`backend-dev` (owns `server/src/modules/billing/`, `server/src/modules/
scheduler/`, `server/src/modules/communication/`, `server/src/modules/legal/`).
Coordinate with `security-review-specialist` for a final pass on findings F1/F2
(they touch the same trust boundary — "what happens to a tenant's data and
entitlements on a state transition" — that `prompts/dockstash-security/03` and
`04` already hardened) and `unit-test-specialist` for the coverage gate.

## Mission

For each finding below: reproduce it with a failing test, fix it, add the
passing test, add a durable STEP-5 guard where one is called for. Do not treat
any finding as "already handled elsewhere" without pointing to the exact
file:line that handles it.

| id | Sev | Finding | Evidence |
|----|-----|---------|----------|
| F1 | **Critical** | Downgrade destructively prunes existing snapshots below the new tier's retention ceiling — contradicts the "never deleted" doc promise. `runPrune` skips only on `legalHold`, never on `Project.paused`; `clampRetentionPolicy` narrows retention with no grandfathering of history that predates the downgrade. | `server/src/modules/scheduler/scheduler.prune.service.ts:65-71`, `server/src/modules/billing/entitlements.service.ts:258-276`; contradicts `docs/plans-and-limits.en.md:38` |
| F2 | High | Direct `subscription.canceled`/`.revoked` webhook drops entitlements to Free but never calls `applyProjectCap`/pauses anything or sets `selectionRequired` — unlike `expireGraceIfNeeded`/`handleRefund`, which do. The next backup on *every* project (not just the overflow) 403s with `projectLimitReached` and no project flagged as the problem. | `server/src/modules/billing/webhook/registry.ts:118-140` (side effects gated on `status === 'active'` only); untested today — `server/src/modules/billing/webhook-dispatch.test.ts:444` only asserts `sub.status`, never project/schedule state |
| F3 | High | Zero user notification for dunning-start / grace-expiry-downgrade / reactivation, despite `deliverDunningEmail`/`deliverPaymentReceiptEmail` already built, unit-tested, and exported from the communication module's public API — and a `LifecycleEvent` type in `lifecycle.service.ts` defined but never consumed anywhere in the codebase. | `server/src/modules/communication/communication.service.ts:128-146`, `server/src/modules/communication/index.ts:9-10`, `server/src/modules/billing/lifecycle.service.ts:24-29`; no call site exists repo-wide (verified by full-repo grep) |
| F4 | Medium | `reconcileSubscriptions` only polls `provider.listActiveSubscriptions()` (Polar's `?active=true` filter). A subscription fully canceled/ended on the provider drops out of that list entirely, so if the original terminal webhook (`subscription.canceled`/`.revoked`) was dropped, the 15-minute drift-healer **never revisits that row** — local status can stay `active`/`past_due` with full paid entitlements indefinitely. | `server/src/modules/billing/reconcile.ts:43-98`, `server/src/modules/billing/providers/polar.ts:337-345`; `IPaymentProvider` has no fetch-by-id method (`server/src/modules/billing/payment-provider.ts:96-105`) |
| F5 | Medium | Pausing a project never disables its `Schedule` documents. `canEnqueue` allows `backup`/`prune`/`check` on every tier regardless of the project's paused state or the tier's `schedules` flag, so a paused project's cron keeps firing: `backup` 403s harmlessly at runtime, but `prune` does not (see F1) — plus wasted worker cycles and alert-retry noise. | `server/src/modules/scheduler/scheduler.entitlements.ts:20-27`, `server/src/modules/scheduler/scheduler.cron.ts:30-56`, `server/src/modules/billing/lifecycle.service.ts:119-143` (`applyProjectCap` never touches `Schedule`) |
| F6 | Low | `multiVps` (fleet-agent) entitlement is enforced only at agent create/rotate/list/delete time, never re-asserted on downgrade — a Business→lower-tier downgrade leaves every already-registered fleet agent running indefinitely, dispatching jobs with no re-check. Same missing pattern as F1/F2: enforced going forward, never re-applied when the tier shrinks. | `server/src/modules/billing/entitlements.service.ts:209-221`, `server/src/modules/agents/agents.controller.ts` (every `assertMultiVpsAllowed` call site is a mutation/creation path) |
| F7 | Low (policy) | No storage-reclamation policy exists for permanently-paused/abandoned projects — disk grows unbounded for accounts that downgrade and never return. Only the opt-in GDPR delete flow (`legal.service.ts`) ever deletes a repo. | N/A — documentation-only, no code fix required |
| F8 | Low (adjacent bug, same investigation) | `purgeAccount` skips deleting a project when `project.legalHold` is set (`continue`), but unconditionally deletes the `User` row at the end regardless — orphaning that project (no owner, but not on legal hold at the user level). | `server/src/modules/legal/legal.service.ts:184-221`, specifically line 219 (`User.deleteOne`) vs. the per-project `continue` at line 200 |

## Operating Constraints

| Rule | Detail |
|---|---|
| Backups never deleted | The load-bearing invariant this whole prompt defends. A paused project's stored snapshots are never pruned; retention narrowing on a still-active project must not retroactively delete history that predates the downgrade (see F1 fix shape). Any test that would delete a pre-downgrade snapshot is the reproduction of the bug, not acceptable end-state behavior. |
| No new deletion paths | Every fix pauses/blocks/notifies — none of F1–F6 introduce a NEW code path that deletes a `Project`, `Schedule`, or `Agent` record. Only F8 touches the existing GDPR delete path, and only to prevent an orphan, never to delete more. |
| Docker-only | Every build/test/typecheck/lint command runs inside Docker per `.claude/rules/docker-only-commands.md` — never bare `npm`/`node`/`npx` on the host. |
| i18n 7 locales | New user-facing strings (email subjects/bodies, any new error/reason codes) land in ALL 7 dictionaries (`en, ar, fr, de, es, ru, zh`) — `.claude/rules/mern-*` conventions plus the existing `shared/i18n/` key-parity test. RTL-safe for `ar` if any client-rendered string is added. |
| Named exports, typed schemas | No `export default`; new Mongoose fields (`Schedule.pausedByBilling`) go through `InferSchemaType`, explicit `{ timestamps: true }` unchanged. `.claude/rules/mern-no-default-exports.md`, `.claude/rules/mern-mongoose-typed-schemas.md`. |
| Owner-scoped queries | Any new query this prompt adds (e.g. `Schedule.updateMany`) filters by the already-owner-scoped project/user id sets the calling function already computed — never a bare id from a request. `.claude/rules/owner-scoped-queries.md`. |
| Reuse existing DI patterns | The optional-mailer pattern already exists at `legal.service.ts`'s `ScheduleAccountDeletionDeps.mailer` (non-fatal on failure, doesn't block the state transition) — F3 reuses this shape verbatim rather than inventing a new notification abstraction. |
| No control weakened | Never disable a coverage gate, lint rule, or `.claude/rules/*` invariant to make a test pass. |
| Destructive git | No destructive git command without per-turn confirmation (`.claude/rules/git-destructive-commands.md`). |

## Phases

### Phase 0 — Map

- 0.1 Read `docs/plans-and-limits.en.md` § "Lifecycle" in full — this is the
  contract the fixes must make true.
- 0.2 Read `server/src/modules/billing/lifecycle.service.ts` end-to-end:
  `beginDunning`, `expireGraceIfNeeded`, `expireAllOverdueGraces`,
  `applyProjectCap`, `handleDowngrade`, `handleUpgrade`, `handleRefund`,
  `selectProjectsToKeep`, and the unused `LifecycleEvent` type.
- 0.3 Read `server/src/modules/billing/webhook/registry.ts`'s
  `upsertSubscription` and `dispatchEvent` — trace every branch that can set
  `status` to `canceled`/`revoked`/`past_due`/`active` and which ones call a
  lifecycle side-effect function.
- 0.4 Read `server/src/modules/scheduler/scheduler.prune.service.ts`,
  `scheduler.entitlements.ts`, `scheduler.cron.ts`, and
  `server/src/modules/billing/entitlements.service.ts`'s
  `clampRetentionPolicy`/`clampRetentionDays`.
- 0.5 Read `server/src/modules/billing/reconcile.ts` and
  `server/src/modules/billing/payment-provider.ts`'s `IPaymentProvider`
  interface, plus both implementations (`providers/polar.ts`,
  `providers/stripe.ts`).
- 0.6 Read `server/src/modules/communication/communication.service.ts`'s
  `deliverDunningEmail`/`deliverPaymentReceiptEmail` and
  `server/src/modules/communication/resend.test.ts` for how they're already
  unit-tested in isolation.
- 0.7 Read `server/src/modules/legal/legal.service.ts`'s `purgeAccount` in
  full.
- 0.8 Read `server/src/modules/agents/agents.controller.ts`'s
  `assertMultiVpsAllowed` call sites, and check whether prompt `12`
  (`12-fleet-agents-in-all-plans-fable-5.md`, converting `multiVps` from a
  boolean to a metered `agents` count via `reserveProjectSlot`-style atomic
  reservation) has landed yet — this changes F6's exact fix shape (see F6
  below).

### Phase 1 — Adversarial inputs (STEP 2)

For each finding, reproduce with a concrete scenario:

- **F1**: Create a Pro-tier project, run 10+ daily backups spanning >7 days,
  downgrade to Free (webhook or direct `expireAllOverdueGraces` call in a
  test), run the prune job. Assert: today, snapshots older than 7 days are
  gone (the bug); after the fix, they survive.
- **F2**: Give a user 3 active projects, then fire a `subscription.canceled`
  webhook event directly (no prior `past_due`). Assert: today,
  `Project.paused` is unchanged on all 3 (bug — all subsequent
  `runBackup` calls 403 with no project flagged); after the fix, 2 newest are
  paused, `selectionRequired` is `true`, the oldest project's backup succeeds.
- **F3**: Fire a `past_due` webhook for a user with a real email. Assert:
  today, no email is queued/sent (bug, verify via a spy/mock mailer); after
  the fix, `deliverDunningEmail` is called exactly once with the correct
  `graceEndsAt`. Repeat the webhook delivery (idempotent retry) — assert the
  email is NOT sent a second time. Let the grace window lapse via
  `expireAllOverdueGraces` — assert a downgrade-notice email fires once.
- **F4**: Seed a local `Subscription` row with `status: 'active'`, mock the
  provider so `listActiveSubscriptions()` returns an empty array (simulating
  the subscription having fully ended on the provider's side, with the
  terminal webhook dropped). Run `reconcileSubscriptions()`. Assert: today,
  the row is untouched (bug — permanently stale paid entitlement); after the
  fix, `getSubscription` is called for that id and the row heals to
  `canceled`/`free`.
- **F5**: Downgrade a user with an `enabled: true` Pro-frequency `Schedule` on
  an overflow project. Assert: today, `Schedule.enabled` is still `true`
  after pause (bug — cron keeps enqueuing); after the fix,
  `Schedule.enabled === false` and `pausedByBilling === true`. Then
  re-upgrade: assert the schedule re-enables. Then downgrade again on a
  schedule the user had manually disabled BEFORE the billing pause — assert
  re-upgrade does NOT force it back to `enabled: true` (must not resurrect a
  user-disabled schedule).
- **F6**: Register 3 fleet agents on a Business subscription, downgrade to
  Pro/Free. Assert: today, all 3 agents keep dispatching jobs (bug); after
  the fix, excess agents are blocked from new job dispatch (never deleted).
- **F8**: Create a user with 2 projects, one with `legalHold: true`. Schedule
  deletion, let it become due, run `purgeAccount`. Assert: today, the
  `legalHold` project row survives but the `User` row is deleted anyway
  (orphan — bug); after the fix, the account purge is blocked/deferred and
  both rows survive consistently.

### Phase 2 — Fix (STEP 3)

**F1 — Retention clamp must not retroactively delete.**
- 2.1a Add a `paused` guard to `runPrune` (`scheduler.prune.service.ts`),
  identical in shape to the existing `legalHold` guard: a paused project's
  prune job returns `{ ok: true, detail: t('...pruneSkippedPaused') }`
  without calling `resticRunner.forget`.
- 2.1b For a still-active (kept) project post-downgrade,
  `clampRetentionPolicy` must not retroactively shrink retention that
  predates the downgrade in one step. Implement grandfathering: track the
  tier-change timestamp on the `Subscription` (or `Project`) and have the
  prune job apply the OLD (wider) ceiling to snapshots created before that
  timestamp, the NEW (narrower) ceiling only to growth after it. Alternative
  acceptable shape: a fixed grace window (e.g. matching `GRACE_WINDOW_MS`)
  before the narrower ceiling takes effect at all. Pick one, document the
  choice inline, and prove it with a test showing pre-downgrade snapshots
  surviving indefinitely (grandfather) or at least through the grace window.

```ts
// scheduler.prune.service.ts — paused guard, same shape as legalHold
if (project.paused) {
  return { ok: true, detail: t('scheduler.success.pruneSkippedPaused') };
}
if (project.legalHold) {
  return { ok: true, detail: t('security.legalHold.pruneSkipped') };
}
```

**F2 — Cancel/revoke must pause like every other free-landing path.**
- 2.2 In `upsertSubscription` (`webhook/registry.ts`), add a branch alongside
  the existing `if (status === 'active') { ... }` block:

```ts
if (status === 'canceled' || status === 'revoked') {
  await applyProjectCap(userId, 'free');
}
```
  This is the exact function `expireGraceIfNeeded`/`handleRefund` already
  call — no new logic, just the missing call site. Confirm idempotency:
  calling `applyProjectCap` on an already-paused set is a no-op (it already
  is, per its `overflow.length > 0` guard).

**F3 — Wire the existing mailer.**
- 2.3a Add an optional injectable notifier to the lifecycle layer, mirroring
  `legal.service.ts`'s `ScheduleAccountDeletionDeps.mailer` shape (optional,
  failure caught and non-fatal, never blocks the state transition):

```ts
export interface DunningMailer {
  sendDunningStarted(input: { userId: string; graceEndsAt: Date }): Promise<void>;
  sendGraceExpired(input: { userId: string }): Promise<void>;
  sendReactivated(input: { userId: string }): Promise<void>;
}
```
- 2.3b Wire `beginDunning`'s `true`-return branch (transition actually
  happened — never on an idempotent repeat) to `sendDunningStarted`, which
  loads the `User` (email + `language`) and calls the existing
  `deliverDunningEmail` with the plan display name and `graceEndsAt`.
- 2.3c Add a NEW email template + i18n keys for "grace expired / downgraded"
  (none exists today — only `email.dunning.*` does) in
  `communication.service.ts`, wired from `expireAllOverdueGraces`'s per-row
  loop on `result.expired === true`.
- 2.3d Wire `handleUpgrade`'s reactivation branch (`priorSub.status !==
  'active'` → now active) to a reactivation email — reuse
  `deliverPaymentReceiptEmail` if the amount/plan is available at that call
  site, otherwise add a minimal "welcome back" template.
- 2.3e Retire the unused `LifecycleEvent` type: either make it the literal
  parameter these new notifier methods dispatch on (a single
  `notify(event: LifecycleEvent, ...)` entry point), or delete it if a
  narrower per-transition method set (as sketched above) is simpler. Do not
  leave it defined-but-unused.

**F4 — Close the reconcile blind spot.**
- 2.4a Add to `IPaymentProvider` (`payment-provider.ts:96`):

```ts
getSubscription(providerSubscriptionId: string): Promise<NormalizedSubscription | null>;
```
- 2.4b Implement in `PolarProvider` via the same `this.client().request(...)`
  pattern as `listActiveSubscriptions` (`providers/polar.ts:337-345`),
  against Polar's `GET /subscriptions/{id}`; a 404 resolves to `null`.
- 2.4c Implement in `StripeProvider` as another `inactive('getSubscription')`
  throw, consistent with its existing stub pattern (`providers/stripe.ts`).
- 2.4d In `reconcileSubscriptions` (`reconcile.ts:43`), after the existing
  loop over `remote`, add: query local `Subscription.find({ status: {
  $in: ['active', 'past_due'] } })`, diff against the set of
  `providerSubscriptionId`s already healed from `remote`, and for each
  leftover row call `getSubscription`. A `null` result (not found) or a
  terminal status heals the row via the SAME `toPersistedStatus` +
  `handleDowngrade`/`applyProjectCap` path the main loop uses — no duplicated
  logic, just a second source of rows to feed the same healer.

**F5 — Stop paused projects' schedules from firing.**
- 2.5a Add `pausedByBilling: { type: Boolean, required: true, default: false
  }` to `scheduler.model.ts`, typed via `InferSchemaType` per
  `.claude/rules/mern-mongoose-typed-schemas.md`.
- 2.5b In `applyProjectCap` (`lifecycle.service.ts:119-143`), when pausing
  the `overflow` project set, also:

```ts
await Schedule.updateMany(
  { project: { $in: overflow.map((p) => p._id) } },
  { $set: { enabled: false, pausedByBilling: true } },
);
```
- 2.5c In `handleUpgrade`/`selectProjectsToKeep`, when unpausing projects,
  only re-enable schedules where `pausedByBilling === true` (never force-
  enable a schedule the user independently disabled), then clear the flag:

```ts
await Schedule.updateMany(
  { project: { $in: unpausedProjectIds }, pausedByBilling: true },
  { $set: { enabled: true, pausedByBilling: false } },
);
```

**F6 — Re-assert `multiVps`/agent cap on downgrade.**
- 2.6 If prompt `12`'s metered `agents` count (via `reserveProjectSlot`-style
  atomic reservation) has NOT landed yet: on any downgrade that drops
  `multiVps` true→false, block already-registered agents from new job
  dispatch (a `blockedByBilling` flag on the agent record, checked at job-
  lease time — never delete the agent). If prompt `12` HAS landed by
  execution time: apply the identical reservation-based re-assertion pattern
  `applyProjectCap` uses, against the `agents` counter instead of `projects`.
  Either way: never delete an agent record as a consequence of a downgrade.

**F7 — Document, don't code.**
- 2.7 Add a short section to `docs/plans-and-limits.en.md` (or a new
  `docs/data-retention-policy.en.md`, linked from it) stating: paused
  projects/repos are retained indefinitely today with no automatic
  reclamation; this is a deliberate current decision, not an oversight, and
  an operator wanting to bound storage growth must act manually (or a future
  prompt can add an opt-in policy). No test required.

**F8 — Fix the purge-orphan bug.**
- 2.8 In `purgeAccount` (`legal.service.ts:184-221`), track whether any
  project was skipped for `legalHold` inside the loop; if so, do NOT run
  `User.deleteOne` at the end — return a result consistent with the existing
  user-level early-return shape, e.g. `{ ok: false, reason: 'legalHold',
  projectsPurged: N }`, leaving the user row (and the deletion schedule)
  intact so a future purge attempt can retry once the hold lifts.

### Phase 3 — Tests (STEP 4)

Server (vitest node, supertest against `createApp()`, `mongodb-memory-server`,
following the existing patterns in `billing/lifecycle-reconcile.test.ts`,
`billing/webhook-dispatch.test.ts`, `billing/entitlements-cap.test.ts`):

- **F1**: a downgrade test that seeds snapshots via a fake `resticRunner`,
  asserts the paused-project prune is a skip (no `forget` call recorded),
  and a still-active kept project's prune preserves pre-downgrade history
  per the chosen grandfathering mechanism. Cover both the `paused` guard
  branch and the `legalHold` guard branch (regression) in the same file.
- **F2**: a direct `canceled`/`revoked` webhook delivery test asserting
  `applyProjectCap` fires (overflow projects paused, `selectionRequired`
  true, oldest project's next `runBackup` succeeds while others 403 with
  `projectPaused` not `projectLimitReached`).
- **F3**: mock/spy the mailer dependency — assert exactly one dunning email
  on the state transition, zero on repeat webhook delivery, exactly one
  downgrade-notice email on grace expiry, exactly one reactivation email on
  upgrade-from-past_due. Assert email content includes the correct
  `graceEndsAt`/plan name. Assert failure of the mailer (rejected promise)
  never throws out of the lifecycle function (non-fatal, matching
  `legal.service.ts`'s existing try/catch shape).
- **F4**: the adversarial-input scenario from Phase 1 as a passing test —
  `getSubscription` called for the orphaned local row, row heals correctly.
  Also test the `StripeProvider.getSubscription` stub throws `inactive`.
- **F5**: pause → assert `Schedule.enabled === false` and
  `pausedByBilling === true`; upgrade → assert re-enable; the "user manually
  disabled before billing pause" case → assert it stays disabled after
  re-upgrade (the `pausedByBilling` guard on the query).
- **F6**: downgrade with 3 registered agents → assert existing agents are
  neither deleted nor able to lease new jobs beyond the new cap; agent
  records still exist and re-enable on re-upgrade.
- **F8**: the Phase-1 F8 scenario as a passing test — both rows survive,
  correct `reason`/`ok` result shape.

### Phase 4 — Prevent (STEP 5)

- a) **Meta-test**: "every path that can set a subscription to a non-active
  terminal status (`canceled`, `revoked`, grace-expiry) calls
  `applyProjectCap`" — scan `webhook/registry.ts`, `reconcile.ts`, and
  `lifecycle.service.ts` for the status-setting branches and assert each has
  a paired `applyProjectCap`/equivalent call. This is the durable guard
  against F2/F4 regressing.
- b) **Meta-test**: "no `runPrune`/prune-dispatch path is reachable for a
  `paused` project without the guard short-circuiting before
  `resticRunner.forget` is called" — mirrors the existing `legalHold` static
  guard pattern already used elsewhere in this codebase.
- c) **Meta-test**: "every lifecycle transition that changes user-visible
  entitlement state has a non-fatal notifier call" (dunning-start,
  grace-expired, reactivated) — grep-based or call-graph-based, whichever
  matches the existing meta-test style in `server/src/shared/middleware/
  entitlement-meta.test.ts`.
- d) Update/add `.claude/rules/entitlement-cap-ordering.md` (or a new rule
  file if this doesn't fit that one) with the "every free-landing path pauses
  consistently" invariant, plus a one-line entry in `.claude/rules/README.md`
  if a new rule file is added. Update `CLAUDE.md` §5 if load-bearing.

## Coverage & Success Gate — NON-NEGOTIABLE

This prompt is DONE only when, **inside Docker**, the suite is 100% passing
and v8 coverage is **100% on lines / branches / functions / statements** for
every file this prompt touched:

```
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run --coverage
```

Hard requirements:
- Every one of the 8 findings ships a test that FAILS before the fix and
  PASSES after — stated per test, per the Phase-1/Phase-3 pairing above.
- Both branches of every new guard (`paused` skip vs. run; mailer success vs.
  caught failure; `pausedByBilling` true vs. false on re-upgrade; found vs.
  `null` on `getSubscription`) are covered.
- No `.skip`/`.only`, no lowered `vitest.config.ts` thresholds, no
  `/* c8 ignore */`, no `eslint-disable`/`@ts-ignore` to reach green
  (`docs/ci-gates.en.md`).
- If a line is genuinely unreachable, delete/refactor it — never ignore it.
- The 7-locale i18n parity test stays green for every new key.
- Re-run until green AND 100%. A red or sub-100% run is not "almost done" —
  it is not done.

## i18n

New keys: the grace-expired/downgrade-notice email (subject + body), the
reactivation email if a new template is added, and any new `reason` codes
surfaced to the client (e.g. `blockedByBilling` on an agent). All land in
`en, ar, fr, de, es, ru, zh` under `shared/i18n/dictionaries/`. Parity test
green. RTL-safe for any client-rendered string (`ar`).

## Documentation

- `docs/plans-and-limits.en.md` — correct the "never deleted" claim to
  precisely describe the now-true grandfathering/pause behavior (F1), and
  document the storage-retention policy decision (F7).
- `docs/polar-billing-and-webhooks.en.md` — note the reconcile blind-spot fix
  (F4) and the cancel/revoke pause parity (F2).
- `docs/security-model.en.md` — note that every free-landing transition now
  pauses consistently and notifies the user.
- `CLAUDE.md` §5 — reference any new/updated rule file.
- Propagate any changed guidance to `.cursorrules`/`.windsurfrules` per
  CLAUDE.md's mirroring note.

## Agents & Skills

- **Agents**: `backend-dev` (primary); `security-review-specialist` (F1/F2
  final pass); `unit-test-specialist` (coverage gate).
- **Skills**: `spec-driven-development` (spec the grandfathering mechanism
  for F1 before implementing); `payment-orchestrator` (webhook/lifecycle
  correctness); `backend-i18n` (new email/error keys across 7 locales);
  `code-review` (final diff pass — assert no free-landing path skips
  `applyProjectCap`, no prune path skips the `paused` guard).

## Idempotency Contract

Re-running this prompt MUST NOT: add `pausedByBilling` to `scheduler.model.ts`
twice, double-wire a mailer call onto an already-notified transition,
re-add `getSubscription` to `IPaymentProvider` if already present, duplicate
the meta-tests, or re-write a rule file. Detect existing controls (grep for
the guard/field/method before adding) and reconcile in place. A re-run that
finds a given finding already fixed appends "re-verified YYYY-MM-DD — finding
FN clean" to this file's own findings table rather than re-implementing.
Findings fixed here should be annotated `— FIXED at file:line (prompt 13)`
for cross-reference with `prompts/dockstash-security/findings.md`.
