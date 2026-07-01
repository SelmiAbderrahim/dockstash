# Billing i18n — Five Locales — Build Prompt

> **Localize everything billing** — new `billing.json` web namespace + backend error keys, in en/ar/fr/de/es with matching interpolation vars.

---

## Agent

`translation-manager` (web locale files) + `backend-i18n-developer` (server dict
keys). Follow `backend-i18n-patterns.md`.

## Mission

Provide complete, consistent translations for every billing/entitlement string
across all 5 supported languages — both the web `billing.json` namespace and the
backend error dictionary.

## Operating Constraints

| Rule | Detail |
|---|---|
| 5 languages | en (reference), ar (RTL), fr, de, es. No missing keys in any. |
| Matching vars | Interpolation variables (e.g. `{{limit}}`, `{{plan}}`) identical across all languages. |
| No unresolved tokens | No `{{` left unrendered in any locale. |
| Web + backend | Web: `apps/web/public/locales/{lang}/billing.json`. Backend: keys in `apps/server/src/lib/i18n.ts`. |
| Source of keys | Keys are defined/consumed by prompts 05, 06, 07 — this prompt fills all 5 locales for them. |

## Phases

### Phase 0 — Collect required keys
0.1 Web: scan the billing/pricing UI (prompt 07) for `t()` keys — plan names,
features, CTAs, usage labels, upgrade prompts, portal, billing-cycle toggle.
0.2 Backend: collect error keys referenced by prompts 05/06:
`errors.tierLimitMonitors`, `errors.tierLimitInterval`,
`errors.tierLimitStatusPages`, `errors.paymentsDisabled`, `errors.checkoutFailed`,
`errors.teamSeatsExceeded`, `errors.orgRequiresTeam`, `errors.notOrgMember`.

### Phase 1 — English reference
Author `apps/web/public/locales/en/billing.json` and the English backend keys.

### Phase 2 — Translate to ar/fr/de/es
Produce all four locale files + backend dict entries with identical key sets and
interpolation vars. Arabic reviewed for RTL phrasing.

### Phase 3 — Register namespace
Ensure `billing` is registered with i18next on the web side and the new backend
keys are present in every language map in `lib/i18n.ts`.

### Tests
- Completeness: every key in `en/billing.json` exists in ar/fr/de/es (and
  vice-versa); same for backend dict.
- Interpolation parity: variable sets per key identical across languages.
- No unresolved `{{...}}` after rendering each key in each language.
- Backend: `notFoundError`-style helpers and the new keys render non-empty in all
  5 languages (pattern from `backend-i18n-patterns.md` test example).
- 100% of new keys covered. Docker-only.

### i18n
- This prompt **is** the i18n gate for the billing feature — see Tests.

### Documentation
- N/A beyond translations; doc localization handled in prompt 10.

### Agents & Skills
- Agents: `translation-manager`, `backend-i18n-developer`.

## Idempotency Contract

Re-running MUST NOT duplicate keys or reorder existing translations destructively.
Add only missing keys; preserve existing human-reviewed translations.
