# i18n Foundation — Seven Locales + Auto-Detection — Build Prompt

> **Make Dockstash multilingual from the ground up** — bootstrap full i18n for
> **seven locales (en, ar, fr, de, es, ru, zh)** with **automatic language
> detection** (client reads `navigator.language`; server resolves
> `Accept-Language`), RTL for Arabic, and localized **both** client UI strings and
> backend response messages (errors + success). This is the foundation every
> later feature depends on; it must be runnable before any feature prompt.

---

## Agent

`backend-dev` (owns the server-side i18n: the dictionary store under
`server/src/shared/i18n/`, the language-resolution middleware, the
`error-handler.ts` wrap, and the `communication` module's localized
subjects/bodies). Coordinate with `react-specialist` (the client i18next setup,
locale JSON namespaces, language switcher, RTL `dir` handling).

## Mission

The starter has **no i18n** (`CLAUDE.md` §9 "No i18n framework"). The user
directive overrides both the meta-prompt's 5-language assumption and that §9
entry: ship **7 locales with auto-detection** across the whole stack. Build:

1. **Client i18n** — `i18next` + `react-i18next` +
   `i18next-browser-languagedetector`; per-namespace locale JSON under
   `client/src/shared/i18n/locales/{en,ar,fr,de,es,ru,zh}/`; persist the chosen
   language in a cookie; set `document.dir = "rtl"` for `ar`; a language switcher.
2. **Server i18n** — a lightweight dictionary under `server/src/shared/i18n/` + a
   middleware that resolves the request language from `Accept-Language` (and an
   `x-lang` header / cookie override), exposing `req.language` and a
   `t(key, vars)` helper; localized `HttpError` messages (wrap
   `error-handler.ts`) and email subjects/bodies (`communication` module).
3. **The key-namespace convention** every later feature will follow.

> **This is the FOUNDATION prompt.** Define the namespace/key conventions here so
> `02-*` and all feature prompts add keys consistently. It must be runnable before
> the feature prompts.

## Operating Constraints

| Rule | Detail |
|---|---|
| Seven locales, no gaps | `en, ar, fr, de, es, ru, zh` everywhere. Every key exists in all 7 with **identical interpolation variables**. `en` is the fallback for unknown/unsupported languages. |
| Auto-detection | Client: `navigator.language` (via `i18next-browser-languagedetector`), persisted in a cookie. Server: parse `Accept-Language`, honor an explicit `x-lang` header or language cookie first, then fall back to `en`. |
| RTL | `ar` sets `document.dir = "rtl"` (and `<html lang="ar" dir="rtl">`); LTR for the rest. Layout/components must not break under RTL. See `.claude/rules/ui-ux-patterns.md`. |
| Cookie helper reuse | Persist the client language via `saveCookie`/`loadCookie`/`removeCookie` in `client/src/shared/utils/cookies.ts` — do not roll a new cookie util. |
| Env from root only | No new `.env` in subdirectories; any default-locale config flows through root `.env` / `server/src/config/env.ts`. See `.claude/rules/environment-variables.md`. |
| No hardcoded URLs | Locale-switch links and any locale asset paths derive from env/aliases, never literals. See `.claude/rules/site-url-env-pattern.md`. |
| Named exports | i18n init, the `t` helper, the middleware, hooks, and the switcher are all named exports. See `.claude/rules/mern-no-default-exports.md`. |
| Path aliases | Client imports use `@shared/i18n/*`, never `../../` across boundaries. |
| No hardcoded user-facing strings | Every UI label and every backend response message (error + success) goes through the i18n layer. Server `HttpError` messages resolve via `t()` in `error-handler.ts`. |
| Excluded | No translation-management SaaS, no ICU plural CLDR edge tuning beyond i18next defaults, no per-route lazy locale bundles (single bundle per language is fine at this size). |

## Phases

### Phase 0 — Map the model
- 0.1 Read `client/src/app/providers.tsx` (where an `I18nextProvider` /
  init must mount), `client/src/app/router.tsx`, and
  `client/src/shared/utils/cookies.ts` (`saveCookie`/`loadCookie`/`removeCookie`).
- 0.2 Read `server/src/app.ts` (middleware order: `requestId → pinoHttp →
  express.json → cors → passport.initialize() → routes → notFound →
  errorHandler`) to place the language middleware **before routes** and after
  `requestId`.
- 0.3 Read `server/src/shared/middleware/error-handler.ts` and
  `server/src/shared/utils/http-error.ts` (`HttpError` with `.badRequest/
  .unauthorized/.forbidden/.notFound/.conflict/.internal`) to see how messages
  flow today, so the wrap translates the message key without changing the API.
- 0.4 Read `server/src/modules/communication/mailers/mailgun.ts`
  (`sendEmail(message)`, `deliverContactForm`, `deliverPasswordResetEmail`) and
  `server/src/shared/types/express.d.ts` (to augment `req.language` + `req.t`).
- 0.5 Read `server/src/config/env.ts` before adding a `DEFAULT_LOCALE` (optional,
  default `en`) and `SUPPORTED_LOCALES` constant source.

### Phase 1 — Namespace & key convention (the contract)
- 1.1 Define namespaces shared by both sides: `common`, `auth`, `billing`,
  `errors`, `email`, and a per-feature namespace added by each later prompt
  (e.g. `backup`, `snapshots`, `settings`). Document the convention in a short
  README under `server/src/shared/i18n/` and `client/src/shared/i18n/`.
- 1.2 Key style: dotted, lowerCamel leaf (`errors.projectNotFound`,
  `email.passwordReset.subject`). Interpolation uses `{{var}}` and the **same var
  names** in every locale.
- 1.3 Export a single `SUPPORTED_LOCALES = ['en','ar','fr','de','es','ru','zh']`
  and `DEFAULT_LOCALE = 'en'` constant, reused by client and server so the list
  has one source of truth per side.

### Phase 2 — Client i18n
- 2.1 Add deps: `i18next`, `react-i18next`, `i18next-browser-languagedetector`
  (pinned, public npm). Create
  `client/src/shared/i18n/index.ts` initializing i18next with the language
  detector (order: cookie → `navigator.language` → `en`), `fallbackLng: 'en'`,
  the namespace list, and the locale resources.
- 2.2 Create locale JSON per namespace under
  `client/src/shared/i18n/locales/{en,ar,fr,de,es,ru,zh}/<namespace>.json`.
  Seed `common`, `auth`, `billing`, `errors`, `email` with real translations
  (not English placeholders) in all 7.
- 2.3 Persist the chosen language to a cookie via `saveCookie` on change; read it
  on init via `loadCookie`. On language change, set `document.documentElement.lang`
  and `document.documentElement.dir` (`rtl` for `ar`, else `ltr`).
- 2.4 Mount the provider/init in `client/src/app/providers.tsx`. Add a
  `LanguageSwitcher` component (named export, keyboard-accessible, `aria-label`,
  no AI-tell styling) listing the 7 languages.
- 2.5 Replace any hardcoded UI strings in kept features (`auth`, `billing`,
  `dashboard`, `admin`) with `useTranslation()` keys.

### Phase 3 — Server i18n
- 3.1 Create `server/src/shared/i18n/index.ts`: a typed dictionary
  `DICTIONARIES[locale][namespace][key]`, a `resolveLanguage(acceptLanguage,
  override?)` that maps an `Accept-Language` header (with quality values) +
  optional `x-lang`/cookie to a supported locale (fallback `en`), and a
  `translate(locale, key, vars?)` doing `{{var}}` interpolation.
- 3.2 Create `server/src/shared/middleware/language.ts` (named export
  `language`): reads `x-lang` header / language cookie / `Accept-Language`, sets
  `req.language` and `req.t = (key, vars) => translate(req.language, key, vars)`.
  Augment `server/src/shared/types/express.d.ts` with `language: string` and
  `t: (key: string, vars?) => string`.
- 3.3 Mount `language` in `server/src/app.ts` **after `requestId`, before routes**
  (preserve the rest of the order exactly).
- 3.4 Wrap `error-handler.ts`: when an `HttpError` carries a message **key**,
  translate it via `req.t` before sending; non-key messages pass through. Keep the
  status-code contract unchanged.
- 3.5 Localize `communication` emails: `deliverPasswordResetEmail` /
  `deliverContactForm` resolve subject + body from the `email` namespace in the
  recipient's resolved language; `sendEmail(message)` transport unchanged.
- 3.6 Add `DEFAULT_LOCALE` (optional, default `en`) to `server/src/config/env.ts`.

### Tests
Server (`server/`, vitest, `fileParallelism:false`, v8 coverage, supertest
against `createApp()`, `startMemoryMongo`/`stopMemoryMongo`/`clearCollections`):
**100% coverage target** (lines/branches/functions/statements).
- **Key parity:** assert all 7 locales expose the identical set of keys per
  namespace — no missing, no extra — and that every key's interpolation
  placeholders (`{{…}}`) match across locales (the cardinal i18n test).
- Detection: `resolveLanguage` returns the right locale for `Accept-Language:
  fr-FR,fr;q=0.9,en;q=0.8` → `fr`; honors `x-lang: ar` override; falls back to
  `en` for `xx-YY`/empty.
- Middleware: a request with `Accept-Language: de` gets `req.language === 'de'`
  and `req.t('errors.someKey')` returns the German string; supertest a route that
  throws `HttpError.notFound('errors.projectNotFound')` and assert the body
  message is localized per `Accept-Language`.
- Email: password-reset subject/body render in the recipient's language; inject a
  mock transport boundary (no real Mailgun call).
Client (`client/`, vitest + RTL, jsdom): switching language updates rendered
strings; `document.dir === 'rtl'` after selecting `ar` and `ltr` otherwise;
cookie persists and is re-read on init; unknown stored language falls back to
`en`. Cover loading/empty/error states of the switcher.
- Mock boundaries: detection source (`navigator.language`) and the cookie util
  are injectable/markable so detection is deterministic.

### i18n
This **is** the i18n prompt. Deliverables: the 7-locale resource trees (client
JSON + server dictionary), the parity test, the detection + RTL behavior, and the
documented namespace/key convention that every later prompt extends. No feature
may hardcode strings after this lands; each later prompt adds its namespace to all
7 locales and extends the parity test.

### Documentation
- `/docs`: a user-facing "Languages & regional settings" page (supported
  languages, how auto-detection works, switching language, RTL note) — authored in
  all 7 locales.
- Internal: the namespace/key convention README under both `shared/i18n/`
  directories (developer-facing → `en` only is acceptable).
- `CLAUDE.md`: amend §9 to record that i18n is now first-class (7 locales +
  auto-detection), superseding "No i18n framework".
- `.env.example`: document `DEFAULT_LOCALE` (optional, default `en`).

## Agents & Skills

- **Agents:** `backend-dev` (primary — server dictionary, middleware,
  error-handler wrap, localized email), `react-specialist` (i18next init, locale
  JSON, switcher, RTL `dir`).
- **Skills:** `backend-i18n` (server-side translation, error/email localization,
  key-completeness testing); `ui-ux-pro-max` + `shadcn-design-system-compliance`
  (accessible, RTL-correct switcher); `code-review` (parity + convention pass);
  `verify` / `run` (exercise detection in a real request and a language switch).

## Idempotency Contract

Re-running MUST NOT: duplicate locale JSON files or dictionary entries; add the
`language` middleware twice (detect existing mount and skip); re-wrap
`error-handler.ts` a second time; re-add `DEFAULT_LOCALE` to the env schema;
register the `I18nextProvider`/switcher twice; or create duplicate namespace
keys. Reconcile the locale trees, middleware mount, error-handler wrap, and env
schema **in place** so every run converges to the same 7-locale parity state.
