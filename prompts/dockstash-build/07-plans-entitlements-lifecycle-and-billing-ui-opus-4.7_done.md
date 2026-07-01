# Plans, Entitlements, Lifecycle & Billing UI — Build Prompt

> **Turn subscriptions into enforced product limits** — an in-memory entitlements
> matrix (`free`/`pro`/`business`), a data-backed `PricingTier` model, server-side
> caps on Backup-Now and schedule-create, the full dunning/lapse/downgrade
> lifecycle (backups **never** deleted), and a Shadcn billing UI with `?tab=` state.

---

## Agent

`backend-dev` (owns `server/src/modules/billing/plans.ts`, `polar-config.ts`, the
`PricingTier` model, the entitlement guards, and the lifecycle state machine).
Coordinate with `react-specialist` (the pricing grid + billing page in
`client/src/features/billing/`).

## Mission

Prompt 06 made Polar the active provider and built the webhook pipeline that
writes `Subscription`/`Customer`/`Order`. This prompt makes those rows **mean
something**, per `IDEA.md` §3 (matrix/config) and §4 (subscription model +
lifecycle edge cases):

1. An **entitlements matrix** (`plans.ts`) keyed by plan slug with per-project caps
   + feature flags, and a `PricingTier` Mongo model that mirrors it (data-backed,
   editable without redeploy).
2. **Server-side enforcement** on Backup-Now and schedule-create (block + prompt to
   upgrade when over cap).
3. The **lifecycle edge cases**: dunning/grace, lapse → read-only (no deletion),
   downgrade-over-cap selection, refund → Free, trial-abuse guard.
4. A **client billing surface**: pricing grid (checkout vs in-app changePlan) and a
   billing page with `?tab=` Overview + Usage.

Mirror pulsy `apps/server/src/billing/{plans.ts, pulsy-polar-config.ts}`.

## Operating Constraints

| Rule | Detail |
|---|---|
| OSS-default | The **Free** tier is the open-source / self-host default and is **fully functional without any paid provider configured**. Billing only *gates*; it never *is* the feature. Never put core backup behavior behind a Polar call. |
| Product_id source of truth | `polar-config.ts` maps plan-slug ↔ Polar product UUID **and** a reverse `getPlanForProductId(productId)`. Resolve a subscription back to a plan via `product_id`, never via checkout metadata (not guaranteed to propagate). |
| Server-side enforcement | Caps are enforced in the **service layer** (not the client). Over-cap Backup-Now / schedule-create → `HttpError.forbidden()` (`server/src/shared/utils/http-error.ts`) carrying an upgrade-prompt reason code. |
| Backups never deleted | A lapse makes backups **read-only** (no new runs beyond Free cap), retained for a grace window before any pruning. Downgrade-over-cap **never** silently deletes — the user picks which project stays active. |
| Merchant of Record | Polar is MoR — it handles VAT/sales-tax + invoicing. **Do not build a tax engine.** Note this in code + docs. |
| Token boundary | The access token **never reaches the client**. New users get a checkout redirect URL; existing paid users hit an in-app `changePlan` (proration handled by Polar). |
| Data-backed pricing | `PricingTier` rows carry `productId` (nullable for Free) + caps/flags mirroring the matrix, so pricing is editable without a redeploy. The matrix in `plans.ts` is the typed default/seed. |
| Tab state in URL | The billing page persists the active tab in `?tab=` (Overview/Usage), `replace: true`, invalid → default. See `.claude/rules/url-tab-state.md`. Never `useState` for tab state. |
| UI honesty | Shadcn + anti-Codex per `.claude/rules/ui-ux-patterns.md`: flat borders, 6px button / 8px card radius, 150ms `color`/`opacity` transitions only, no gradients/card-lift/pulse. Loading/empty/error states everywhere. |
| Typed schemas | `PricingTier` via `InferSchemaType`, type exported, explicit `{ timestamps: true }`, enum literal slugs. See `.claude/rules/mern-mongoose-typed-schemas.md`. |
| Named exports | No `export default`. See `.claude/rules/mern-no-default-exports.md`. |
| Excluded | No webhook/provider work (prompt 06 owns it); no email sending here (prompt 08 owns Resend dunning/receipt mail — this prompt only emits the lifecycle state transitions those emails react to). |

## Phases

### Phase 0 — Map the model
- 0.1 Read prompt 06's `server/src/modules/billing/`: the `Subscription`/
  `Customer`/`Order` models, `IPaymentProvider`, `active-provider.ts`, and the
  webhook `registry.ts` (the lifecycle events that drive status).
- 0.2 Read `server/src/modules/users/users.model.ts` (provider-neutral
  `customer`/`subscription` refs from prompt 06).
- 0.3 Read the project/schedule modules that expose **Backup-Now** and
  **schedule-create** (the backup-core + scheduler prompts) to find the exact
  service entry points where caps must be enforced.
- 0.4 Read `client/src/features/billing/`: `api.ts`, `index.ts`
  (`billingReducer`/`billingRoutes`/`selectCustomer`), `routes.tsx`, `store/
  {slice,thunks,selectors}.ts`, `components/`, and `client/src/shared/api/client.ts`
  (`apiClient<T>`). Read `client/src/app/store.ts` + `router.tsx` for registration.
- 0.5 Read pulsy `billing/plans.ts` + `pulsy-polar-config.ts` for the matrix +
  reverse-lookup idiom.

### Phase 1 — Entitlements matrix & config
- 1.1 `server/src/modules/billing/plans.ts` — typed in-memory `ENTITLEMENTS`
  keyed by slug `free`/`pro`/`business`:
  - `projects`: `1` / `10` / `Infinity`
  - `retentionDays`: `7` / `30` / `90`
  - `frequency`: `'daily'` / `'hourly'` / `'any-cron'`
  - flags: `schedules` (false/true/true), `emailAlerts` (false/true/true),
    `multiVps` (false/false/true).
  Export `getEntitlements(slug)` and the `Entitlements` type.
- 1.2 `polar-config.ts` — `PLAN_TO_PRODUCT` (slug → product UUID from
  `POLAR_PRO_PRODUCT_ID`/`POLAR_BUSINESS_PRODUCT_ID`; Free → `null`) **and** the
  reverse `getPlanForProductId(productId)`. Include yearly variants (`pro_yearly`/
  `business_yearly`) priced at **10× monthly ("2 months free")**.
- 1.3 `pricing-tier.model.ts` — `PricingTier` { slug (unique), name, priceMonthly,
  priceYearly, productId (nullable), interval, caps/flags mirroring the matrix,
  active }. A seed reconciles rows from `plans.ts` (idempotent upsert by slug).

### Phase 2 — Entitlement resolution & enforcement
- 2.1 `entitlements.service.ts` — `resolveEntitlements(userId)`: read the user's
  `Subscription`; map `status` → effective slug (active `pro`/`business` →
  that tier; `past_due` within grace → keep paid entitlements; lapsed/`canceled`/
  `revoked`/no-sub → `free`). With **no paid provider configured**, default to the
  OSS ceiling so self-hosters are unrestricted.
- 2.2 Enforce in the service layer: on **Backup-Now**, count the user's active
  projects vs `entitlements.projects`; on **schedule-create**, check
  `entitlements.schedules` + `frequency`. Over cap → `HttpError.forbidden()` with an
  upgrade-prompt reason code (e.g. `projectLimitReached`, `schedulesLocked`,
  `frequencyNotAllowed`). Localized message via `t()`.
- 2.3 Retention: clamp `forget --prune` keep-windows to `entitlements.retentionDays`
  (enforced where retention jobs are configured).

### Phase 3 — Lifecycle state machine
Driven by the prompt-06 webhook events; this phase owns the **transitions**:
- 3.1 **Dunning.** `order` failed renewal → `Subscription.status='past_due'` →
  start a **~14-day grace** (track `graceEndsAt`). During grace, entitlements stay
  at the paid tier; emit a `dunning` lifecycle event (prompt 08 sends the email).
  Only at grace expiry → downgrade to Free entitlements.
- 3.2 **Lapse → read-only (never delete).** On downgrade, existing backups are
  **retained read-only**; no new runs beyond the Free cap; nothing is pruned within
  the grace window. Mark over-cap projects `readOnly`/`paused`, not deleted.
- 3.3 **Downgrade over-cap.** Pro(10) → Free(1) with 8 projects: **no silent
  deletion**. Set the account to a `selection-required` state; expose an endpoint
  for the user to pick which project stays active; the rest become `paused`/
  read-only until re-upgrade.
- 3.4 **Refund / chargeback.** `order.refunded` → revoke entitlement → Free.
- 3.5 **Trial-abuse guard.** If a trial is offered, enforce **one trial per
  customer email** (a `trialedEmails` guard on `Customer`/account).
- 3.6 Note Polar = MoR in code comments + docs; no tax computation.

### Phase 4 — Client billing surface
- 4.1 `client/src/features/billing/api.ts` — thin wrappers over `apiClient<T>`:
  `fetchPricingTiers`, `fetchUsage`, `createCheckout`, `changePlan`,
  `selectProjectToKeep`. The access token is never requested or returned.
- 4.2 **Pricing grid** component: renders the three tiers (monthly/yearly toggle)
  from `PricingTier` data. New users → `createCheckout` → `window.location.href =
  url`; existing paid users → in-app `changePlan` (proration via Polar). Loading /
  empty / error states; Shadcn; anti-Codex.
- 4.3 **Billing page** with `?tab=` URL state:
  - `Overview` — plan, status (incl. `past_due`/grace countdown), renewal date.
  - `Usage` — projects used vs cap, retention, frequency; an upgrade CTA when over
    cap; the downgrade-over-cap **project selection** UI when `selection-required`.
- 4.4 Register the reducer in `client/src/app/store.ts` and routes in
  `client/src/app/router.tsx` (extend existing `billingReducer`/`billingRoutes`).
  RTL (`ar`), dark-mode, keyboard-reachable, visible focus.

### Tests
Server (`server/`, vitest, `fileParallelism:false`, v8 coverage, supertest against
`createApp()`, `startMemoryMongo`/`stopMemoryMongo`/`clearCollections`): **100%
coverage** (lines/branches/functions/statements). Polar REST client mocked.
- Enforcement: Free user at 1 project → Backup-Now on a 2nd project → `403`
  `projectLimitReached`; Free user schedule-create → `403` `schedulesLocked`;
  Pro hourly allowed, Free daily-only; retention clamped per tier.
- Reverse lookup: `getPlanForProductId` resolves each product UUID to its slug;
  unknown id → `free`/`null` (documented default).
- Lifecycle: `past_due` keeps paid entitlements until `graceEndsAt`, then Free;
  lapse leaves backups **present** and read-only (assert none deleted/pruned);
  downgrade-over-cap sets `selection-required` and **no deletion**; the selection
  endpoint activates exactly one project, pauses the rest; `order.refunded` → Free;
  trial-abuse guard blocks a second trial for the same email.
- `PricingTier`: seed upserts idempotently from `plans.ts`; editing a row changes
  served pricing without code change.
Client (`client/`, vitest + RTL, jsdom): mock the **service layer**.
- Pricing grid renders 3 tiers + monthly/yearly toggle; new-user CTA calls
  `createCheckout`; existing-paid CTA calls `changePlan`; loading/empty/error.
- Billing page: tab state lives in `?tab=` (refresh-safe, invalid → default);
  Usage shows used-vs-cap; downgrade selection UI appears in `selection-required`.
- RTL (`ar`) renders mirrored; access token never present in any client payload.

### i18n
7 locales — **en, ar, fr, de, es, ru, zh** — auto-detect + RTL (`ar`). **Client
UI** (pricing grid, billing tabs, usage, upgrade prompts, downgrade-selection copy)
localized via the prompt-01 client i18n; **backend messages** (the `HttpError.
forbidden()` reason strings + success messages) localized server-side via `t(key,
vars)` + `req.language`. Identical interpolation vars across locales. Key-parity
tests assert every billing key exists in all 7 langs.

### Documentation
- `/docs`: a "Plans & limits" page (the matrix, what each tier unlocks, lifecycle:
  dunning/grace, lapse-read-only, downgrade selection, MoR/tax note). User-facing →
  all 7 locales.
- `ARCHITECTURE.md`: the entitlements matrix, `PricingTier`, enforcement points,
  the lifecycle state machine.
- `.env.example`: confirm `POLAR_PRO_PRODUCT_ID`/`POLAR_BUSINESS_PRODUCT_ID` are
  documented (added by prompt 02). `CHANGELOG.md` entry.

## Agents & Skills

- **Agents:** `backend-dev` (primary — matrix, config, `PricingTier`, guards,
  lifecycle); `react-specialist` (pricing grid + billing page).
- **Skills:** `shadcn-design-system-compliance` (the pricing grid + billing UI);
  `ui-ux-pro-max` + `ui-ux-pro-max-design-system` (layout/states); `pricing-strategy`
  (tier framing); `code-review` (final pass); `verify` (exercise an over-cap block
  + a downgrade-selection flow end-to-end).

## Idempotency Contract

Re-running MUST NOT: duplicate `PricingTier` rows (upsert by unique slug), re-seed
over edited pricing, stack a second enforcement guard on the same service entry
point, re-register the billing reducer/routes, or re-apply a lifecycle transition
already recorded on the `Subscription`. The matrix is a pure default; the seed
reconciles to the same rows; enforcement and lifecycle transitions are computed
from current subscription state, so every run converges to the same final state.
