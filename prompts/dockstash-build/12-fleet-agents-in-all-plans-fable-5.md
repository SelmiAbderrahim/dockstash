# Fleet Agents in All Three Plans — Build Prompt

> **Turn the fleet from a Business-only boolean into a metered resource on every
> plan** — Free = 1 agent, Pro = 5 agents, Business = unlimited. Replace the
> `multiVps` flag with an `agents` count cap enforced by an atomic
> `UsageCounter` reservation (the `reserveProjectSlot` pattern), rename the 403
> reason `multiVpsLocked` → `agentLimitReached`, and update **every** surface
> that mentions the old gate: server entitlements + controllers, client fleet +
> billing screens, marketing pricing/features/FAQ pages, all 7 locales, all
> localized docs — while keeping the 100% coverage gate green on both sides.

---

## Agent

`backend-dev` (owns `server/src/modules/billing/{plans.ts, entitlements.service.ts,
usage-counter.model.ts, pricing-tier.model.ts, pricing-tier.seed.ts,
billing.service.ts}` and the agent/backups controller call sites). Coordinate
with `react-specialist` (fleet screen, pricing grid, usage tab, wizard ordering,
marketing pages) and route final copy through the `dockstash-design` skill.

## Why (product context — read before coding)

dockstash.com is deployed as a **hosted SaaS**: customers' Docker hosts are
always remote machines, reachable ONLY by installing the fleet-agent daemon
(`agent/`, image `selmiabderrahim/agent`) on their VPS. The local no-agent
backup path (docker-socket-proxy on the host running Dockstash itself) serves
the self-host story and Dockstash's own self-backup — it backs up **nothing a
hosted customer owns**.

Today `plans.ts` sets `multiVps: false` for BOTH `free` and `pro`
(`server/src/modules/billing/plans.ts:56,68`) and `assertMultiVpsAllowed`
(`server/src/modules/billing/entitlements.service.ts:209-221`) is a flat
boolean gate called from every user-facing agent route. Net effect: **a paying
Pro customer can register zero agents and therefore back up zero servers.**
The `/fleet` screen shows "Multi-VPS fleet is a Business feature" to a Pro
subscriber. That is the bug this prompt fixes — at the product level, not with
a one-line flag flip.

## Mission

1. **Entitlement change.** `Entitlements.multiVps: boolean` becomes
   `agents: number`: `free = 1`, `pro = 5`, `business =
   Number.POSITIVE_INFINITY`. Everything else in the matrix (projects,
   retentionDays, frequency, schedules, emailAlerts, restoreDrills,
   pitrRestore, `mirror`) is **untouched**. Prices unchanged ($0 / $9 / $29).
2. **Atomic cap enforcement.** Agent registration reserves a slot via the
   existing `UsageCounter` atomic pattern (never `countDocuments`-then-create);
   agent deletion releases it. Read/maintenance agent routes lose the plan
   gate entirely — owner-scope remains the only guard.
3. **Reason-code migration.** `multiVpsLocked` → `agentLimitReached` end to
   end: server dictionaries (7), client fleet Redux typing, locked-state UI.
4. **Every surface updated.** Fleet screen (at-cap upsell instead of tier
   lock), billing grid + usage, project wizard (agent-first ordering),
   marketing pricing/features/fleet pages, AEO/FAQ copy, `platform.ts` prose,
   `docs/plans-and-limits.*` + `docs/fleet-agents.*` — in **all 7 locales**.
5. **Gates stay green.** 100% vitest coverage (lines/branches/functions/
   statements) on server AND client, all meta-tests green, lint/typecheck
   clean, zero `multiVps` references left outside `prompts/` history.

## Operating Constraints

| Rule | Detail |
|---|---|
| Cap ordering | `.claude/rules/entitlement-cap-ordering.md` verbatim: `parse → own → assert → reserve → mutate`. Agent registration is a **countable resource** — reserve with an atomic conditional `$inc` on `UsageCounter`, never a bare count-then-create. Post-reserve throw → release (rollback) in the controller `catch`. |
| Reservation idiom | Clone the existing project idiom in `entitlements.service.ts`: `reserveProjectSlot` (:372), `releaseProjectSlot` (:413), `adjustProjectCounter` (:425), `reconcileProjectCounter` (:445). Same shape for agents: `updateOne({ owner, agents: { $lt: cap } }, { $inc: { agents: 1 } }, { upsert: true })`, E11000 retry without upsert, **infinite cap = no counter row touched**, release is a `$inc: -1` guarded by `{ agents: { $gt: 0 } }`. |
| Owner scoping | `.claude/rules/owner-scoped-queries.md` — no regressions. Dropping the plan gate from read routes must NOT loosen ownership: every agent load stays `findOne({ _id, owner })`, foreign owner → 404. |
| Machine surface untouched | `.claude/rules/agent-machine-surface.md` — this prompt touches ONLY the user-facing `/api/agents` surface. The `/api/agent` machine surface (composite-token verify, dummy-record HMAC, per-agent job scoping) is **out of scope**; `agent-machine-meta.test.ts` and `agent/src/security-meta.test.ts` must pass unchanged. |
| i18n parity | 7 locales (`en, ar, fr, de, es, ru, zh`), four distinct i18n stores: client JSON namespaces (`client/src/shared/i18n/locales/*`), server typed dictionaries (`server/src/shared/i18n/dictionaries/*.ts`), marketing content modules (`client/src/features/marketing/content/locale/*/platform.ts`), and localized docs (`docs/*.{en,ar,de,es,fr,ru,zh}.md`). A key added/renamed in one locale is added/renamed in all 7. Identical interpolation vars across locales (the at-cap copy interpolates `{{used}}`/`{{cap}}`). |
| Coverage gate | `server/vitest.config.ts:52-56` enforces **100%** lines/branches/functions/statements; client config likewise. Every new branch (E11000 retry, infinite-cap skip, release rollback, at-cap UI state) ships with the test that covers it in the same commit. |
| Money/pricing frozen | No price changes. `PRICE_MONTHLY_CENTS` / `PRICE_YEARLY_CENTS` (`plans.ts:91-102`) untouched. JSON-LD offers (`client/src/shared/seo/schema.ts:68-87`) carry name+price only — verified to contain no feature lists; do not touch. Hardcoded price displays (`Pricing.tsx:136-141`, `Home.tsx:136`) stay as-is. |
| Docker-only | Every command below runs in `node:20-bookworm` containers per `.claude/rules/docker-only-commands.md`. No bare `npm`/`npx` on the host. |
| Design system | Any UI change follows `.claude/rules/dockstash-design-system.md` (monochrome tokens, no palette classes/hex, `shadow-xs` max) + `.claude/rules/interaction-hygiene.md` (Button `loading`, six states). Copy through `t(...)` only. |
| Exports/types | Named exports only; Mongoose via `InferSchemaType`; zod on every mutating body. |
| Excluded | No queue/scheduler changes, no Polar/webhook changes, no `mirror` changes, no cron-floor changes, no retention changes, no agent-daemon (`agent/`) changes. Local no-agent path **stays functional** — only its UI ordering demotes. |

## Phases

### Phase 0 — Map the model (read before writing)

- 0.1 `server/src/modules/billing/plans.ts` — the `Entitlements` interface
  (:26-40), the matrix (:47-84), `getEntitlements`.
- 0.2 `server/src/modules/billing/entitlements.service.ts` — read the WHOLE
  file: `resolveEntitlements`, `assertMultiVpsAllowed` (:209-221),
  `reserveProjectSlot` (:372), `releaseProjectSlot` (:413),
  `adjustProjectCounter` (:425), `reconcileProjectCounter` (:445). The agent
  helpers must be idiom-identical to the project helpers.
- 0.3 `server/src/modules/billing/usage-counter.model.ts` — `UsageCounter`
  `{ owner (unique), projects (Number, default 0, min 0) }`, timestamps.
- 0.4 `server/src/modules/agents/agents.controller.ts` — the seven
  `assertMultiVpsAllowed` call sites (:43 register, :60 list, :67 rotate,
  :83 delete, :99 fleet, :148 discovery, :160 discovery-refresh) and the
  services they call. Note which are mutations (register/delete) vs reads.
- 0.5 `server/src/modules/backups/backups.controller.ts:61,125` — the
  `agentId` branches in `create` and `patchAgent`.
- 0.6 `server/src/modules/billing/{pricing-tier.model.ts:38,
  pricing-tier.seed.ts:46, billing.service.ts:105,127,144,202,239}` — where
  `flags.multiVps` is modeled, seeded, and serialized to the client.
- 0.7 Client: `client/src/features/fleet/` (types.ts:44, store/thunks.ts:26-38,
  store/slice.ts, store/selectors.ts:6, components/FleetScreen.tsx:142,181-191),
  `client/src/features/billing/` (types.ts:24,60, PricingGrid.tsx:199,
  UsageTab.tsx:211,227-230), and the project-create wizard component that
  orders local-vs-agent targets.
- 0.8 Marketing: `client/src/features/marketing/components/Pricing.tsx:62-117`,
  `FleetAgentsPage.tsx:24`, `content/locale/*/platform.ts`.
- 0.9 Meta-tests that pin this surface:
  `server/src/shared/middleware/entitlement-meta.test.ts:53-54`,
  `idor-meta.test.ts`, `agent-machine-meta.test.ts`.

### Phase 1 — Entitlements model (server)

- 1.1 `plans.ts` — in `Entitlements` replace `multiVps: boolean` (:35) with
  `/** Max registered fleet agents (connected servers). */ agents: number`.
  Matrix rows: `free.agents = 1` (:56), `pro.agents = 5` (:68),
  `business.agents = Number.POSITIVE_INFINITY` (:80). Nothing else moves.
- 1.2 `usage-counter.model.ts` — add `agents: { type: Number, default: 0,
  min: 0 }` beside `projects`. `InferSchemaType` keeps the export honest.
- 1.3 `entitlements.service.ts` — DELETE `assertMultiVpsAllowed` (:209-221).
  ADD, idiom-identical to the project trio:
  - `reserveAgentSlot(userId, deps?: { t?; countAgents? })` — resolve
    entitlements; `agents === Infinity` → return without touching the
    counter; else atomic conditional `$inc` with upsert + E11000 retry;
    on cap-miss throw `HttpError.forbidden(t('billing.entitlements.agentLimitReached'),
    { reason: 'agentLimitReached', used, cap })`.
  - `releaseAgentSlot(userId)` — guarded decrement, never below 0.
  - `reconcileAgentCounter(userId, count)` — absolute set, used by lifecycle
    transitions and the delete path's belt-and-braces reconcile.
- 1.4 Server dictionaries ×7 (`server/src/shared/i18n/dictionaries/{en:89,
  ar:90, zh:90, fr:92, de:92, ru:92, es:92}.ts`) — replace
  `billing.entitlements.multiVpsLocked` with
  `billing.entitlements.agentLimitReached` (translated per locale; message
  states the cap was reached and names the next tier, e.g. en: "Agent limit
  reached for your plan. Upgrade to connect more servers."). Same key in all 7;
  typed dictionary compilation enforces parity.
- 1.5 `pricing-tier.model.ts:38` — `flags.multiVps: Boolean` → move to caps:
  `caps.agents: Number` (store `Infinity` as the model's existing
  infinite-cap convention — follow whatever `projects: Infinity` already does
  in that schema; if it serializes as `null`, do the same). Keep the field
  location consistent with how `projects`/`retentionDays` caps are modeled.
- 1.6 `pricing-tier.seed.ts:46` — seed `caps.agents` from `ENTITLEMENTS`.
  Idempotent upsert by slug, as today.
- 1.7 `billing.service.ts:105,127,144,202,239` — serialize `caps.agents`
  (tier list) and `agents: { used, cap }` (usage payload). `used` comes from
  the `UsageCounter` row (0 when absent), cross-checked by a
  `countAgents(owner)` reconcile helper in the usage read path if one already
  exists for projects — mirror, don't invent.

### Phase 2 — Controller call sites (server)

- 2.1 `agents.controller.ts` register handler (:43) — order per the cap rule:
  `parse → (own n/a) → reserveAgentSlot → create`; wrap create in
  `try/catch` → `releaseAgentSlot` on throw, rethrow. This is the ONLY place
  a slot is taken.
- 2.2 `agents.controller.ts` delete handler (:83) — after the owner-scoped
  delete succeeds, `releaseAgentSlot(userId)`. Never release before the
  delete commits.
- 2.3 `agents.controller.ts` — REMOVE the gate from the five non-mutating /
  maintenance routes (:60 list, :67 rotate, :99 fleet, :148 discovery,
  :160 discovery-refresh). A Free user with 1 registered agent must be able
  to list it, rotate its key, see fleet status, and run discovery. Ownership
  scoping stays exactly as it is.
- 2.4 `backups.controller.ts:61` (`create` with `input.agentId`) and `:125`
  (`patchAgent`) — REMOVE `assertMultiVpsAllowed`. The owner-scoped
  `loadOwnedAgent` existence check remains the entire guard: if you own the
  agent, you may point a project at it; the cap was already paid at
  registration time.
- 2.5 Downgrade lifecycle — over-cap agents on downgrade follow the existing
  project discipline (read it before writing: the `selection-required` /
  paused pattern from prompt 07): agents are NEVER deleted by a plan change;
  excess agents become inert (no new job leases via the user-facing dispatch
  path) until the user picks which stay active or re-upgrades. Wire
  `reconcileAgentCounter` into the same lifecycle transition hook that
  reconciles projects.

### Phase 3 — Server tests (keep 100%)

Vitest + supertest against `createApp()`, `startMemoryMongo`/`clearCollections`.
Update in place — do not fork new suites where an existing file owns the
surface:

- 3.1 `shared/middleware/entitlement-meta.test.ts:53-54` — the static guard
  pinning `assertMultiVpsAllowed` moves to pinning `reserveAgentSlot(` in the
  register handler and `releaseAgentSlot(` in the delete handler. Add a
  negative pin: `assertMultiVpsAllowed` must appear NOWHERE in `server/src`.
- 3.2 `billing/entitlements.test.ts:15,150,270-284` — resolution asserts:
  free→1, pro→5, business→Infinity; grace keeps paid cap; lapse →
  free cap.
- 3.3 `billing/entitlements-cap.test.ts:140-142` — replace the
  free-403-`multiVpsLocked` case with:
  - boundary: free user registers agent #1 (201), agent #2 → 403
    `agentLimitReached` with `{ used: 1, cap: 1 }` details;
  - **concurrency proof**: pro user with 4 agents fires two concurrent
    registers → exactly one 201, one 403 (mirror the existing project-cap
    concurrency test's mechanics);
  - rollback: force the post-reserve create to throw → counter returns to
    its prior value → next register succeeds;
  - infinite: business registers N agents with NO `UsageCounter.agents`
    growth (counter row untouched on the infinite branch);
  - release: delete frees the slot → re-register succeeds;
  - E11000 retry branch covered (first-ever reserve upsert race).
- 3.4 `billing/billing-surface.test.ts:87,247,266` — payload asserts
  `caps.agents` per tier and `agents: { used, cap }` in usage.
- 3.5 Agents module tests — the OSS-mode suite (`agents.test.ts`) gains
  tier-mode cases: gate absence on list/rotate/fleet/discovery for a Free
  user at cap; cross-account isolation unchanged (foreign agent → 404).
- 3.6 Backups module tests — Free user with 1 owned agent can create a
  project with `agentId` (no 403); foreign `agentId` still 404.
- 3.7 Green untouched: `idor-meta.test.ts`, `agent-machine-meta.test.ts`,
  `agent/src/security-meta.test.ts`, `injection-and-output-meta.test.ts`,
  `secrets-meta.test.ts`.

### Phase 4 — Client (fleet, billing, wizard)

- 4.1 `features/fleet/types.ts:44` — `FleetLockedReason = 'agentLimitReached'`.
  `store/thunks.ts:26-38` `lockedReasonFromError` reads the new reason (and
  the `{ used, cap }` details). `store/slice.ts` / `store/selectors.ts:6`
  carry them through.
- 4.2 `FleetScreen.tsx:142,181-191` — the tier-lock card dies. Two states
  replace it:
  - **empty under cap**: agent-first onboarding — install command +
    register CTA (the existing register flow), never a lock;
  - **at cap** (list renders + a banner, or the register CTA disabled with
    an inline upsell): "Using {{used}} of {{cap}} servers on your plan" +
    upgrade CTA to `/billing`. Registered agents stay fully manageable.
- 4.3 `features/billing/types.ts:24,60` — `flags.multiVps: boolean` →
  `caps.agents: number | null` (match server serialization) on both tier and
  usage types. `PricingGrid.tsx:199` matrix row: label "Connected servers",
  values `1 / 5 / Unlimited`. `UsageTab.tsx:211,227-230` — agents
  used-vs-cap row beside projects.
- 4.4 Project-create wizard — reorder targets **agent-first**: the agent
  picker (with a register-an-agent empty state) renders before the local
  host option; local stays selectable and fully functional. No copy that
  calls local the "default".
- 4.5 Client tests updated with their components:
  `FleetScreen.test.tsx:154-155` (new at-cap + empty states), fleet
  `store/{thunks,slice,selectors}.test.ts`, `PricingGrid.test.tsx:30-50`,
  `UsageTab.test.tsx:35`, `BillingPage.test.tsx:71-209`, billing
  `store/slice.test.ts:45,96`, `store/thunks.test.ts:62`, wizard ordering
  test. RTL (`ar`) + dark mode + keyboard reachability on changed components.

### Phase 5 — Marketing, i18n, docs

- 5.1 `marketing/components/Pricing.tsx:62-117` — tier feature lists:
  free gains "1 connected server", pro gains "5 connected servers",
  business's fleet line (:117) rewords to "Unlimited servers". Keys, not
  hardcoded strings.
- 5.2 `FleetAgentsPage.tsx:24` — FAQ entry `fleetAgents.faq.multiVps.*`
  re-keys/re-words: fleets exist on every plan, counts differ; CTA
  `fleetAgents.cta.body` drops "Business plan" exclusivity.
- 5.3 Client locale JSON ×7 (`client/src/shared/i18n/locales/{en,ar,fr,de,es,ru,zh}/`):
  - `common.json` `fleet.locked.{title,body,cta}` (:66-70 en) → at-cap copy
    (title "You've reached your server limit", body interpolates
    `{{used}}`/`{{cap}}`, cta "View plans");
  - `billing.json` `grid.flag.multiVps` (:49 en) → `grid.cap.agents`
    ("Connected servers");
  - `marketing.json`: `pricing.tiers.{free,pro}.features.*` additions,
    `pricing.tiers.business.features.fleet` (:286) reword, `pricing.aeo`
    (:235), `pricing.faq` (:305), `fleetAgents.faq.multiVps.*` (:498),
    `fleetAgents.cta.body` (:513), Business-exclusivity mentions at
    :438, :687, :761, :834. These are SSR'd — this IS the SEO/AEO surface.
- 5.4 `content/locale/{7}/platform.ts` — the "Multi-VPS fleet is a
  Business-tier feature" prose (en:12, de:10, +5) → per-plan counts.
- 5.5 Docs ×7: `docs/plans-and-limits.*.md:15-16` matrix row "Multi-VPS |
  — | — | ✔" → "Connected servers (fleet agents) | 1 | 5 | Unlimited";
  `docs/fleet-agents.*.md:11` Business-tier sentence → per-plan counts.
- 5.6 `ARCHITECTURE.md` entitlements section + `CHANGELOG.md` entry.

### Phase 6 — Sweep

- 6.1 `grep -rn "multiVps\|multiVpsLocked\|assertMultiVpsAllowed"` across
  `server/src client/src agent/src docs/` → **zero hits** (historical
  `prompts/` files exempt).
- 6.2 i18n parity: every added/renamed key present in all 7 locales in all
  four stores (client JSON, server dictionaries, marketing content modules,
  docs).
- 6.3 Design-system greps from `.claude/rules/dockstash-design-system.md` §8
  clean on touched files.

## Tests (summary of the hard cases)

Server: cap boundary at 1 and 5; concurrency (two registers, one slot);
reserve-rollback on create throw; infinite-cap counter untouched;
delete-releases-slot; E11000 retry; downgrade reconcile + never-delete;
foreign-owner 404s unchanged; `agentLimitReached` carries `{ used, cap }`;
meta-test pins moved. Client: at-cap banner vs empty-state onboarding branch;
`lockedReasonFromError` new reason + details; grid/usage render caps;
wizard agent-first ordering; `ar` RTL render. **Both suites at 100%
coverage, zero skipped tests, zero `.only`.**

## Acceptance Criteria (all must pass, in order)

```bash
# typecheck
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run typecheck
# lint (bans + no-console + restricted imports all still active)
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run lint
# full suites — 100% lines/branches/functions/statements enforced by config
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm test
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm test
# security meta-tests explicitly (belt and braces)
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/shared/middleware/entitlement-meta.test.ts \
                 src/shared/middleware/idor-meta.test.ts \
                 src/shared/middleware/agent-machine-meta.test.ts
docker run --rm -v "$PWD/agent":/app -w /app node:20-bookworm \
  npx vitest run src/security-meta.test.ts
# dead-reference sweep — MUST return nothing:
grep -rn "multiVps" server/src client/src agent/src docs/ \
  --include='*.ts' --include='*.tsx' --include='*.md' --include='*.json'
```

## Agents & Skills

- **Agents:** `backend-dev` (matrix, reservation helpers, controllers,
  lifecycle, server tests); `react-specialist` (fleet/billing/wizard UI +
  client tests); `security-auditor` (read-only pass over the gate removal —
  confirm owner-scoping alone is sufficient on every route that lost the
  plan gate).
- **Skills:** `dockstash-design` (at-cap banner, grid row, wizard states);
  `code-review` (final pass); `verify` (end-to-end: Free registers agent #1,
  blocked on #2 with the localized message, deletes, re-registers; Pro to 5;
  fleet screen shows the at-cap upsell, not the old tier lock).

## Idempotency Contract

Re-running MUST NOT: double-reserve a slot for an existing agent, re-seed
`PricingTier` over edited rows (upsert by slug), stack a second reserve call
on the register path, drift the `UsageCounter.agents` value (reconcile is
absolute, reserve/release are paired), duplicate i18n keys, or re-apply the
downgrade selection state. Every run converges: matrix is the typed default,
the seed reconciles, counters reconcile from actual agent counts.
