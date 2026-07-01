# Build Pulsy Cloud — Monetization with Polar.sh

> Source of truth for *what* to build: `MONETIZATION-PLAN.md` (this repo).
> Source of truth for *how* to build payments: the **password-manager** repo at
> `/Users/macbook/Desktop/password-manager` — it already has a production,
> provider-agnostic billing layer with **Polar.sh fully implemented**. Copy and
> adapt from it; do not invent a new design.

## 0. Goal in one sentence

Add a **Polar.sh-billed, plan-gated "Pulsy Cloud" layer** on top of the existing
single-user uptime monitor — Free / Pro / Team tiers with entitlement
enforcement — **excluding multi-region probes and SMS/voice alerts** (those need
external infra and are explicitly out of scope here).

## 1. Hard constraints (read before writing code)

1. **The OSS core stays free and ungated.** Pulsy's `CLAUDE.md` forbids billing/
   tiers/feature-flags in the open-source product. Mirror exactly how
   password-manager resolves this: **all billing is behind
   `FEATURE_FLAG_PAYMENTS`**, and when payments are disabled the entitlement
   service returns the **top tier** so self-hosters get everything for free.
   See `pssmngr-server/packages/server/src/billing/pssmngr-entitlements.ts`
   (`paymentsEnabled()` → returns `family_yearly` entitlements when off).
2. **Use Polar, not Stripe.** Polar is a Merchant-of-Record (handles tax/VAT).
3. **Provider-agnostic abstraction.** Even though we ship only Polar, keep the
   `IPaymentProvider` seam so a second provider is a pure addition later.
4. **Scope every billing row by user** (and by the new `organizationId` for
   teams). Same per-user discipline as the rest of Pulsy
   (`.claude/rules/tob-authorization.md`).
5. **Secrets:** `POLAR_ACCESS_TOKEN` + `POLAR_WEBHOOK_SECRET` are **server-only**,
   resolved from the single root `.env`. Never expose the OAT client-side; Polar
   auto-revokes leaked tokens. Follow `.claude/rules/tob-secrets.md`.
6. **Cloud code isolation:** per `MONETIZATION-PLAN.md` §4, keep cloud/billing
   code in its own modules (`apps/server/src/billing/`, `apps/server/src/payments/`,
   `apps/server/src/webhooks/`) so it never pollutes the OSS monitor logic.

## 2. Bring over from password-manager (skills, agents, docs)

Copy these into Pulsy and **rename/adapt** (`pssmngr`→`pulsy`, `family`→`pro`/
`team`, vault/device concepts → monitor/team concepts). Keep the structure.

| From `password-manager` | To Pulsy | Adapt |
|---|---|---|
| `.claude/skills/polar-api/` (SKILL + all `references/`) | `.claude/skills/polar-api/` | none — API reference is verbatim |
| `.claude/skills/polar-provider/` (SKILL + `references/`) | `.claude/skills/polar-provider/` | rename seam paths to Pulsy's `apps/server/src/...`; plan ids → `pro_monthly`/`pro_yearly`/`team_monthly`/`team_yearly` |
| `.claude/agents/polar-integration.md` | `.claude/agents/polar-integration.md` | repoint to Pulsy paths |
| `.claude/agents/legal-content-writer.md` (already in Pulsy as legal-pages-manager) | reuse Pulsy's | add billing/refund/MoR terms |
| `docs/self-hosting/polar.md` | `docs/self-hosting/polar.md` | Pulsy plans, `pulsy-server` container, `/api/webhooks/payment/polar` |

After copying, **invoke the `polar-provider` and `polar-api` skills** while
implementing — they carry the file-by-file checklist and the Polar↔normalized
type mapping.

## 3. Port the payment abstraction (model files)

Port these from `pssmngr-server/packages/server/src/` into Pulsy's
`apps/server/src/` (TypeScript + Drizzle + tRPC — same stack family, adapt
imports to Pulsy's `@pulsy/db` and Express/tRPC setup). **Model the Polar
provider on the lemonsqueezy provider (fetch-based REST + DB-key/env fallback),
not Stripe.**

**Payments core**
- `payments/types.ts` — normalized enums/types (`PaymentProvider`, `Subscription`,
  `CheckoutSession`, `WebhookEvent`, …). Trim providers to just `POLAR` (+ leave
  the enum extensible).
- `payments/provider-interface.ts` — `IPaymentProvider`.
- `payments/providers/polar.ts` — `PolarProvider implements IPaymentProvider`
  (verbatim model: `pssmngr-server/.../payments/providers/polar.ts`).
- `payments/provider-factory.ts`, `payments/active-provider.ts`,
  `payments/payment-error.ts`, `payments/index.ts`.
- `services/polar.ts` — `getPolar()`, `getPolarWebhookSecret()`,
  `isPolarConfigured()`, `PolarApiError`, sandbox/prod base-URL switch.

**Webhooks**
- `webhooks/handlers/polar-handler.ts` — Standard Webhooks HMAC-SHA256 verify
  (`webhook-id.webhook-timestamp.body`), constant-time compare, **parse JSON only
  after signature passes**, idempotency from `webhook-id`.
- `webhooks/webhook-router.ts`, `webhooks/normalizers/polar-normalizer.ts`,
  `webhooks/handlers/registry.ts`.
- Express route `POST /api/webhooks/payment/polar` (Pulsy uses Express, not Next
  pages — wire a raw-body Express handler; password-manager's
  `apps/pssmngr/pages/api/webhooks/payment/[provider].ts` is the logic to mirror).

**Billing**
- `billing/plans.ts` + `billing/pricing-config.ts` — Pulsy tiers (see §4).
- `billing/pulsy-polar-config.ts` (model `billing/pssmngr-polar-config.ts`) —
  map plan id → Polar product UUID via env.
- `billing/pulsy-entitlements.ts` (model `billing/pssmngr-entitlements.ts`) — the
  gate; returns top tier when `FEATURE_FLAG_PAYMENTS` is off.
- `billing/tier-guard.ts` / entitlement checks for enforcement at procedure level.
- `billing/index.ts`.

**Reference checklist:** follow
`password-manager/.claude/skills/polar-provider/references/integration-checklist.md`
step by step (enum → service → provider → export → factory → webhook handler →
router → ingestion → config probe → key cache → plan→product config → verify).
Use `references/type-mapping.md` for field mapping.

## 4. Pulsy plans & entitlements (the features to gate)

Translate `MONETIZATION-PLAN.md` §3 into Pulsy tiers. **Value metric = monitors ×
check frequency.** Plan ids: `free`, `pro_monthly`, `pro_yearly`,
`team_monthly`, `team_yearly`. Annual = 2 months free.

| Entitlement | Free | Pro (~$12/mo) | Team (~$39/mo) |
|---|---|---|---|
| `maxMonitors` | 5–10 | 50 | 200+ |
| `minCheckIntervalSeconds` | 180–300 | 30–60 | 30 |
| `dataRetentionDays` | 30 | ~390 (13 mo) | ~730 (24 mo) |
| `customDomainStatusPages` | 0 | included | included |
| `maxStatusPages` | 1 | several | many |
| `teamSeats` (organizations) | 1 (self only) | 1 | multi-user |
| `apiAccess` | none/limited | limited | full |
| `slaReports` | false | false | true |
| `prioritySupport` | false | basic | true |

**EXCLUDED from this build (do not implement):** multi-region probes, SMS/voice
alerts. Do not add entitlement keys, UI, or schema for them.

Enforcement points (wire entitlement checks into existing tRPC procedures —
all currently in `apps/server/src/trpc/routers/uptime.ts`):
- `monitor.create` → `maxMonitors`.
- `monitor.create`/`monitor.update` interval field → `minCheckIntervalSeconds`.
- check-log cleanup/retention service → `dataRetentionDays`.
- status-page custom-domain fields → `customDomainStatusPages` / `maxStatusPages`.
- new `team`/`org` invite procedures → `teamSeats`.
- new SLA-report procedure → `slaReports`.

## 5. Multi-tenancy (Team tier only)

Pulsy is single-user today. For **Team seats**, introduce an `organization` +
`organizationMember` concept (better-auth supports org plugin) **gated behind the
Team entitlement**, scoping monitors to `organizationId` when present and falling
back to `userId` otherwise. Keep this additive: a Free/Pro user is just an org of
one. Do **not** rip out per-user scoping — layer org on top. Update
`ARCHITECTURE.md` §5/§8 per `.claude/rules/architecture-doc-maintenance.md`.

## 6. Database (Drizzle, `packages/db/src/schema/`)

Add a new schema file `billing.ts` (model
`pssmngr-server/.../db/schema/payment.ts`): `subscription`, `customer`,
`webhookEvent` (idempotency), `pricingTier`/plan config, and `organization` +
`organizationMember` for teams. Generate a drizzle migration. Every table that
holds user data keeps `userId` (+ optional `organizationId`).

## 7. Frontend (`apps/web`)

- **Pricing page** + **billing settings** under dashboard settings — model
  `pssmngr-server/apps/pssmngr/components/dashboard/settings/billing/` and
  `pages/dashboard/settings/billing.tsx`, rebuilt for TanStack Router + Pulsy's
  service-layer/query-key-factory conventions (`.claude/rules/trpc-api-patterns.md`).
- "Upgrade" CTA → server-built Polar checkout (never expose the OAT).
- Customer portal link via Polar customer session.
- Gate UI on `VITE_FEATURE_PAYMENTS`; show plan badges + usage vs limits.
- Follow `uncodixify-ui.md`, RTL, dark mode, 5 locales (en/ar/fr/de/es),
  `url-tab-state.md` for billing tabs.
- New i18n namespace `billing.json` in all 5 locales (use the
  `translation-manager` agent).

## 8. Environment variables (root `.env` only — `.claude/rules/environment-variables.md`)

| Var | Required | Purpose |
|---|---|---|
| `FEATURE_FLAG_PAYMENTS` | yes | Master switch; off ⇒ everything free (OSS default) |
| `PAYMENT_PROVIDER` | yes | `polar` |
| `POLAR_ACCESS_TOKEN` | yes | Org Access Token (`polar_oat_…`), server-only |
| `POLAR_WEBHOOK_SECRET` | yes | Standard Webhooks secret (`whsec_…`) |
| `POLAR_SERVER` | no | `sandbox` (default) or `production` |
| `POLAR_PRO_MONTHLY_PRODUCT_ID` … | yes (when on) | Polar product UUID per paid plan |
| `VITE_FEATURE_PAYMENTS` | no | Client flag to show/hide pricing UI |

Document them in `.env.example` and `docs/self-hosting/polar.md`. **Start in
sandbox**; only flip to production after a checkout + webhook round-trip works.

## 9. Tests (Docker-only — `.claude/rules/docker-development-only.md`)

Port the test shape from password-manager: provider-interface conformance,
polar-handler signature-verification, entitlement boundary tests
(free vs pro vs team limits), webhook idempotency, i18n completeness for
`billing.json`. Run inside `pulsy-server` / `pulsy-web` containers.

## 10. Definition of done

- [ ] `FEATURE_FLAG_PAYMENTS=false` ⇒ Pulsy behaves exactly as today, all features on.
- [ ] `FEATURE_FLAG_PAYMENTS=true` + sandbox Polar ⇒ checkout → webhook → active
      subscription → entitlements upgraded end-to-end.
- [ ] Free/Pro/Team limits enforced on monitor count, interval, retention,
      status-page custom domains, team seats, API, SLA reports.
- [ ] No multi-region or SMS/voice code added.
- [ ] OSS hard rules intact: billing isolated, ungated when flag off.
- [ ] Polar OAT never reaches the client; webhook signature verified before parse.
- [ ] 5 locales complete; RTL + dark mode pass; `ARCHITECTURE.md` updated.
- [ ] polar-api / polar-provider skills + polar-integration agent + self-hosting
      doc present and adapted in Pulsy.

## Suggested execution

Use the `polar-integration` agent (once copied) for the payments seam, the
`uptime-monitor-specialist` for entitlement wiring into uptime procedures, the
`translation-manager` for `billing.json`, and the `ui-designer` for the pricing/
billing UI. Read the `polar-provider` + `polar-api` skills first.
