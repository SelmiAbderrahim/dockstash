# Env Vars, Docs & Architecture Update — Build Prompt

> **Finalize & document** — env contract in `.env.example`, self-hosting doc, ARCHITECTURE.md update, and legal/MoR billing terms across 5 locales.

---

## Agent

`legal-pages-manager` (legal/refund/MoR terms in 5 locales). Coordinate with
`polar-integration` for env/doc accuracy. Follow
`architecture-doc-maintenance.md`, `environment-variables.md`,
`email-deliverability.md`.

## Mission

Close out the Pulsy Cloud build: document every env var, finalize the
self-hosting guide, update `ARCHITECTURE.md`, and add Merchant-of-Record / refund
/ billing terms to the legal pages in all 5 languages.

## Operating Constraints

| Rule | Detail |
|---|---|
| Root `.env` only | All vars documented in the **root** `.env.example`; no subdirectory env files (`environment-variables.md`). |
| Sandbox first | Docs instruct starting in Polar sandbox; production only after a verified checkout+webhook round-trip. |
| Arch maintenance | Update `ARCHITECTURE.md` §5 (tables), §6 (billing router), §8 (org+billing patterns), §9 (env) per the rule. |
| Legal 5-lang | Billing/refund/MoR terms in `apps/web/public/locales/{lang}/legal.json` for all 5 languages. |
| Filename safety | (This very prompt avoids the `architecture` skip-substring in its filename — the doc update lives inside it.) |

## Phases

### Phase 0 — Inventory
List every env var introduced across prompts 02–07 and the doc/legal surfaces.

### Phase 1 — `.env.example`
Document (with comments): `FEATURE_FLAG_PAYMENTS`, `PAYMENT_PROVIDER=polar`,
`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER` (sandbox default),
`POLAR_PRO_MONTHLY_PRODUCT_ID`, `POLAR_PRO_YEARLY_PRODUCT_ID`,
`POLAR_TEAM_MONTHLY_PRODUCT_ID`, `POLAR_TEAM_YEARLY_PRODUCT_ID`,
`VITE_FEATURE_PAYMENTS`. Mark which are required only when payments are on.

### Phase 2 — Self-hosting doc
Finalize `docs/self-hosting/polar.md`: Polar account/product setup, env wiring,
webhook endpoint `/api/webhooks/payment/polar`, sandbox→production checklist,
tier matrix, "payments off = everything free" note.

### Phase 3 — ARCHITECTURE.md
Update §5 (subscription/customer/webhookEvent/pricingTier/organization/
organizationMember tables), §6 (billing router), §8 (entitlement gate + org
scoping pattern), §9 (new env vars). Update counts/diagrams as needed.

### Phase 4 — Legal / MoR
Add Merchant-of-Record, billing, refund, and subscription-cancellation terms to
the legal pages in en/ar/fr/de/es (`legal.json`), consistent with Polar acting as
MoR (tax/VAT handled by Polar).

### Tests
- `.env.example` parses; every documented var is referenced somewhere in code
  (no orphan vars) and no code reads an undocumented billing var.
- `docs/self-hosting/polar.md` links resolve; no raw IPs/ports per
  `email-deliverability.md` conventions for any example URLs.
- Legal `legal.json` keys complete + interpolation-consistent across 5 languages.
- ARCHITECTURE.md sections updated (manual review checklist).
- Docker-only where executable.

### i18n
- Legal terms in all 5 languages (Phase 4). Self-hosting doc may be English-only
  (operator-facing) unless a localized docs pipeline exists.

### Documentation
- This prompt **is** the documentation gate: `.env.example`, self-hosting guide,
  ARCHITECTURE.md, and legal pages.

### Agents & Skills
- Agents: `legal-pages-manager` (legal), `polar-integration` (env/doc accuracy),
  `translation-manager` (legal locale files).

## Idempotency Contract

Re-running MUST NOT duplicate env entries, doc sections, or legal clauses.
Reconcile in place; only append genuinely missing content.
