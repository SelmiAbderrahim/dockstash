# Billing Test Suite — Build Prompt

> **Prove it works** — port the password-manager test shape: provider conformance, webhook signature, entitlement boundaries, idempotency, i18n completeness.

---

## Agent

`uptime-monitor-specialist` (knows the Pulsy test harness + Docker workflow).
Reference `docker-development-only.md` and `TESTING.md`.

## Mission

Author the full billing test suite, Docker-only, achieving 100% coverage of the
billing/payments/webhooks code from prompts 01–06 and the i18n from prompt 08.

## Operating Constraints

| Rule | Detail |
|---|---|
| Docker-only | Run in `pulsy-server` / `pulsy-web` containers; never host commands. |
| Determinism | No real Polar calls — stub the REST client; use fixture webhook payloads + a known secret. |
| Coverage | 100% of new billing code paths, including payments-off and payments-on branches. |
| Excluded | No multi-region/SMS tests (those features don't exist). |

## Phases

### Phase 0 — Study the model + harness
Read password-manager billing/webhook/provider tests and Pulsy's existing test
setup (`*.test.ts` siblings, `__tests__/`, vitest/jest config).

### Phase 1 — Provider conformance
`PolarProvider` implements every `IPaymentProvider` method; unsupported methods
throw `capability_unsupported`; type-mapping fixtures normalize correctly.

### Phase 2 — Webhook signature + idempotency
Valid signature passes; tampered/replayed/wrong-secret fails before parse; same
`webhook-id` processes once; dispatch flips subscription state.

### Phase 3 — Entitlement boundaries
Payments-off ⇒ Team tier for all; Free monitor cap, interval floor, retention,
status-page caps enforced; Pro/Team boundaries; canceled sub ⇒ free; Team seat
cap on org invites.

### Phase 4 — i18n completeness
`billing.json` and backend keys complete across en/ar/fr/de/es; interpolation
parity; no unresolved tokens (the test from `backend-i18n-patterns.md`).

### Phase 5 — Frontend gating
`VITE_FEATURE_PAYMENTS` toggles UI; checkout CTA never leaks the OAT;
usage-vs-limits render.

### Tests
- (This prompt's deliverable **is** tests.) Ensure the suite:
  - passes green in CI/containers,
  - reports ≥100% line+branch coverage for `apps/server/src/{billing,payments,webhooks}/`, the billing router, org procedures, and `apps/web` billing service/hooks,
  - includes the payments-off regression proving Pulsy behaves exactly as pre-billing.

### i18n
- Phase 4 covers i18n completeness assertions for all 5 languages.

### Documentation
- Note any test commands in `docs/TESTING.md` if new scripts are added.

### Agents & Skills
- Agent: `uptime-monitor-specialist`. Skills: `polar-provider` (expected shapes).

## Idempotency Contract

Re-running MUST NOT duplicate test files. Extend existing suites in place;
regenerate fixtures only when the schema/shape changed.
