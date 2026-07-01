# Monthly SLA Reports — PDF Generation & Email Delivery — Build Prompt

> **Turn the gated JSON stub into a real product** — render a branded SLA/uptime
> PDF, expose it as a monitor-detail **tab** (Team only; free for self-hosters),
> and email it automatically on the 1st of every month to chosen recipients.

---

## Agent

`uptime-monitor-specialist` (owns `apps/server/src/trpc/routers/uptime.ts`, the
`services/uptime/*` services, the `node-schedule` scheduler, and
`stats-service.ts`). Coordinate with `ui-designer` (the detail tab),
`translation-manager` + `backend-i18n-developer` (5-locale strings, both sides).

## Mission

Today `uptimeMonitor.slaReport` (a `protectedProcedure` at
`apps/server/src/trpc/routers/uptime.ts:644-672`) is gated on
`assertSlaReportsAllowed` and returns a JSON blob (`{ uptimeMonitorId,
monitorName, url, windowDays, generatedAt, stats }`) from `getMonitorStats()`.
There is **no PDF and no delivery**. Build the full feature:

1. A reusable **SLA report builder** service (report model + PDF render).
2. **On-demand view + PDF download** from a new monitor-detail tab.
3. **Scheduled monthly email** of the prior month's report through the user's
   configured email provider, opt-in per monitor or account-wide.

## Operating Constraints

| Rule | Detail |
|---|---|
| Entitlement gate | Reuse `assertSlaReportsAllowed(entitlements, ctx.t)` (`apps/server/src/billing/tier-guard.ts`) on every new procedure. Error key `errors.tierSlaReportsNotAllowed` already exists in all 5 locales (`apps/server/src/lib/i18n.ts`). |
| OSS-default | `getPulsyEntitlements()` returns `team_yearly` when `FEATURE_FLAG_PAYMENTS` is off (`apps/server/src/billing/plans.ts`), so `slaReports:true` — self-hosters get reports free. Never call Polar in the feature path. |
| Reuse stats | Build on `getMonitorStats()` in `apps/server/src/services/uptime/stats-service.ts`. Extend it (don't fork) for monthly windows / per-incident breakdowns. Pull incidents from `uptime_incident`. |
| Email transport | Reuse `sendViaProvider(provider, to, subject, html)` in `services/uptime/email-provider-service.ts`; resolve the owner's provider via `findEmailProviderById` / `findEmailProvidersByUser`. Decrypt creds server-side only (`lib/crypto.ts` `decrypt`); never log or return them. Do NOT add a new transport. |
| HTML/PDF safety | Every user value (`monitor.name`, `url`, recipients) MUST pass `escapeHtml()` (`apps/server/src/lib/html.ts`) before HTML/PDF text. See `.claude/rules/tob-input-validation.md`. |
| Deliverability | Links use `SITE_URL` (no raw IP/port); `fromAddress` is the provider's verified address. See `.claude/rules/email-deliverability.md`. |
| PDF dependency | One pinned, public-npm, pure-JS generator — **`pdfkit`** (no headless Chromium, no native build deps in the server image). Pin the exact version in `apps/server/package.json`. |
| Scope | Every query scoped by `ctx.user.id`; reuse `findOwnedMonitorOrThrow` for monitor access (already in `uptime.ts`). Zod on every input. |
| Excluded | No CSV/XLSX, no white-label theming, no per-incident root-cause narrative. |

## Phases

### Phase 0 — Map the model
- 0.1 Read `uptime.ts:644-672` (`slaReport`), `stats-service.ts`
  (`getMonitorStats` return shape), `email-provider-service.ts`
  (`sendViaProvider`, finders), and `apps/server/src/index.ts:96-135` (the
  `scheduleJob("uptime-daily-cleanup", "0 3 * * *", …)` pattern + `runDailyCleanup`)
  and `services/uptime/scheduler-service.ts` (`shutdownScheduler` / `cancelAllJobs`).
- 0.2 Decide the window contract: keep on-demand `days` (1–366) AND add a
  calendar-month mode (prior full month) for the scheduled job.

### Phase 1 — Schema & migration
Add to `packages/db/src/schema/uptime-monitor.ts` (next to the `uptime_*` tables):
```
uptime_sla_report_subscription
  slaReportSubscriptionId  text pk ($defaultFn nanoid)
  uptimeMonitorId          text fk -> uptime_monitor (onDelete cascade)  -- NULL = all of the user's monitors
  userId                   text fk -> user (onDelete cascade)
  recipientAddresses       text[] notnull
  emailProviderId          text fk -> uptime_email_provider (onDelete set null)
  active                   boolean notnull default true
  lastSentAt               text
  createdAt                text notnull ($defaultFn ISO)
  index (userId); index (active)
```
- 1.1 Add relations + `$inferSelect/$inferInsert` exports (mirror existing tables).
- 1.2 Add Zod schemas to `packages/db/src/schema/validation.ts` —
  `apiUpsertSlaReportSubscription` / `apiRemoveSlaReportSubscription` /
  `apiSlaReport` (`days: z.number().int().min(1).max(366).default(30)`), using
  the `api{Action}{Entity}` + `.default()` idiom (template:
  `apiCreateUptimeMonitor`). Validate `recipientAddresses` as `z.string().email()` array.
- 1.3 Generate the migration: `pnpm --filter @pulsy/db generate` (drizzle-kit,
  auto-named `00NN_<words>.sql` + `drizzle/meta/_journal.json`). Never hand-edit
  the snapshot. Applied via `make migrate` / entrypoint `drizzle-kit push --force`.

### Phase 2 — Report builder service
New `apps/server/src/services/uptime/sla-report-service.ts`:
- 2.1 `buildSlaReportModel({ monitorId, userId, window })` → typed model: uptime %,
  total/successful/failed checks, avg/min/max/p95 response time, incident count +
  total downtime seconds + longest incident, window bounds, per-day uptime series.
  Stats math stays in `stats-service.ts`; this only assembles.
- 2.2 `renderSlaReportPdf(model)` → `Buffer` (branded header, monitor name+url,
  SLA % headline, incidents table, generated-at + window). Every value escaped.
- 2.3 `renderSlaReportEmailHtml(model)` → string (summary + a "Download full PDF"
  link to `${SITE_URL}/...`, all values escaped).
- 2.4 `runMonthlySlaReports()` (used by the cron, Phase 4).

### Phase 3 — tRPC sub-router (`uptimeMonitor.slaReport.*`)
Refactor the lone `slaReport` query into a sub-router under `uptimeRouter`
(`uptime.ts`); preserve the existing path as `slaReport.data` or add a one-line
deprecation shim — note the breaking change in the prompt output.
- `data` — JSON model (today's behavior, now via the builder).
- `download` — returns `{ filename, mimeType: "application/pdf", base64 }`
  (acceptable for monthly-report sizes) OR delegate to the Phase 5 Express route
  (recommended). Pick one; document it.
- `subscription.list / upsert / remove / sendNow` — manage the opt-in table;
  `sendNow` triggers an immediate send for testing.
- ALL gated by `assertSlaReportsAllowed`, Zod-validated, `userId`-scoped; throw
  via the `notFound` / `badRequest` helpers already in `uptime.ts`.

### Phase 4 — Scheduled monthly job
- 4.1 In `index.ts`, beside `uptime-daily-cleanup`, register
  `scheduleJob("uptime-monthly-sla", "0 6 1 * *", () => void runMonthlySlaReports())`.
- 4.2 `runMonthlySlaReports()`: iterate active subscriptions, **re-resolve each
  owner's entitlements** and skip if `slaReports` is false (covers downgrades),
  build the prior-month PDF, send via the owner's provider with the PDF attached,
  stamp `lastSentAt`. One failing send must not abort the loop (log + continue,
  mirroring notification dispatch).
- 4.3 Ensure the job is cancelled on shutdown (it is, if registered via
  `scheduleJob` — `cancelAllJobs()` cancels all node-schedule jobs; verify).

### Phase 5 — Authenticated PDF route (recommended)
- Mount `GET /api/reports/sla/:monitorId.pdf?days=` in `index.ts` AFTER
  `express.json()` (preserve the mount order: cors → `/api/auth/*` → raw webhook
  → `express.json()` → `/api/trpc` → this). Resolve the session like
  `trpc/trpc.ts` `createContext` does (`auth.api.getSession({ headers })`),
  re-run entitlement + ownership guards, set `Content-Disposition: attachment`.

### Phase 6 — Frontend (monitor-detail tab)
- 6.1 **Service:** add `getSlaReport`, `downloadSlaReportPdf`, and the 4
  subscription methods to `apps/web/src/services/uptime/uptimeService.ts` via
  `trpcQuery`/`trpcMutation` (`apps/web/src/lib/api/trpc.ts`).
- 6.2 **Hooks + keys:** new `apps/web/src/hooks/uptime/useUptimeSlaReport.ts`;
  add a `slaReports.*` group to `uptimeKeys` (`hooks/uptime/queryKeys.ts`). Never
  ad-hoc keys.
- 6.3 **Tab:** add `tabs/sla-report-tab.tsx` under
  `apps/web/src/components/uptime/monitor-detail/tabs/`; register it in the tab
  union + `validateSearch` of `apps/web/src/routes/_app/dashboard_.uptime.$monitorId.tsx`
  (URL tab state per `.claude/rules/url-tab-state.md`).
- 6.4 **Gate (idiom):** read `useBillingEntitlements()`
  (`apps/web/src/hooks/billing/useBilling.ts`) → `{ paymentsEnabled,
  entitlements, usage }`. If `!paymentsEnabled` → render the tab (OSS-free); else
  if `!entitlements.slaReports` → render `<UpgradePrompt reason="slaReportsLocked" />`
  (`components/billing/upgrade-prompt.tsx` — the reason code **already exists**);
  else render the report + download + "email monthly" controls (recipients +
  provider picker). Uncodixify, RTL, dark-mode, 44px targets; `Loader2 animate-spin`.

### Tests
Server (`apps/server/`, vitest, real Postgres via testcontainers,
`fileParallelism:false`, **100% v8 coverage enforced** — statements/branches/
functions/lines): use `authedCaller({id})` / `publicCaller()`
(`apps/server/test/trpc-caller.ts`), factories + `useCleanDatabase()`
(`apps/server/test/db.ts`), and `mockFetch()` (`apps/server/test/fetch-mock.ts`).
- **Add `uptime_sla_report_subscription` to `ALL_TABLES` (cascade-safe order) and
  a `createTestSlaReportSubscription` factory in `apps/server/test/db.ts`.**
- Builder: fixture check-logs → exact uptime %, incident counts, downtime totals,
  p95; empty-window + single-incident edge cases.
- PDF: `renderSlaReportPdf` returns a non-empty `Buffer` whose first bytes are
  `%PDF`; snapshot the model, not the binary.
- Procedures: simulate `slaReports:false` → `TRPCError` w/
  `errors.tierSlaReportsNotAllowed`; Team caller succeeds; cross-user id →
  `NOT_FOUND`; Zod rejects `days` out of 1–366.
- Scheduler: `runMonthlySlaReports` sends to each active sub, skips downgraded
  owners, stamps `lastSentAt`, continues past a throwing `sendViaProvider` (assert
  the second recipient still receives) — assert via `mockFetch` / a mocked send.
- Injection: a monitor named `<img onerror=...>` appears escaped in email HTML + PDF.
- Validation: `apiUpsertSlaReportSubscription` rejects a bad email.
Web (`apps/web/`, jsdom, **100% coverage** on the configured `include` globs —
`components/uptime/**` is in scope): mock the **Service layer**, use
`createWrapper()` (`apps/web/src/test/query-wrapper.tsx`). Gated tab hides
controls + shows the upgrade prompt without entitlement; download calls the
service; recipients form validates. OSS regression: payments-off renders the tab.

### i18n
- Frontend `slaReport.*` block in all 5 `apps/web/public/locales/*/uptimeMonitor.json`
  (download, email monthly, recipients, provider, sent) — identical interp vars.
  Ensure `upgrade.blocked.slaReportsLocked` exists in all 5 (billing namespace).
- Server: PDF/email subject+body strings as a `slaReport.*` group added to
  `DICTIONARIES` in `apps/server/src/lib/i18n.ts` (all 5 langs), rendered in the
  owner's language; extend the key-completeness list in
  `apps/server/src/lib/i18n.test.ts` (presence + placeholder parity). No hardcoded
  user-facing strings.

### Documentation
- `ARCHITECTURE.md`: new table (§5), the `slaReport.*` sub-router + PDF route (§6),
  the monthly scheduled job (§8). Per `.claude/rules/architecture-doc-maintenance.md`.
- `docs/`: a short "SLA reports" page (what's measured, the monthly email, plan).
- `.env.example`: no new required var beyond `SITE_URL`; note if you add a
  branding URL. `CHANGELOG.md` entry. Docker-only dev (`pulsy-*`).

## Agents & Skills

- **Agents:** `uptime-monitor-specialist` (primary backend + scheduler),
  `ui-designer` (the detail tab), `translation-manager` + `backend-i18n-developer`
  (5-locale strings on web + server).
- **Skills:** `uptime-monitor` (feature map/conventions); `ui-ux-pro-max` +
  `ui-ux-pro-max-design-system` + `shadcn-design-system-compliance` (the tab UI);
  `polar-provider` (entitlement-resolver context); `verify` + `run` (exercise the
  download + a `sendNow` end-to-end); `code-review` (final pass).

## Idempotency Contract

Re-running MUST NOT: add a second `scheduleJob("uptime-monthly-sla", …)`,
duplicate the subscription table/migration or its `ALL_TABLES`/factory entry,
re-add the PDF route, re-register the tab, or stack the guard twice. The refactor
of the existing `slaReport` query must be detected and not re-applied. Reconcile
schema, job registration, routes, and `ALL_TABLES` in place.
