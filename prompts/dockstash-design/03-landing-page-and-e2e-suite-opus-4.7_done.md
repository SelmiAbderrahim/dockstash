# Phase 03 — The Landing Page + E2E Suite — Design-Upgrade Prompt

> **The centerpiece.** Make a first-time visitor visibly *stunned*, then *act* — the
> highest-stakes surface, spend disproportionate care. Plus the **Ordered task**: this
> phase **creates** the Playwright E2E suite (`client/e2e/`, four projects) that becomes
> a permanent repo asset and gates every phase from here on (G-20). "Wow" must cost no
> Core Web Vitals (G-12).

---

## Agent

`react-specialist` (primary — `Home.tsx`, marketing sections) + `e2e-playwright-specialist`
(the new suite) + `Accessibility Auditor` (a11y project). **Depends on Phase 02**
(shell/tokens/primitives) — the landing composes the marketing variant of the unified
shell. Also uses the marketing SSR primitives from `shared.tsx` (`TerminalFrame`,
`InvertedBand`, `FaqSection`, `pattern-dot-grid`, `Serif`).

## Preflight (blocking)

Run `GATE-MACHINERY.md` **§f verbatim** — STOP on any FAIL. Phase-specific extras:

- Phase-02 gate-out green: its file `_done`-renamed; G-09/G-17/G-19 `done` in the
  matrix; `(cd client && npx vitest run src/shared/ui)` green (the primitives this
  phase composes).
- Marketing shell is the Phase-2 variant — landing work builds **on** it, never
  re-inlines chrome.

## Scope fence — NOT this phase

| Deferred work | Owner |
|---|---|
| App-surface (authed) restyling | Phase 5 verifies; Phase 2 already shipped the shell |
| Meta/JSON-LD/hreflang/sitemap/llms.txt beyond what the landing already has | Phase 4 |
| Other marketing routes (`/pricing`, `/faq`, …) beyond shared-shell fallout | Phases 4/5 |
| CSP / `server/src/shared/middleware/` | Phase 6 |
| New tokens or design-rule amendments | done in Phase 2 — if a gap surfaces, STOP and reopen G-19, don't improvise |

## Coverage contract (100% v8 — non-negotiable)

- Landing/section components under `client/src/features/marketing/**` are **inside**
  the 100% threshold — every new section ships its co-located `*.test.tsx` in the same
  edit (render, i18n keys resolve, SSR-safe — no `window` access at module scope).
- After each landing section lands: `(cd client && npx vitest run --coverage)` before
  the next section. GATE-CORE at phase end is confirmation, not discovery.
- `client/e2e/**` lives **outside** `client/src/`, so the vitest
  `include: ['src/**']` scoping already excludes it from coverage — **document this in
  `playwright.config.ts` comments; do not add vitest `exclude` entries** (vitest 2.1.9
  quirk, memory).
- Diagnose any <100% run per `GATE-MACHINERY.md` §g.

## Skill gates (MANDATORY — load before touching the surface)

| Skill | Load it for | Satisfies |
|---|---|---|
| `landing-page-optimization` | hero structure, section order, CTA hierarchy | G-01, G-12 |
| `page-cro` | friction/conversion analysis of the landing funnel | G-01 |
| `copywriting` | all hero + section copy (no lorem, no fake testimonials/logos) | G-01 |
| `marketing-psychology` | persuasion levers, trust framing | G-01 |
| `dataviz` | **only if** the landing adds any chart/metric visual — monochrome ramp, data-table fallback | G-01, SPEC-10 |

## Mission

### The landing page (`client/src/features/marketing/components/Home.tsx`, SSR)

> **Visual direction authority:** `REFERENCE-LANDING-INSPIRATION.md` (LP-01…LP-09 —
> transcribed from the uploaded Mobbin-class reference screenshot). It sets the copy
> budgets, section rhythm, motion map, and conversion spine for everything below; run
> its application checklist before this phase's gate-out. Where it conflicts with
> `dockstash-design-system.md`, the rule file wins (log §5).

1. **Hero** lands the value proposition in under 3 seconds — "back up your entire Docker
   project" — striking visual impact, one unmistakable CTA. Copy from `copywriting`;
   structure + CTA hierarchy from `landing-page-optimization` + `page-cro`; persuasion
   from `marketing-psychology`. Anatomy per `dockstash-design-system.md` §4: eyebrow →
   H1 with **one** `Serif` italic accent → one-paragraph sub → CTA pair (solid primary
   with `ArrowRightIcon` + `outline`) → `CheckItem` trust row → badge chips, on a
   `pattern-dot-grid` backdrop.
2. **Scroll-driven storytelling:** choreographed one-shot `Reveal`s (240ms,
   reduced-motion-gated), layered depth, moments of delight — **without** hurting load
   time, SSR-visibility, or accessibility. The `TerminalFrame` install-command moment is
   the signature detail: developers buy what they can paste.
3. **Rhythm:** every section composed and inevitable, generous `sectionClass` whitespace
   (not rules); memorable signature details (hero `pattern-dot-grid` + serif accent,
   terminal moment, `InvertedBand` closing CTA via the `dark` token scope).
4. **FAQ stays native `<details>`** (`FaqSection`) — answers must exist in SSR HTML for
   crawlers/answer engines. **Never** swap for a JS-only accordion.
5. **Optimize first meaningful paint + hero load ruthlessly** — the "wow" cannot cost
   speed (LCP < 2.5s, CLS < 0.1).

**Section-by-section SSR proof (build order = proof order).** After each landing
section lands, prove it exists in **server-rendered** HTML before writing the next —
SSR visibility is verified per section, never assumed at the end:

```bash
curl -fsS "$WEB/" | grep -q '<distinctive copy from the new section>' \
  && echo 'PASS SSR: <section>' || echo 'FAIL SSR: <section>'
```

Sections in order: hero (H1 + serif accent + CTA pair) → trust row → feature grid →
terminal moment (`TerminalFrame` install command) → steps → FAQ (`<details>` with
answer text present in HTML) → `InvertedBand` CTA. A section whose copy is absent from
the curl output is client-only rendering — a STOP (breaks AEO + G-10 groundwork).
Each PASS line goes into ledger §3. Every string through `t(...)` — the parity suites
gate all 7 locales (`client/src/shared/i18n/locales/*/marketing.json`).

### Ordered task — bootstrap the E2E suite (G-20)

Playwright is not installed and `client/e2e/` does not exist (verified at baseline).
Create it now, exactly as specified:

1. **Install.**
   ```bash
   npm --prefix client install -D @playwright/test @axe-core/playwright
   (cd client && npx playwright install chromium)
   # Only if launch fails on missing system libs (record the fix in ledger §3):
   # (cd client && npx playwright install --with-deps chromium)
   ```
   The new devDependencies must not introduce a high/critical advisory
   (`cd client && npm audit --audit-level=high` still exits 0 — SEC-05 pre-check).
2. **Ignore artifacts.** Append to `client/.gitignore`:
   `test-results/`, `playwright-report/`, `blob-report/`. Never commit traces or
   reports.
3. **Config skeleton** — `client/playwright.config.ts`; deviate only with a §5 note:
   ```ts
   import { defineConfig } from '@playwright/test';

   // E2E lives outside src/, so vitest coverage (include: ['src/**']) never sees it.
   // Coverage for these flows is behavioral, via the compose stack.
   const baseURL = process.env.PLAYWRIGHT_BASE_URL;
   if (!baseURL) {
     // Never default to a hardcoded port (BAN-08) — derive from .env WEB_PORT:
     //   WEB_PORT=$(grep -E '^WEB_PORT=' ../.env | cut -d= -f2)
     //   export PLAYWRIGHT_BASE_URL="http://127.0.0.1:${WEB_PORT}"
     throw new Error('PLAYWRIGHT_BASE_URL is required (derive from root .env WEB_PORT)');
   }

   export default defineConfig({
     testDir: './e2e',
     retries: 1,                      // §c flake policy: pass-on-retry = flake, log §5
     use: { baseURL, trace: 'on-first-retry' },
     projects: [
       { name: 'smoke',     testMatch: /smoke\/.*\.spec\.ts/ },
       { name: 'a11y',      testMatch: /a11y\/.*\.spec\.ts/ },
       { name: 'locale-ar', testMatch: /locale-ar\/.*\.spec\.ts/ },
       { name: 'cwv',       testMatch: /cwv\.spec\.ts/ },
     ],
   });
   ```
4. **Fixtures** — `client/e2e/fixtures.ts`, four named fixtures, reused by every spec:
   - **theme** — the theme is class-based (`localStorage 'theme'` + `.dark` on the root
     element, mirroring `ThemeProvider` and the `index.html` no-flash script), so
     `emulateMedia` is NOT sufficient. Dark:
     `page.addInitScript(() => localStorage.setItem('theme', 'dark'))` before `goto`.
   - **locale** — Arabic via URL prefix (`/ar/...`) for marketing SSR routes; app shell
     via the existing locale mechanism (`lang` cookie / switcher). Assert
     `html[dir="rtl"]`.
   - **auth** — mint a JWT signed with the root `.env` `JWT_SECRET` (memory: mint owner
     JWT from `.env`), set it as the `token` cookie on the context. Read `.env` at
     runtime; **never commit tokens or credentials**.
   - **origin-proxy** — the local bundle may bake the prod `VITE_*` origin
     (`GATE-MACHINERY.md` header caveat): `page.route('<prod-origin>/**', route =>
     route.continue({ url: rewrittenTo(baseURL) }))`. Add it the moment a browser API
     call fails for this reason; record the fixture in the ledger. Never edit `.env`.
5. **Projects — required minimum specs:**
   - **`smoke`** (`e2e/smoke/*.spec.ts`) — every SSR marketing route from the Phase-1
     inventory renders (HTTP 200 + `h1` visible + zero console errors); login flow;
     dashboard loads authed; register-agent dialog opens.
   - **`a11y`** (`e2e/a11y/*.spec.ts`) — `@axe-core/playwright` with tags
     `wcag2a, wcag2aa, wcag21a, wcag21aa` on every touched surface × light + dark +
     RTL. Zero violations = pass; each violation is a STOP-and-fix, never an axe
     `disableRules`.
   - **`locale-ar`** (`e2e/locale-ar/*.spec.ts`) — `/ar` marketing + app shell:
     `dir="rtl"` set, Arabic strings render (spot-assert real translated strings, not
     just attribute flips), sidebar on the correct side.
   - **`cwv`** (`e2e/cwv.spec.ts`) — buffered observers, injected **before** navigation
     via `addInitScript`:
     ```ts
     // CLS: new PerformanceObserver(sum layout-shift entries w/o recent input)
     //   .observe({ type: 'layout-shift', buffered: true })   → total < 0.1
     // LCP: .observe({ type: 'largest-contentful-paint', buffered: true })
     //   → last entry startTime < 2500 ms on the compose stack
     ```
     Assert after `networkidle` + a settle delay so late shifts count.
6. **Permanence.** The suite joins the repo permanently. Do not wire it into
   `.github/workflows/ci.yml` in this run (CI has no compose stack) — record that as a
   §5 follow-up with owner instead.

## Operating Constraints

| Rule | Detail |
|---|---|
| SSR-visibility | Hero, FAQ answers, and all copy must exist in server-rendered HTML (AEO + crawlers). FAQ = `<details>`, never JS-only. |
| No fake proof | No lorem, no invented testimonials, no fake logos. Real copy only. |
| One accent per headline | Exactly one `Serif` italic phrase per display headline; never in body/buttons/labels. |
| Motion budget | One-shot `Reveal` (240ms), spin, accordion, `transition-colors`/`opacity` ≤200ms — nothing else. `prefers-reduced-motion` honored. |
| CWV is a design constraint | LCP < 2.5s, CLS < 0.1, no blocking hero asset. Lazy-load below the fold. |
| Monochrome | BAN-04/05/12 apply — no gradient, no hex, no palette classes. |
| Ports from `.env` | `playwright.config.ts` reads `PLAYWRIGHT_BASE_URL`; never hardcode (BAN-08). |
| Zero console errors | The landing route must render with **no** browser-console errors. |

## Execute → Validate → Test

**Execute**
1. Load the five skills. Build the landing sections composing marketing primitives.
2. Bootstrap the E2E suite (Ordered task) — config + four projects + fixtures.
3. Boot the stack (`docker compose up -d --build`), verify the landing live at 320/768/
   1024/1440/1920 × both themes.

**Validate**
```bash
# GATE-CORE (GATE-MACHINERY.md §b) — all three packages exit 0:
#   ...typecheck / lint / vitest --coverage ×3...
# BAN block (GATE-MACHINERY.md §d) — clean or excepted.
# G-20 — suite exists:
test -d client/e2e && echo 'PASS G-20 dir' || echo 'FAIL G-20 dir'
```

**Test — GATE-E2E first full run (GATE-MACHINERY.md §c)**
```bash
docker compose up -d --build
docker compose ps                      # all healthy → paste into ledger §3
export PLAYWRIGHT_BASE_URL="$WEB"
(cd client && npx playwright test)     # ALL four projects: smoke, a11y, locale-ar, cwv — green
```
- Landing screenshots at all five widths × both themes indexed in §4 (`§e` protocol).
- **STOP-and-fix:** any project red, any GATE-CORE failure, any console error on the
  landing route halts the phase. Fix, re-run the **entire** block, then advance.

## Gate out (Phase 3 → 4) — every box has a check command; all must PASS

- [ ] **G-20** suite exists —
      `test -d client/e2e && test -f client/playwright.config.ts && grep -q 'PLAYWRIGHT_BASE_URL' client/playwright.config.ts && echo 'PASS G-20 files'`;
      four projects present —
      `for p in smoke a11y locale-ar cwv; do grep -q "$p" client/playwright.config.ts || echo "FAIL project $p"; done; echo done`;
      first full GATE-E2E run green (§3 entry with all-projects output tail).
- [ ] **G-12** — `(cd client && npx playwright test --project=cwv)` green (CLS < 0.1,
      LCP < 2.5s); VISUAL — landing "wow" judged against the loaded skills, evidence
      §4.
- [ ] Landing §4 rows complete —
      `for w in 320 768 1024 1440 1920; do for t in light dark; do test -f .claude/plans/design-upgrade-evidence/home-$w-$t.png || echo "FAIL home-$w-$t"; done; done; echo done`.
- [ ] Zero console errors on `/` — asserted inside the smoke spec (the spec fails on
      any `console.error`), §3 entry.
- [ ] SSR proof lines for all seven landing sections in §3 —
      `grep -c 'PASS SSR' .claude/plans/design-upgrade-ledger.md` ≥ 7.
- [ ] FAQ is `<details>`-based —
      `curl -fsS "$WEB/" | grep -q '<details' && echo 'PASS details'`.
- [ ] GATE-CORE green (9 commands, §3); BAN block clean/excepted (§3);
      `cd client && npm audit --audit-level=high` exit 0 (Playwright added no advisory).
- [ ] Scope fence held — `git diff --name-only "$BASE_COMMIT"` shows no
      `server/src/shared/middleware/`, no `docker-compose.yml`, no `agent/`.

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
