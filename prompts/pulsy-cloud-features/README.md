# Pulsy Cloud — Remaining Tier-Feature Build Prompts

These four prompts finish the Team-tier (`team_*`) entitlements that the billing
series (`prompts/pulsy-cloud-polar_done/`) defined but left **gated without a
real feature behind them**. Each is a standalone, end-to-end build prompt
(backend + DB/migration + UI + i18n×5 + tests + docs + env + idempotency),
matching the format of the `00`–`10` polar prompts.

| # | Feature | Today's state | File |
|---|---|---|---|
| 11 | Monthly SLA reports (PDF + email) | `slaReport` returns JSON only — no PDF, no delivery | `11-sla-reports-pdf-and-email-opus-4.8.md` |
| 12 | Custom-domain status pages | Entitlement + guard exist; no status-page entity, no domain column, no routing | `12-custom-domain-status-pages-opus-4.8.md` |
| 13 | Full API access | `apiAccess` entitlement + guard exist; no API keys, no token auth, no REST routes | `13-public-api-and-api-keys-opus-4.8.md` |
| 14 | Priority support | Boolean flag never read anywhere | `14-priority-support-opus-4.8.md` |

## Agents & skills matrix

Agents and skills referenced come from the project Agent registry and the Skill
tool. Run a `security-review` skill pass on #12 and #13 before merging.

| Prompt | Primary agent | Supporting agents | Skills |
|---|---|---|---|
| 11 SLA reports | `uptime-monitor-specialist` | `ui-designer`, `translation-manager`, `backend-i18n-developer` | `uptime-monitor`, `ui-ux-pro-max`, `ui-ux-pro-max-design-system`, `shadcn-design-system-compliance`, `polar-provider`, `verify`, `run`, `code-review` |
| 12 Status pages | `uptime-monitor-specialist` | `ui-designer`, `translation-manager` | `uptime-monitor`, `ui-ux-pro-max`, `shadcn-design-system-compliance`, `security-review`, `verify`, `run`, `code-review` *(nextjs-seo N/A — Vite SPA)* |
| 13 Public API | `uptime-monitor-specialist` | `ui-designer`, `translation-manager`, `legal-pages-manager` | `uptime-monitor`, `security-review` *(required)*, `polar-provider`, `polar-api`, `ui-ux-pro-max`, `shadcn-design-system-compliance`, `verify`, `code-review` |
| 14 Priority support | `uptime-monitor-specialist` | `ui-designer`, `translation-manager`, `legal-pages-manager` | `uptime-monitor`, `ui-ux-pro-max`, `shadcn-design-system-compliance`, `legal-content-generator`, `verify`, `code-review` |

## Shared context every prompt assumes

- **Entitlement source of truth:** `apps/server/src/billing/plans.ts`
  (`ENTITLEMENTS_BY_PLAN`, `PulsyEntitlements`). Guards:
  `apps/server/src/billing/tier-guard.ts`. Resolver:
  `getPulsyEntitlements(db, { userId })` in
  `apps/server/src/billing/pulsy-entitlements.ts`. All six guards already exist
  (`assertWithinMonitorLimit`, `assertCheckIntervalAllowed`,
  `assertWithinStatusPageLimit`, `assertCustomDomainAllowed`,
  `assertApiAccessLevel`, `assertSlaReportsAllowed`).
- **OSS-default behavior (critical):** with `FEATURE_FLAG_PAYMENTS` off,
  `getPulsyEntitlements` returns `team_yearly` (the ceiling). So **every feature
  below must be fully functional for self-hosters** — billing only *gates* it; it
  never *is* the feature. Never put core behavior behind a Polar call.
- **Frontend gate idiom:** `useBillingEntitlements()`
  (`apps/web/src/hooks/billing/useBilling.ts`) → `{ paymentsEnabled,
  entitlements, usage }`. `!paymentsEnabled` ⇒ render free; entitlement false ⇒
  `<UpgradePrompt reason=… />` (`components/billing/upgrade-prompt.tsx` — the
  reason codes `slaReportsLocked` / `customDomainLocked` / `apiAccessLocked` /
  `statusPageLimitReached` **already exist**, copy at `upgrade.blocked.*`); else
  the feature. Pre-submit gates follow `useIntervalUpgradeGate.ts`. Service +
  hook + `uptimeKeys` factory; calls via `trpcQuery/trpcMutation`
  (`apps/web/src/lib/api/trpc.ts`).
- **Tests:** vitest with **100% v8 coverage enforced** on `apps/server`,
  `packages/db`, and `apps/web` (the web config gates only its `include` globs —
  `hooks/**`, `services/**`, `components/uptime/**` — so place new UI there or
  extend the globs). Server tests use a real Postgres (testcontainers,
  `fileParallelism:false`); helpers: `apps/server/test/trpc-caller.ts`
  (`authedCaller`/`publicCaller`), `apps/server/test/db.ts` (`useCleanDatabase`,
  `createTest*` factories, the `ALL_TABLES` truncate order — **every new table
  must be added there + given a factory**), `apps/server/test/fetch-mock.ts`,
  `apps/web/src/test/query-wrapper.tsx` (`createWrapper`; mock the **service
  layer**, not tRPC).
- **i18n:** backend keys in the per-locale `DICTIONARIES`
  (`apps/server/src/lib/i18n.ts`); add to all 5 langs and extend the
  completeness list in `apps/server/src/lib/i18n.test.ts`. Frontend namespaces in
  `apps/web/public/locales/{en,ar,fr,de,es}/*.json` with identical interpolation
  vars.
- **Validation:** `api{Action}{Entity}` Zod in
  `packages/db/src/schema/validation.ts` (`.default()`, enum reuse,
  `.superRefine()` + `requireField()` for conditionals).
- **Migrations:** `pnpm --filter @pulsy/db generate` (auto-named
  `00NN_<words>.sql` + `drizzle/meta/_journal.json`); applied via `make migrate`
  / entrypoint `drizzle-kit push --force`. Never hand-edit snapshots.
- **Security rules (always loaded):** `tob-authorization` (scope every query by
  `ctx.user.id`), `tob-input-validation` (Zod everywhere; `escapeHtml()` from
  `apps/server/src/lib/html.ts` for any user value in HTML/PDF; `safeFetch()` from
  `apps/server/src/lib/ssrf.ts` for any user-supplied outbound URL),
  `tob-secrets` (AES-256-GCM via `ENCRYPTION_KEY`; no fallback secrets; hash
  long-lived tokens with `createHash("sha256")` in `lib/crypto.ts`).
- **Backend wiring:** tRPC ctx (`ctx.user`, `ctx.t`, `ctx.language`) from
  `apps/server/src/trpc/trpc.ts`; routers assembled in
  `apps/server/src/trpc/router.ts`; Express mount order in
  `apps/server/src/index.ts` (cors → `/api/auth/*` → raw webhook →
  `express.json()` → `/api/trpc`); cron via `scheduleJob` + `shutdownScheduler`/
  `cancelAllJobs`; non-tRPC route template in
  `apps/server/src/webhooks/payment-route.ts`. better-auth has **no apiKey/bearer
  plugin** (`apps/server/src/auth/auth.ts`).
- **Docs:** `ARCHITECTURE.md` (§4 infra, §5 tables, §6 API, §8 patterns, §9 env)
  per `.claude/rules/architecture-doc-maintenance.md`; `docs/`; root `.env.example`
  (sectioned, root-only); `CHANGELOG.md`.
- **Docker-only dev** (`pulsy-*` containers); pinned deps from public npm only;
  conventional commits.

## Convention

Run them in order (`11` → `14`); they are independent but `12` and `13` both
touch the public/Express surface, so landing `12` first avoids a route-precedence
merge. On completion, rename the file with a `_done` suffix (see
`prompts/RENAME-PROMPT-FILE.md`).
