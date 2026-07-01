# Billing & Pricing Frontend — Build Prompt

> **The buy/manage surface** — pricing page + billing settings, plan gating, usage-vs-limits, upgrade CTA to server-built checkout.

---

## Agent

`ui-designer` (Pulsy Shadcn/RTL/dark-mode specialist). Reference
`trpc-api-patterns.md`, `uncodixify-ui.md`, `url-tab-state.md`.

## Mission

Build the `apps/web` pricing page and billing settings, modeled on
password-manager's billing components but rebuilt for TanStack Router + Pulsy's
service-layer / query-key-factory conventions.

## Operating Constraints

| Rule | Detail |
|---|---|
| No OAT client-side | Upgrade CTA calls the server `billing.checkout` procedure and redirects to the returned URL. Never embed the Polar token. |
| Conventions | Use `uptimeService`-style service methods + `uptimeKeys`-style query-key factory (new `billingKeys` namespace). Per `trpc-api-patterns.md`. |
| Feature flag | Gate all pricing/billing UI on `VITE_FEATURE_PAYMENTS`; hidden when off (OSS default). |
| Uncodixify | No card-lift, no `animate-pulse` badges, `rounded-lg`/`rounded-md`, `shadow-sm` max, semantic tokens. Per `uncodixify-ui.md`. |
| URL tabs | Billing settings tabs persist in the URL per `url-tab-state.md`. |
| RTL + dark + 5 locales | Logical CSS props; semantic color tokens; strings from `billing.json` (prompt 08). |
| Switch styling | Any toggles follow `switch-component-styling.md` (no min-h/min-w on Switch). |
| Excluded | No multi-region/SMS UI. |

## Phases

### Phase 0 — Study model + conventions
Read password-manager `components/dashboard/settings/billing/` and Pulsy's
`services/uptime/uptimeService.ts`, `hooks/uptime/queryKeys.ts`, an existing
settings page, and the tRPC client wrapper `lib/api/trpc.ts`.

### Phase 1 — Service + hooks
Add `services/billing/billingService.ts` (`getSubscription`, `getEntitlements`,
`startCheckout(planId)`, `openPortal`) via `trpcQuery`/`trpcMutation`. Add
`hooks/billing/` with a `billingKeys` factory and React Query hooks.

### Phase 2 — Pricing page
Plan comparison (Free / Pro / Team, monthly↔annual toggle showing 2-months-free),
current-plan badge, upgrade CTA → `startCheckout` → redirect. Gate on
`VITE_FEATURE_PAYMENTS`.

### Phase 3 — Billing settings
Under dashboard settings: current plan, status, renewal date, "Manage billing"
→ portal, and **usage-vs-limits** (monitors used/limit, interval floor,
retention) from `billing.entitlements`. URL-tab state.

### Phase 4 — Plan gating UX
Where a uptime action is blocked by tier, surface an inline upgrade prompt
(localized) instead of a raw error.

### Tests
- `VITE_FEATURE_PAYMENTS` off ⇒ pricing/billing routes hidden; on ⇒ visible.
- Upgrade CTA calls `billing.checkout` and redirects to the returned URL; no OAT
  in any network payload.
- Usage-vs-limits renders correct used/limit per tier.
- RTL snapshot (Arabic) + dark-mode render; no Uncodixify violations (lint:
  `make rtl-check`, visual review).
- 100% coverage of new service/hooks; component tests for gating + checkout.
  Docker-only (`pulsy-web`).

### i18n
- All strings from the new `billing.json` namespace (prompt 08) in en/ar/fr/de/es.
- No hardcoded copy; interpolation vars consistent across locales.

### Documentation
- User-facing "Plans & Billing" doc under `/docs` (5-lang) — created in prompt 10
  or here if warranted; link via `DocsHelpLink` per `docs-help-link-patterns.md`.

### Agents & Skills
- Agent: `ui-designer`. Skill: `ui-ux-pro-max` (optional), shadcn MCP for components.

## Idempotency Contract

Re-running MUST NOT duplicate routes, service methods, or query-key namespaces.
Reconcile components in place.
