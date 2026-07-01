# Entitlement Enforcement & Billing tRPC Router — Build Prompt

> **Wire the gate into the product** — enforce tier limits in uptime procedures and add a billing router for checkout / portal / subscription status.

---

## Agent

`uptime-monitor-specialist` (knows `uptime.ts` procedures + scheduler/cleanup).
Coordinate with `polar-integration` for the billing router's Polar calls.

## Mission

Enforce the entitlements from prompt 04 at the tRPC layer, and add a billing
router exposing server-built Polar checkout, customer-portal sessions,
subscription status, and current entitlements.

## Operating Constraints

| Rule | Detail |
|---|---|
| Server-built checkout | The Polar OAT never reaches the client. Checkout URL + portal session are built server-side and only the URL is returned. |
| Zod + protected | Every input Zod-validated; all billing data procedures `protectedProcedure`. |
| i18n errors | Limit violations throw `TRPCError` with keys via `ctx.t` (keys added in prompt 08). |
| Scope-aware | Entitlement lookup uses `organizationId` when present, else `ctx.user.id`. |
| OSS-free | With `FEATURE_FLAG_PAYMENTS` off, every check passes (top tier) — no behavior change vs today. |
| Excluded | No multi-region/SMS enforcement points. |

## Phases

### Phase 0 — Map enforcement points
Read `apps/server/src/trpc/routers/uptime.ts` and `services/uptime/cleanup-service.ts`.
Identify: `monitor.create`, `monitor.createBulk`, `monitor.update` (interval),
status-page fields (`isPublic`, custom domain, page count), cleanup retention.

### Phase 1 — Enforce limits
- `monitor.create` / `createBulk` → count user/org monitors vs `maxMonitors`.
- `monitor.create` / `monitor.update` interval field → `minCheckIntervalSeconds`.
- cleanup-service retention → use `dataRetentionDays` from entitlements instead
  of the flat `CHECK_LOG_RETENTION_DAYS` (fall back to env when payments off).
- status-page custom-domain field → `customDomainStatusPages`; public-page count
  → `maxStatusPages`.
- New `slaReport` procedure → gated on `slaReports`.
Use `tier-guard.ts` helpers; throw localized `TRPCError` on violation.

### Phase 2 — Billing router
Add `apps/server/src/trpc/routers/billing.ts` (`protectedProcedure`):
- `checkout` — input plan id → server builds Polar checkout for the mapped
  product → returns `{ url }`. External-customer id = `ctx.user.id`.
- `portal` — returns a Polar customer-portal session URL.
- `subscription` — current subscription/plan/status for the scope.
- `entitlements` — resolved entitlements + current usage (monitor count, etc.).
Register in `apps/server/src/trpc/router.ts`.

### Phase 3 — Usage surface
`entitlements` returns usage-vs-limit pairs the frontend (prompt 07) renders.

### Tests
- Free user creating an 11th monitor (limit 10) → `TRPCError` with the limit key;
  Pro user at 50 blocked at 51; Team within 200+.
- Interval below `minCheckIntervalSeconds` rejected per tier; allowed at/above.
- Retention cleanup honors entitlement days; payments-off uses env default.
- `checkout` returns a URL and **never** the OAT; input validates plan id.
- `subscription`/`entitlements` scoped by user/org; cross-user access denied.
- Payments-off: all enforcement passes (regression: behaves like today).
- 100% coverage of new/changed procedures. Docker-only.

### i18n
- All thrown messages via `ctx.t` using keys: `errors.tierLimitMonitors`,
  `errors.tierLimitInterval`, `errors.tierLimitStatusPages`,
  `errors.paymentsDisabled`, `errors.checkoutFailed` (defined in prompt 08, all 5
  languages). No hardcoded strings.

### Documentation
- Billing router procedures noted for `ARCHITECTURE.md` §6 (prompt 10).

### Agents & Skills
- Agent: `uptime-monitor-specialist` (enforcement) + `polar-integration` (router).
- Skill: `polar-api` (checkout/portal endpoints).

## Idempotency Contract

Re-running MUST NOT double-register the billing router or stack duplicate guard
calls in a procedure. Reconcile guards/router registration in place.
