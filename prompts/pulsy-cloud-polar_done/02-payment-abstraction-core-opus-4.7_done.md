# Payment Abstraction Core — Build Prompt

> **Provider-agnostic payments seam** — port the `IPaymentProvider` abstraction and the Polar provider (modeled on the fetch-based lemonsqueezy provider, not the Stripe SDK).

---

## Agent

`polar-integration`. Read the `polar-api` skill (auth, checkout, subscriptions,
errors) and follow `polar-provider/references/integration-checklist.md` +
`references/type-mapping.md` step-by-step.

## Mission

Port `apps/server/src/payments/` and `apps/server/src/services/polar.ts` from
password-manager, trimmed to the single Polar provider while keeping the seam
extensible.

## Operating Constraints

| Rule | Detail |
|---|---|
| Seam preserved | Keep `IPaymentProvider`; Polar is one implementation behind it. |
| Model lemonsqueezy | `providers/polar.ts` uses **fetch-based REST + env/DB-key fallback**, NOT the Stripe SDK pattern. |
| Server-only secrets | `POLAR_ACCESS_TOKEN` never reaches the client; resolved from root `.env` per `environment-variables.md` + `tob-secrets.md`. |
| Sandbox default | Base-URL switch defaults to sandbox; production only via `POLAR_SERVER=production`. |
| Isolation | All code under `apps/server/src/payments/` + `services/polar.ts`; no leakage into uptime logic. |
| Excluded | No multi-region/SMS provider methods. |

## Phases

### Phase 0 — Study the model
Read password-manager `payments/types.ts`, `provider-interface.ts`,
`providers/lemonsqueezy.ts` (the structural model) and `providers/polar.ts`,
`provider-factory.ts`, `active-provider.ts`, `payment-error.ts`, `index.ts`, and
`services/polar.ts`. Map Polar fields per `type-mapping.md`.

### Phase 1 — `services/polar.ts`
Port `getPolar()` (lazy cached REST client), `getPolarWebhookSecret()`,
`isPolarConfigured()`, `getPolarServer()`, `PolarApiError`, sandbox/prod base
URLs (`https://sandbox-api.polar.sh/v1` / `https://api.polar.sh/v1`), and an
`idempotencyKey`-aware `request()` helper. Adapt secret resolution to Pulsy's
root-`.env` model.

### Phase 2 — Payments core
2.1 `types.ts` — normalized enums/types (`PaymentProvider` with `POLAR`, kept
extensible; `Subscription`, `CheckoutSession`, `WebhookEvent`, `Customer`).
2.2 `provider-interface.ts` — `IPaymentProvider` (+ `BasePaymentProvider` defaults).
2.3 `providers/polar.ts` — `PolarProvider implements IPaymentProvider`; verbatim
behavioral model from password-manager; unsupported methods throw with a
`capability_unsupported` code.
2.4 `provider-factory.ts`, `active-provider.ts` (resolution: env
`PAYMENT_PROVIDER` → default `polar`), `payment-error.ts`, `index.ts`.

### Phase 3 — Config probe
Implement `isProviderConfigured()` returning true iff the OAT + required product
ids are present (product ids land in prompt 04's config; reference, don't inline).

### Tests
- Provider-interface conformance: `PolarProvider` implements every
  `IPaymentProvider` method; unsupported ones throw the documented error code.
- `services/polar.ts`: sandbox/prod base-URL selection by `POLAR_SERVER`;
  `isPolarConfigured()` false when OAT missing; `request()` attaches
  idempotency key; `PolarApiError` carries status/code.
- Type-mapping: Polar checkout/subscription objects normalize to the expected
  shapes (table-driven from `type-mapping.md`).
- 100% coverage of new `payments/` + `services/polar.ts` code. Docker-only.

### i18n
- No user-facing strings here (server-internal). Any thrown errors surfaced via
  tRPC use i18n keys defined in prompt 08 — reference by key.

### Documentation
- No user docs; note the `payments/` module for `ARCHITECTURE.md` §8 (prompt 10).

### Agents & Skills
- Agent: `polar-integration`. Skills: `polar-api` (API shapes), `polar-provider`
  (checklist + type-mapping).

## Idempotency Contract

Re-running MUST NOT duplicate provider files or re-register the provider twice in
the factory. Reconcile in place; regenerate only changed files.
