# Billing Plans & Entitlements — Build Prompt

> **The gate** — Pulsy tiers, plan→Polar-product config, and the entitlement resolver that returns the top tier when payments are off.

---

## Agent

`polar-integration`. Follow the config/entitlement steps of
`polar-provider/references/integration-checklist.md`.

## Mission

Port `apps/server/src/billing/` from password-manager, encoding Pulsy's Free /
Pro / Team tiers and the `FEATURE_FLAG_PAYMENTS`-aware entitlement resolver.

## Pulsy tiers to encode

Plan ids: `free`, `pro_monthly`, `pro_yearly`, `team_monthly`, `team_yearly`
(annual = 2 months free). Value metric = monitors × check frequency.

| Entitlement | Free | Pro (~$12/mo) | Team (~$39/mo) |
|---|---|---|---|
| `maxMonitors` | 5–10 | 50 | 200+ |
| `minCheckIntervalSeconds` | 180–300 | 30–60 | 30 |
| `dataRetentionDays` | 30 | ~390 | ~730 |
| `customDomainStatusPages` | 0 | included | included |
| `maxStatusPages` | 1 | several | many |
| `teamSeats` | 1 | 1 | multi |
| `apiAccess` | none/limited | limited | full |
| `slaReports` | false | false | true |
| `prioritySupport` | false | basic | true |

## Operating Constraints

| Rule | Detail |
|---|---|
| OSS-free default | `paymentsEnabled()` reads `FEATURE_FLAG_PAYMENTS`. When **off**, `getPulsyEntitlements()` returns the **top (Team) tier** so self-hosters get everything free. |
| No sub → free | When payments on but no active/trialing subscription, return the **free** tier. |
| Product config via env | `pulsy-polar-config.ts` maps plan id → Polar product UUID from `POLAR_*_PRODUCT_ID` env (DB-key fallback like lemonsqueezy). |
| Excluded keys | No entitlement keys for multi-region or SMS/voice. |

## Phases

### Phase 0 — Study the model
Read password-manager `billing/plans.ts`, `pricing-config.ts`,
`pssmngr-polar-config.ts`, `pssmngr-entitlements.ts`, `tier-guard.ts`, `index.ts`.

### Phase 1 — Plans & pricing
`plans.ts` + `pricing-config.ts`: define the 5 plan ids and the entitlement
matrix above as `ENTITLEMENTS_BY_PLAN`. Encode annual = 2 months free.

### Phase 2 — Polar product config
`pulsy-polar-config.ts`: `getPulsyPolarProductId(planId)` and
`isPulsyPolarConfigured()` resolving `POLAR_PRO_MONTHLY_PRODUCT_ID`,
`POLAR_PRO_YEARLY_PRODUCT_ID`, `POLAR_TEAM_MONTHLY_PRODUCT_ID`,
`POLAR_TEAM_YEARLY_PRODUCT_ID`. `free` → null.

### Phase 3 — Entitlement resolver
`pulsy-entitlements.ts`: `getPulsyEntitlements(db, { userId, organizationId? })`
— payments-off → Team tier; payments-on → look up active sub by scope → tier;
no/inactive sub → free. `tier-guard.ts`: `assertWithinLimit(...)` helpers used by
prompt 05.

### Phase 4 — Exports
`billing/index.ts` re-exports the public surface (entitlements, guards, config).

### Tests
- `paymentsEnabled()` false ⇒ Team-tier entitlements for any user (boundary test).
- Payments on + active Pro sub ⇒ Pro entitlements; canceled/past_due ⇒ free.
- Payments on + no sub ⇒ free.
- `getPulsyPolarProductId` returns the right UUID per plan; `free` → null.
- Annual price = 2× monthly (2-months-free) assertion.
- 100% coverage of `billing/`. Docker-only.

### i18n
- No user-facing strings. The tier-limit/payments-disabled **error keys** are
  defined in prompt 08; `tier-guard.ts` throws `TRPCError` referencing those keys
  via `ctx.t` (wired in prompt 05).

### Documentation
- Tier matrix documented in `docs/self-hosting/polar.md` (prompt 10).

### Agents & Skills
- Agent: `polar-integration`. Skill: `polar-provider` (config + entitlement steps).

## Idempotency Contract

Re-running MUST NOT duplicate plan definitions or env-config keys. Reconcile the
entitlement matrix in place if values changed.
