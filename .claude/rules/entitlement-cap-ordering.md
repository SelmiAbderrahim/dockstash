# Entitlement Cap Ordering (Surface #3) - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every gated create / enable / cadence-change endpoint runs
`parse → own → assert → reserve → mutate/enqueue` at the API layer. Cap /
frequency asserts fire BEFORE the record is reserved or a queue job enqueued.
Countable resources close their TOCTOU window with an atomic conditional
`$inc` on the per-owner `UsageCounter` — never a bare
`countDocuments()`-then-`Model.create()`.**

See `prompts/dockstash-security/03-plan-caps-entitlement-bypass-opus-4.7.md`
and `docs/plans-and-limits.en.md` for the threat model.

## Why This Rule Exists

Two failure modes the earlier order caught too late:

1. **Assert after enqueue.** If a job is queued before the tier gate runs, a
   downgraded user's minute-cadence backup keeps firing while the resolver
   spins on `assertScheduleAllowed` — and `billingEntitlements.canEnqueue`
   only rejects a subset of kinds. Enforce at the API layer so a raw-API
   PATCH that escalates `cron` cadence is 403 at write time.
2. **Read-then-write races.** `Project.countDocuments({owner}) → cap - 1`
   followed by `Project.create` is TOCTOU. Two concurrent requests at
   `remaining == 1` both pass the read and both insert. Close the window
   inside a single atomic op.

## CORRECT

```ts
// Controller — order: parse → assert → reserve → create.
export const create: RequestHandler = asyncHandler(async (req, res) => {
  const input = createProjectSchema.parse(req.body);      // 1 parse (strict zod)
  const userId = requireUserId(req.user);
  if (input.agentId) await assertMultiVpsAllowed(userId, { t: req.t }); // 2 assert
  await reserveProjectSlot(userId, {                                    // 3 reserve
    t: req.t,
    countActiveProjects: (uid) =>
      Project.countDocuments({ owner: uid, paused: { $ne: true } }),
  });
  try {
    const project = await createProject(userId, input, { t: req.t });   // 4 create
    res.status(201).json({ project: serializeProject(project) });
  } catch (err) {
    await releaseProjectSlot(userId);                                   // rollback
    throw err;
  }
});
```

```ts
// Reservation ledger (server/src/modules/billing/usage-counter.model.ts):
// unique(owner) index + reserveProjectSlot's findOneAndUpdate({owner, projects:
// {$lt: cap}}, {$inc: {projects: 1}}) runs under a single MongoDB write lock —
// the 2nd concurrent request at remaining==1 matches zero and receives 403.
```

```ts
// PATCH scheduler: re-run the tier gate on any change that could escalate.
// A raw-API `{cron: "* * * * *", enabled: true}` from a Free-tier lapsed
// subscriber must be 403 at write time, not just at prune-time.
const cronChanged = input.cron !== undefined && input.cron !== schedule.cron;
const enableTransition = input.enabled === true && !schedule.enabled;
if (cronChanged || enableTransition) {
  await assertScheduleAllowed(userId, { t, frequency: classifyCron(nextCron) });
}
schedule.retention = await clampRetentionPolicy(userId, merged);        // clamp too
```

## FORBIDDEN

```ts
// WRONG — enqueue before assert. A downgraded user's job runs before the gate.
await queue.add({...});
await assertScheduleAllowed(userId, {t, frequency: classifyCron(schedule.cron)});
```

```ts
// WRONG — count-then-insert. Two concurrent requests at remaining==1 both
// create a Project. The 2nd request MUST fail on an atomic guard.
const activeCount = await Project.countDocuments({owner});
if (activeCount >= entitlements.projects) throw HttpError.forbidden(...);
await Project.create({owner, ...});
```

```ts
// WRONG — PATCH scheduler with no re-assert. Legacy Pro schedules keep firing
// at minute cadence after a Free downgrade.
if (input.cron !== undefined) schedule.cron = input.cron;
if (input.enabled !== undefined) schedule.enabled = input.enabled;
await schedule.save();
```

```ts
// WRONG — ad-hoc numeric limit hardcoded in a feature module. Route through
// the tier so plans.ts stays the single source of truth.
if (activeCount >= 5) throw HttpError.forbidden(...);
```

```ts
// WRONG — client-supplied `amount` / `price` / `tier` accepted verbatim.
// Server-derived money only: strip via zod, re-derive from the tier catalog.
const order = await Order.create({ userId, amount: req.body.amount });
```

## Ordering Contract

For every gated create/enable/cadence-change controller:

1. **parse** — zod schema on `req.body` / `req.params` / `req.query`. Defaults
   to `.strip()` so unknown fields (a client-supplied `tier`/`amount`/`price`)
   never reach the service layer.
2. **own** — for resources loaded by URL id, `Model.findOne({_id, owner})` at
   query time (see `.claude/rules/owner-scoped-queries.md`).
3. **assert** — the correct `assert*Allowed` call for the feature; feature
   flag first, frequency second.
4. **reserve** — atomic slot reservation for countable resources
   (`reserveProjectSlot`). Never a bare `countDocuments()`+insert.
5. **mutate / enqueue** — Project.create, queue.add, schedule.save. On a
   post-reserve throw the controller MUST call `releaseProjectSlot(owner)`.

## Money Discipline

- Client bodies MUST NOT set `amount` / `price` / `currency` / `tier`. Zod
  schemas default to strip, and the create-order path re-derives amount from
  the tier catalog + provider webhook (see prompt `04`).

## Retention Clamp

- `clampRetentionPolicy` runs on EVERY schedule create/update path (see
  `scheduler.service.ts::createSchedule` / `updateSchedule`). Prune-time
  clamp stays as belt-and-braces.
- Retention narrowing on a downgrade is **grandfathered**, not applied
  retroactively: a downgrade that shrinks the retention ceiling stamps
  `Subscription.retentionGraceUntil = now + GRACE_WINDOW_MS`, and for that
  window `runPrune` applies the pre-downgrade (wider) policy **unclamped** so
  snapshots predating the downgrade are not deleted. A `paused` project's
  prune job short-circuits to a successful skip BEFORE `resticRunner.forget`
  — backups are never deleted by a billing lapse (prompt 13 / F1).

## Free-Landing Consistency (prompt 13)

Every transition that lands a subscriber on Free MUST funnel through
`applyProjectCap(userId, 'free', { priorSlug })` — grace expiry
(`expireGraceIfNeeded`), refund/chargeback (`handleRefund`), plan downgrade
(`handleDowngrade`), the reconcile terminal-heal (`reconcile.ts`), AND a direct
`subscription.canceled` / `.revoked` webhook (`webhook/registry.ts`). A
free-landing branch that sets a terminal status WITHOUT the paired
`applyProjectCap` call is a durable regression — over-cap projects stay
"active" and every subsequent run 403s with no project flagged. `applyProjectCap`
is the single funnel that: pauses (never deletes) over-cap projects, disables
their still-enabled schedules (`pausedByBilling`), re-asserts the fleet-agent
cap (`blockedByBilling`, never deletes an agent), and stamps the retention
grandfather window.

Each entitlement-visible transition (dunning-start, grace-expiry downgrade,
reactivation) additionally fires `notifyLifecycleEvent(...)`, which is ALWAYS
non-fatal — a rejected notifier is logged and swallowed so the state transition
is never rolled back by a bounced email.

The meta-test at `shared/middleware/entitlement-meta.test.ts` statically
asserts each free-landing branch is paired with `applyProjectCap`, the prune
path guards on `paused`, and each transition has a notifier call.

## Validation

```bash
# Every gated create/enable controller lists its assert; a new gated verb
# without one fails the static meta-test:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/entitlement-meta.test.ts

# Cap-boundary concurrency proof:
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/billing/entitlements-cap.test.ts
```

Both must be green. Any red is a durable regression, not a flake.

## Escape Hatch

None. If a cap genuinely must live outside `plans.ts` (a hard security
floor), document it inline with a comment naming the finding + threat model,
and add an explicit meta-test allowlist entry.

## Checklist

- [ ] Every controller for a gated create/enable/cadence-change calls its
      `assert*Allowed` at the API layer BEFORE reserve/create/enqueue.
- [ ] Countable resources reserve via `reserveProjectSlot` (atomic $lt cap
      $inc). Never `countDocuments`+`Model.create` without an atomic guard.
- [ ] Post-reserve throws call `releaseProjectSlot(owner)` to roll back.
- [ ] Retention clamped on every schedule create/update (not only at prune).
- [ ] Tier data comes from `plans.ts`; no ad-hoc numeric limits in feature
      modules.
- [ ] Money server-derived: no client-supplied `amount`/`price`/`tier`.
- [ ] Meta-test at `entitlement-meta.test.ts` green.
