# Priority Support — Build Prompt

> **Wire the dormant flag to something real** — an in-app support contact flow
> that tags requests by the requester's plan, routes priority requests to the
> operator, and surfaces the support tier (and expected response time) in the UI.
> Today `prioritySupport` is a boolean that nothing reads.

---

## Agent

`uptime-monitor-specialist` (backend wiring + email-send reuse), `ui-designer`
(support surface), `translation-manager` (5 locales), `legal-pages-manager`
(support-SLA wording, if a response-time commitment is stated).

## Mission

`prioritySupport` is `true` for Pro + Team in `ENTITLEMENTS_BY_PLAN`
(`apps/server/src/billing/plans.ts`) but is read nowhere. Support is mostly a
human process, so "integration" means a real product surface + deterministic
routing:
1. An in-app **Contact-support flow** (`protectedProcedure`) capturing message +
   category and the requester's plan/entitlements.
2. **Priority routing**: requests from `prioritySupport` plans are flagged and
   subject-prefixed `[PRIORITY]`, with a stated response-time target; others go
   to standard handling.
3. **UI surfacing**: a support entry point showing the user's support tier +
   expected response time, labeled by `prioritySupport`.

## Operating Constraints

| Rule | Detail |
|---|---|
| Read the entitlement | Resolve via `getPulsyEntitlements(db, { userId })` and branch on `entitlements.prioritySupport`. Do NOT block non-priority users from contacting support — everyone can; priority only changes routing/labeling/SLA. (No new tier-guard needed.) |
| OSS-default | Payments off ⇒ `team_yearly` ⇒ `prioritySupport:true`. Self-hosters see the priority tier. The flow degrades gracefully when no support inbox is configured. |
| Delivery | Deliver to a fixed operator inbox (`SUPPORT_INBOX_ADDRESS`) via the operator's email provider using `sendViaProvider()` (`services/uptime/email-provider-service.ts`). If no provider/inbox is configured, **persist the request and return a "received, delivery pending" result — never throw**. |
| Secrets/env | `SUPPORT_INBOX_ADDRESS` (+ optional `SUPPORT_PRIORITY_INBOX_ADDRESS`) read from root `.env` with **no fallback default** (`.claude/rules/tob-secrets.md`); document in `.env.example`. No hardcoded addresses. |
| HTML safety | Escape every value (message, user email, category) via `escapeHtml()` (`apps/server/src/lib/html.ts`); links use `SITE_URL`. |
| Scope/validation | `protectedProcedure`, Zod (`message` 1–5000, `category` enum); persist scoped to `ctx.user.id`. Throttle to a few submits/min/user. |
| Excluded | No live chat, no third-party helpdesk integration, no ticket threading/replies UI (one-way submit + email is enough for v1). |

## Phases

### Phase 0 — Map & decide delivery
Read `email-provider-service.ts` (`sendViaProvider`, `findEmailProvidersByUser`),
`lib/i18n.ts`, `lib/html.ts`, `apps/server/src/trpc/router.ts` (router assembly:
`uptimeMonitor` / `config` / `billing` / `organization`), and the `index.ts` env
read pattern (`Number(process.env.X ?? …)`). Decide: deliver via the **operator's**
provider to `SUPPORT_INBOX_ADDRESS` (recommended, operator-controlled) vs the
user's own provider. Document the choice in the output.

### Phase 1 — Schema & migration
Persist so requests aren't lost if email fails. Add a table (in
`packages/db/src/schema/billing.ts` near the account/org tables, or a new
`support.ts` exported from `schema/index.ts`):
```
support_request
  supportRequestId  text pk ($defaultFn nanoid)
  userId            text fk -> user (cascade)
  category          text notnull            -- billing | technical | account | other
  message           text notnull
  planId            text notnull            -- snapshot of entitlements.planId at submit
  isPriority        boolean notnull default false
  deliveredAt       text                    -- set when the email send succeeds
  createdAt         text notnull
  index (userId); index (createdAt)
```
Relations + `$inferSelect/$inferInsert`. Zod `apiCreateSupportRequest` in
`validation.ts` (`category` enum, `message` 1–5000). Generate via
`pnpm --filter @pulsy/db generate`; update `drizzle/meta`.

### Phase 2 — Backend: support router
New `apps/server/src/trpc/routers/support.ts` (`protectedProcedure`), registered
in `apps/server/src/trpc/router.ts` beside `billing` / `organization`:
- `submit({ category, message })` — resolve entitlements, set
  `isPriority = entitlements.prioritySupport` + `planId`, insert the row, build an
  escaped HTML email (subject `[PRIORITY]` when priority; include plan, user
  email, category), send to the configured inbox, stamp `deliveredAt` on success.
  Email failure → keep the row, return `{ status: "pending" }` (no 500). Throttle.
- `supportInfo` (query) → `{ tier: "priority" | "standard",
  responseTimeHoursTarget, inboxConfigured }` so the UI renders copy without
  hardcoding.

### Phase 3 — Frontend
- 3.1 Service/hooks/keys: `submitSupportRequest` + `getSupportInfo` (extend
  `uptimeService.ts` or a small `supportService.ts`), hooks, and a `support.*`
  query-key group; calls via `trpcQuery`/`trpcMutation`.
- 3.2 UI: a "Contact support" entry (dashboard header/help menu) opening a dialog
  — category select, message textarea, a **support-tier badge** ("Priority
  support — response within Xh" vs "Standard support") driven by `supportInfo`.
  Success/error toasts; disable submit while pending (`Loader2 animate-spin`).
  When `inboxConfigured` is false, show a graceful "support not configured on this
  instance" note (self-hosted reality). Also surface the tier read-only on
  `apps/web/src/components/billing/billing-overview-tab.tsx`.
- 3.3 Uncodixify, RTL, dark-mode tokens, 44px targets, Switch styling rules.
  (Place the components under `components/uptime/` or add the new dir to the web
  vitest coverage `include` globs — currently `hooks/**`, `services/**`,
  `components/uptime/**` are gated.)

### Tests
Server (vitest, real Postgres, **100% v8 coverage enforced**): `authedCaller`
(`test/trpc-caller.ts`), `useCleanDatabase()` + factory (`test/db.ts`), `mockFetch`
or a mocked `sendViaProvider`.
- **Add `support_request` to `ALL_TABLES` (cascade-safe order) and a
  `createTestSupportRequest` factory in `apps/server/test/db.ts`.**
- Priority flag: priority-plan user → row `isPriority=true` + subject `[PRIORITY]`;
  non-priority → `false`, no prefix. Drive via the entitlement resolver.
- Delivery: success stamps `deliveredAt`; a throwing `sendViaProvider` leaves the
  row persisted and returns the "pending" result (no 500).
- No inbox configured: `submit` persists + returns pending;
  `supportInfo.inboxConfigured=false`.
- Validation/scope/throttle: message length + category enforced; rapid repeats
  blocked; rows scoped to `ctx.user.id`.
- Injection: a message with `<script>` is escaped in the email HTML.
Web (jsdom, **100% coverage** on configured globs): badge reflects `supportInfo`
tier; submit calls the service; disabled/graceful states render. OSS regression:
payments-off shows the priority tier. Mock the Service layer; `createWrapper()`.

### i18n
- Frontend `support.*` block in all 5 `apps/web/public/locales/*/common.json`
  (entry label, dialog title, categories, message, tier badges, response-time
  copy, success/error, not-configured) — identical interp vars.
- Server: email subject/body strings + `errors.supportInboxNotConfigured` added
  to `DICTIONARIES` in `lib/i18n.ts` (all 5), rendered in the user's language;
  extend the completeness list in `lib/i18n.test.ts`. No hardcoded user-facing
  strings.

### Documentation
- `ARCHITECTURE.md`: `support_request` table (§5), `support.*` router (§6),
  `SUPPORT_INBOX_ADDRESS` env (§9).
- `docs/`: a short "Support" note (how to reach support, what priority means,
  which plans) + an operator note on setting the inbox env.
- `.env.example`: `SUPPORT_INBOX_ADDRESS` (+ optional priority inbox) with a
  comment that an unset value disables in-app delivery. `CHANGELOG.md` entry.
  Docker-only dev (`pulsy-*`).

## Agents & Skills

- **Agents:** `uptime-monitor-specialist` (router + delivery), `ui-designer`
  (support dialog + badge), `translation-manager` (5 locales), `legal-pages-manager`
  (response-time commitment wording, if stated).
- **Skills:** `uptime-monitor` (email-provider service reuse); `ui-ux-pro-max` +
  `shadcn-design-system-compliance` (dialog UI); `legal-content-generator`
  (support-SLA / terms copy if a response-time guarantee is published);
  `verify` + `run` (submit a request end-to-end, assert the email is built);
  `code-review` (final pass).

## Idempotency Contract

Re-running MUST NOT: re-create the `support_request` table/migration or its
`ALL_TABLES`/factory entry, re-register the `support.*` router, re-add the env
reads, or duplicate the dialog/entry point. Treat an existing `support.*` router
path as "already wired". Reconcile router registration, schema, and `ALL_TABLES`
in place.
