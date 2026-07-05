# Master Prompt: Dockstash Design Upgrade & Scale

You are a senior product designer and front-end engineer tasked with elevating the Dockstash codebase to award-winning design standards. Dockstash is a Docker-first backup product: users register fleet agents on remote VPS hosts, assign Docker projects to them, and get restic-backed snapshots with verification and one-click restores. Your work is judged on four axes at once: **craft** (Awwwards Site of the Day, CSS Design Awards, FWA), **conversion** (a first-time visitor understands and acts), **discoverability** (search crawlers AND AI answer engines cite this product), and **security** (no design win may open — or leave open — a security hole). All four, not one.

## Agent

react-specialist + Accessibility Auditor. Skills: `dockstash-design` (the visual authority, packaging `.claude/rules/dockstash-design-system.md`), `shadcn`, `landing-page-optimization`, `page-cro`, `copywriting`, `marketing-psychology`, `seo-audit`, `ai-seo`, `schema-markup`, `site-architecture`, `dataviz`, `spec-driven-development`. For Phase 6 the repo's `security-auditor` agent and the `security-review` skill are **mandatory gates**, not options.

## Execution Contract — MANDATORY, ZERO TOLERANCE

You may not freelance design taste. The named skills are the source of design intelligence; **load the relevant skill before you touch the surface it governs** (gates are declared per phase below). Specifically:

1. **Skills are gates, not suggestions.** Before styling anything, load `dockstash-design`. Before touching a component, load `shadcn`. Before the landing page, load `landing-page-optimization`, `page-cro`, `copywriting`, `marketing-psychology`. Before any meta/markup/structure work, load `seo-audit`, `ai-seo`, `schema-markup`, `site-architecture`. Before any chart, load `dataviz`. Before Phase 6, run `security-auditor` + `security-review`. A phase that skipped its skill is not done.
2. **Preserve behavior. No regressions.** Every route, data flow, API contract, socket event, and piece of functionality that worked before must work after — including the `/api/agent/*` machine surface the fleet agents depend on. Design changes never break behavior.
3. **Prove it against the running stack.** Boot the app (this repo: `docker compose up -d --build`, then `docker compose ps` — every container healthy: `api`, `web`, `mongo`, `redis`, `docker-socket-proxy`) and verify each upgraded surface live in a browser, at real breakpoints, in **both** light and dark themes. "It should work" is not proof.
4. **Self-audit before declaring done.** Re-open every surface you touched and check it against the Exit criteria. Report what you changed and why it serves simplicity, the award bar, conversion, discoverability, or security.
5. **Ship incrementally, tokens first.** Update shared tokens/primitives before pages so improvements cascade. State your plan, then execute surface by surface.
6. **Evidence or it didn't happen.** Every claim of completion maps to an entry in the evidence ledger (Gate machinery §a): a command's exit status, a screenshot file, or a pasted output tail. An unproven claim is an unfinished task.
7. **STOP-and-fix.** A failing gate halts the phase. Fix the failure, re-run the **entire** gate block for that phase (not just the failing command), and only then advance. Never advance on a partial pass. Never delete or weaken a gate to make it pass.
8. **Anti-skip.** Every requirement carries an ID (`G-xx` exit criteria, `BAN-xx` static bans, `SEC-xx` security). A phase whose IDs lack ledger evidence is not done — regardless of what the conversation transcript says. The ledger's traceability matrix is the only source of truth for "done".

### Exit criteria — every ID must be green in the ledger before you stop

- [ ] **G-01** Each phase's mandatory skill(s) were loaded and applied. — *verified by:* ledger §3 gate-run entries naming the skill loads per phase.
- [ ] **G-02** Complies with the design authority (`.claude/rules/dockstash-design-system.md`): monochrome semantic tokens only, no banned patterns, no reintroduced brand hue. — *verified by:* BAN-01…BAN-06 + BAN-12 PASS.
- [ ] **G-03** WCAG AA met — contrast ≥ 4.5:1 body text, visible focus states, full keyboard reach, screen-reader labels. — *verified by:* `a11y` Playwright project green (GATE-E2E) + keyboard-only sweep noted in ledger.
- [ ] **G-04** Verified in **both** light and dark themes on every touched surface. — *verified by:* visual-evidence index (§e) — both themes per surface.
- [ ] **G-05** Flawless from **320px to ultrawide**; RTL correct for `ar`. — *verified by:* screenshots at 320/768/1024/1440/1920 + `locale-ar` Playwright project green.
- [ ] **G-06** Every user-facing string exists in all **7 locales** (`en, ar, fr, de, es, ru, zh`). — *verified by:* i18n parity suites (client `src/shared/i18n` + server `src/shared/i18n`, inside the GATE-CORE coverage runs) green.
- [ ] **G-07** `prefers-reduced-motion` honored; interactions hold 60fps; no layout shift (CLS ~0). — *verified by:* `client/e2e/cwv.spec.ts` green + reduced-motion check logged.
- [ ] **G-08** Interaction hygiene: pointer cursor, in-button loading, all interaction states. — *verified by:* button/spinner unit tests + BAN sweep + per-surface state checklist in ledger.
- [ ] **G-09** One shared header/footer/shell system — no inlined or duplicated headers/footers, no hardcoded-English labels. — *verified by:* Phase 2 gate screenshots + grep proving no inlined header/footer markup remains in `client/src/features/marketing/components/MarketingLayout.tsx`.
- [ ] **G-10** SEO/AI-search surfaces valid: JSON-LD, meta/OG, hreflang, canonical. — *verified by:* Phase 4 curl gates PASS.
- [ ] **G-11** Repo gates green: typecheck, lint, and the test suite (100% v8 coverage on owned code) in **all three packages** (`client`, `server`, `agent`). — *verified by:* GATE-CORE, all commands exit 0.
- [ ] **G-12** Landing page delivers "wow" **without** a Core Web Vitals regression. — *verified by:* `cwv.spec.ts` green + Phase 3 screenshots.
- [ ] **G-13** No regression: all prior routes, flows, and functionality intact — including register-agent → assign project → run backup → restore. — *verified by:* GATE-E2E, all four Playwright projects green on the final run.
- [ ] **G-14** Security: every SEC-01…SEC-13 requirement green. — *verified by:* Phase 6 ledger entries.
- [ ] **G-15** Ledger complete: traceability matrix has **zero** non-green IDs and no empty Evidence cells on done rows.
- [ ] **G-16** Adversarial pass: Phase 5 + Phase 6 gate blocks re-run from scratch on a clean boot, all green (Completion protocol).
- [ ] **G-17** The two promoted conventions exist as rule files and are indexed. — *verified by:* `test -f .claude/rules/interaction-hygiene.md && test -f .claude/rules/shared-layout-system.md && grep -q interaction-hygiene CLAUDE.md && grep -q shared-layout-system CLAUDE.md`.
- [ ] **G-18** The Reference UI spec (SPEC-01…SPEC-12 below) is applied to **every authenticated surface** — dashboard, projects (list/new/detail), snapshots, fleet, billing, settings, setup wizard, profile, admin, AND every superadmin tab (Overview, Users, Billing, System, Audit). — *verified by:* per-surface SPEC checklist in the ledger + §e screenshots of each surface (both themes) showing the shell, stat-card, table, and status-chip anatomy.
- [ ] **G-19** The sanctioned design-system amendments (SPEC-A1…SPEC-A5) are written into `.claude/rules/dockstash-design-system.md` and the new tokens exist in `client/src/styles/tailwind.css` (light **and** dark values). — *verified by:* `grep -q 'warning' client/src/styles/tailwind.css && grep -qi 'status chip' .claude/rules/dockstash-design-system.md` + ledger diff review of the rule file.
- [ ] **G-20** The Playwright E2E suite exists, is wired to the compose stack, and is green. — *verified by:* `test -d client/e2e` + all four projects (`smoke`, `a11y`, `locale-ar`, `cwv`) passing in ledger §3. This run **creates** the suite (Ordered task, Phase 3); it becomes a permanent repo asset.

> The pipeline must never advance past a surface whose contract is not satisfied. A failing gate is a STOP, not a footnote.

## Gate machinery

All commands run from the repo root. Derive URLs from the root `.env` — **never hardcode host ports** (they differ between this host and CI; see `.claude/rules/site-url-env-pattern.md`):

```bash
WEB_PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
WEB="http://127.0.0.1:${WEB_PORT}"          # SSR web surface; proxies /api/* to the api service
export PLAYWRIGHT_BASE_URL="$WEB"
```

> **Local-stack caveat (known, documented):** the client bundle bakes `VITE_*` origins at build time, so a locally-composed stack may carry the production origin in the bundle. If browser API calls fail on the local stack for this reason, use a Playwright-level origin rewrite/proxy in the E2E fixtures rather than editing `.env` mid-run — and record the fixture in the ledger.

### §a Evidence ledger (create at Phase 0, maintain forever)

Path: `.claude/plans/design-upgrade-ledger.md`; binary evidence (screenshots) in `.claude/plans/design-upgrade-evidence/`. Never delete; append across sessions.

```markdown
# Design Upgrade Ledger — run artifact. Append-only.
BASE_COMMIT: <git rev-parse HEAD at Phase 0>
STARTED: <ISO timestamp>    RESUMED: <one timestamp per session>

## 1. Traceability matrix (the ONLY source of truth for "done")
| ID | Requirement (short) | Phase | Status | Evidence |
Statuses: todo / in-progress / blocked(<reason>) / done.
RULE: "done" REQUIRES a non-empty Evidence cell pointing at a §3 gate-run entry or a §4 file.

## 2. Accepted exceptions (allowlist for BAN gates)
| Gate | file:line | Justification | Added |

## 3. Gate runs (append-only: timestamp, phase, exact command, exit code, output tail)

## 4. Visual evidence index
| Surface | Breakpoint | Theme/Dir | File |

## 5. Deviations & follow-ups (explicitly out of this pass, each with a named owner-decision)
```

**Resume rule** (matches the `prompts/dockstash-build` executor pattern): on every session start, read the ledger, re-run GATE-CORE + the BAN block; any regression flips the affected IDs back to `in-progress`; resume at the first non-done ID in phase order. Never trust transcript memory over the ledger.

**Concurrent-session rule:** other Claude sessions may edit this tree at the same time. Before declaring any gate red, check `git status` for changes you did not make; isolate vitest coverage output (`--coverage.reportsDirectory`) per session if collisions appear. A gate failure caused by a concurrent session's in-flight work goes to ledger §5, not into a "fix".

### §b GATE-CORE (run at the end of every phase from Phase 2 on)

Mirrors `.github/workflows/ci.yml` (see `docs/ci-gates.en.md`) — all three packages, no allow-list:

```bash
npm --prefix client run typecheck
npm --prefix server run typecheck
npm --prefix agent  run typecheck
npm --prefix client run lint
npm --prefix server run lint
npm --prefix agent  run lint
(cd client && npx vitest run --coverage)   # 100% v8; includes client i18n parity suite
(cd server && npx vitest run --coverage)   # 100% v8; includes server i18n parity + seo.parity suites
(cd agent  && npx vitest run --coverage)   # 100% v8
```

Every command must exit 0. Paste each command's final status line into ledger §3. (The `agent/` package is UI-free; it is in the gate because shared types and vendored adapters must not drift while you refactor client/server.)

### §c GATE-E2E (phases 3, 5, 6, and the adversarial pass)

```bash
docker compose up -d --build
docker compose ps    # EVIDENCE: paste into ledger — api, web, mongo, redis, docker-socket-proxy all healthy
(cd client && npx playwright test)   # ALL projects: smoke, a11y (axe wcag2a/2aa/21a/21aa, light+dark+RTL), locale-ar, cwv
```

`PLAYWRIGHT_BASE_URL` must be exported from the `.env`-derived `$WEB` above. **The suite does not exist yet** — creating it is an Ordered task of Phase 3 (G-20). From Phase 3 onward this gate runs in full; in Phase 2 substitute the manual browser verification + §e screenshots and note "suite pending (G-20)" in the ledger.

### §d Static bans — paste-and-run block

Any `FAIL` line = phase not done, unless that exact `file:line` is in the ledger §2 exceptions table (seeded at the Phase 0 baseline; later additions need written justification). Never weaken a pattern to silence a hit.

```bash
g(){ grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -E "$1" "${@:3}" && echo "FAIL $2" || echo "PASS $2"; }
g 'transition-all|transition: *all'                          BAN-01 client/src --exclude-dir=ui
g 'backdrop-blur'                                            BAN-02 client/src --exclude-dir=ui
g 'hover:scale|hover:-translate|hover:shadow-(md|lg|xl)'     BAN-03 client/src
g 'bg-clip-text|bg-gradient-to'                              BAN-04 client/src --exclude-dir=ui
g '\[#[0-9a-fA-F]{3,8}\]'                                    BAN-05 client/src/features client/src/shared/components --exclude='*.test.*'
g '[" ](ml|mr|pl|pr)-[0-9]|[" ]text-(left|right)[" ]'        BAN-06 client/src/shared/components client/src/features --exclude='*.test.*' --exclude-dir=ui
g 'export default'                                           BAN-07 client/src server/src --exclude='*.config.*'
g 'http://localhost|127\.0\.0\.1'                            BAN-08 client/src server/src --exclude='*.test.*' --exclude='*.spec.*'
g 'dangerouslySetInnerHTML'                                  BAN-09 client/src server/src
b10=0; for f in $(grep -rl 'target="_blank"' client/src --include='*.tsx'); do grep -q noopener "$f" || { echo "FAIL BAN-10 $f"; b10=1; }; done; [ "$b10" -eq 0 ] && echo 'PASS BAN-10'
g 'fonts\.googleapis|fonts\.gstatic|use\.typekit|cdn\.jsdelivr|unpkg\.com|cdnjs\.' BAN-11 client/src client/index.html server/src
g '(bg|text|border|from|to|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]' BAN-12 client/src --exclude-dir=ui --exclude='*.test.*'
```

Notes (do not argue with these at run time):

- BAN-01/02/04/12 exclude `client/src/shared/ui/**` (vendored shadcn, coverage-excluded); the bans target feature code per `.claude/rules/dockstash-design-system.md`.
- **BAN-12 is the monochrome gate** — the design system is achromatic; zero Tailwind palette-hue classes (including gray-family classes: `slate/gray/zinc/neutral/stone`) outside vendored `ui/`. Emphasis is contrast + weight, never hue.
- BAN-09's target is **zero hits repo-wide** — the repo is already clean; SEC-01 keeps it that way. It never enters the exceptions table.
- BAN-10 is a **file-level** sweep (Prettier puts JSX attributes on separate lines, so a same-line grep false-fails). Every file containing `target="_blank"` must also contain `noopener`; the per-instance check — each individual anchor carries `rel="noopener noreferrer"` — is the SEC-03 logged review.
- BAN-06 enforces the RTL logical-property rule (dockstash-design-system §7): `ps-`/`pe-`/`ms-`/`me-`/`text-start` only, outside vendored `ui/`.
- BAN-07/08: run once at the Phase 0 baseline; genuine pre-existing hits go into ledger §2 with `file:line` — the patterns are never loosened. (Likely baseline candidates: zod URL defaults in `server/src/config/env.ts` and any client origin fallbacks — verify at run time, seed §2, do not silently ignore.)
- Emoji-as-icons is a **visual review item** (unreliable to grep) — checked in the Phase 5 sweep. lucide-react only.

### §e Visual-evidence protocol

For every touched surface: capture 320/768/1024/1440/1920, light **and** dark, plus `ar` RTL; index every file in ledger §4.

```bash
mkdir -p .claude/plans/design-upgrade-evidence
for w in 320 768 1024 1440 1920; do
  (cd client && npx playwright screenshot --viewport-size="${w},900" \
    "$WEB/" "../.claude/plans/design-upgrade-evidence/home-${w}-light.png")
done
(cd client && npx playwright screenshot --viewport-size="768,900" \
  "$WEB/ar" "../.claude/plans/design-upgrade-evidence/home-ar-rtl.png")
```

Dark theme: the app controls it via the `.dark` class on the root element (manual toggle, `@shared/theme/ThemeProvider`, no-flash head script). If a plain screenshot can't flip it, add a small helper spec under `client/e2e/` that toggles the theme then screenshots — Playwright only, **no new tooling** (no lighthouse). Authenticated surfaces need a login fixture (seed a user against the compose stack, or mint a JWT from the root `.env` secrets — never commit credentials).

## Phase 0 — Setup, baseline & ledger (do before anything else)

> **Gate:** `dockstash-design` and `seo-audit` loaded (they inform the audit). Load the others at their phase gate. Do not substitute personal taste for what these skills prescribe.

1. Record `BASE_COMMIT=$(git rev-parse HEAD)` into the ledger header. Note: any uncommitted design work already in flight in the tree is **part of this run** and is gated like everything else.
2. Create the evidence ledger (§a) with **every** G/SEC/BAN ID present in the matrix at `todo`.
3. Boot the stack (`docker compose up -d --build`; `docker compose ps` all healthy) and derive `$WEB` from `.env`.
4. Run GATE-CORE and the BAN block once as the **baseline**. Seed genuinely pre-existing BAN hits into the ledger §2 exceptions table with `file:line` and justification. Do not fix anything yet — this run is the yardstick.

## Phase 1 — Audit (do this first, silently)

> **Gate:** `dockstash-design`, `seo-audit`, `site-architecture` loaded.

1. **Map the codebase.** Client features: `auth`, `billing`, `dashboard`, `fleet`, `guide`, `marketing`, `profile`, `projects`, `settings`, `snapshots`, `admin`, `superadmin`. Marketing SSR routes (per `client/src/features/marketing/routes.tsx`, each also under `/:locale`): `/`, `/pricing`, `/alternatives` + `/alternatives/:slug`, `/vs/:slug`, `/compare/self-hosted-backup-vs-cloud-backup`, `/guides` + `/guides/:entry`, `/backup/:entry` (use cases), `/fleet-agents`, `/security`, `/faq`, `/privacy`, `/terms`, 404. App routes: `/dashboard`, `/projects` (+`/new`, `/:projectId`), `/snapshots`, `/fleet`, `/billing`, `/settings`, `/setup`, `/profile`, `/admin`, `/superadmin`, auth screens. List anything the map misses before touching it.
2. **Extract the existing design language.** The system is already defined: monochrome shadcn tokens in `client/src/styles/tailwind.css`, primitives in `client/src/shared/ui/`, marketing layout primitives in `client/src/features/marketing/components/shared.tsx` (`Serif`, `Eyebrow`, `CheckItem`, `FeatureCard`, `InvertedBand`, `FaqSection`, `TerminalFrame`, `CodeBlock`, `ComparisonTable`, `Breadcrumbs`, `LinkCard`, `h1Class`/`h2Class`/`sectionClass`, `pattern-dot-grid`). **Respect and extend this system — do not replace it.** You are scaling it up, not starting over.
3. **Run a `seo-audit` pass.** Record current meta/OG, headings, JSON-LD, hreflang, canonical, sitemap/robots/llms.txt (all served by `server/src/modules/seo/`), and Core Web Vitals baseline. This feeds Phase 4.
4. **Reference screenshots are BINDING for app surfaces.** The four shadcnspace admin screenshots are transcribed into the **Reference UI spec (SPEC-01…SPEC-12)** below. For every authenticated surface — including admin/superadmin — that spec is the layout/anatomy authority, rendered in Dockstash's monochrome tokens. For the SSR marketing surface, `.claude/rules/dockstash-design-system.md` §4 (section anatomy) still governs; the screenshots are directional there only.
5. **Flag friction.** Note every excess step, redundant click, unclear affordance, or dead end — especially in the three core funnels: register agent → paste install command → agent online; assign project → first backup succeeds; browse snapshots → restore. This list drives Phase 2, Key 1.

Present the audit findings and your upgrade plan **before** making changes.

> **Gate out (Phase 1):** audit findings + plan presented; ledger initialized with all IDs; Phase 0 baseline gate run recorded in §3; `docker compose ps` output pasted (every container healthy).

## Phase 2 — Upgrade, optimizing for two keys

> **Gate:** `dockstash-design`, `shadcn`, `page-cro` loaded. **The Reference UI spec (SPEC-01…SPEC-12) is the anatomy contract for this phase** — tokens and shell first (SPEC-01/02/03 + SPEC-A1…A5), then per-surface application.

### Key 1 — Radical simplicity & UX

- Reduce every core flow to the fewest steps and clicks. Collapse multi-step sequences, remove redundant confirmations, surface the primary action on every screen. (Apply `page-cro` friction analysis.) The agent-install flow (`AgentInstallCommand`, `AgentKeyReveal`, `AgentSetupDialog`) is the highest-friction moment in the product — make copy-paste-run feel effortless.
- Progressive disclosure: show what's needed now, hide complexity until requested (restic internals, adapter details, advanced schedules).
- Exactly one obvious primary action per view — clear hierarchy, one dominant CTA.
- Smart defaults, inline validation, forgiving inputs, instant feedback. Users never wait or wonder — backup and restore jobs stream progress (Socket.IO is already wired; `ResticLogPanel` exists).
- Zero dead ends: every empty, loading, and error state is designed, helpful, and offers a next step. The empty dashboard's next step is "register your first agent"; an offline agent's next step is troubleshooting, not a shrug.
- Full keyboard navigation, visible focus states, and accessible labels throughout.

### Key 2 — Award-winning, extremely responsive UI

- **Responsiveness is non-negotiable.** Flawless 320px → ultrawide. Fluid type/spacing (`clamp()`), container queries where useful; test the codebase's real breakpoints.
- Distinctive, intentional aesthetic per `dockstash-design` — the monochrome language is the identity: confident Inter typography with clear scale, one Instrument Serif italic accent per display headline, JetBrains Mono for terminal/code surfaces (`TerminalFrame` is a signature asset — use it), deliberate whitespace, flat 1px-bordered surfaces, dot-grid backdrops. Compose shadcn primitives; **do not hand-fight or restyle their internals.**
- Motion with purpose: the one-shot scroll `Reveal` (240ms, reduced-motion-gated), loader spin, accordion expand, `transition-colors`/`opacity` ≤ 200ms. Nothing else. Respect `prefers-reduced-motion`.
- Performance is design: lazy-load below the fold, optimize images, avoid CLS, keep interactions at 60fps.
- Any data visualization goes through `dataviz` (form heuristic, accessible color formula, light/dark parity, data-table fallback) — rendered in the monochrome `--chart-1..5` lightness ramp.
- Meet WCAG AA contrast and touch-target sizing.

### Interaction hygiene baseline (non-negotiable)

The "boring" fundamentals are usually where a project loses the award-level feel. None of these are optional, and they are **fixed at the primitive level so they cascade** — never patched per-usage.

- **Pointer affordance.** Every clickable element shows `cursor: pointer` on hover — buttons, links, tabs, menu items, switches, clickable cards. Disabled controls show `cursor: not-allowed` with reduced opacity. Set this on the base primitive (`Button`, `Link`), not on individual call sites.
- **Every async action shows progress in place.** The moment a button/control that triggers async work is clicked, it: (1) disables immediately to prevent double-submit, (2) shows an **in-button spinner or loading indicator** (not merely swapped label text elsewhere), and (3) restores on success *and* on error. Use ONE shared loading affordance across the app, not per-feature ad-hoc flags. This matters most on backup/restore triggers — long-running restic jobs must feel controlled, never frozen.
- **Design all interaction states.** Every interactive element ships: default, hover, focus-visible, active/pressed, disabled, and (where it does async work) loading. No element ships with only a default state.
- **No dead air.** Visible feedback within ~100ms of any click — optimistic update or spinner. Never a frozen UI with no signal that the click registered.
- **Keyboard parity.** Every hover affordance has a focus-visible equivalent; nothing is discoverable by mouse only.

**Current gaps to fix (verified in this tree):** `client/src/shared/ui/button.tsx` has no `loading` prop and there is no `spinner.tsx` primitive in `shared/ui/` — add both (a `Spinner` primitive wired into `Button` via a `loading` prop that disables + shows `Loader2 animate-spin`), then replace per-feature ad-hoc submitting flags with it. Verify the `cva` base string carries pointer/disabled cursor semantics.

### Unify the shell (structural — do this early so it cascades)

Fragmented headers/footers are a top tell of an unpolished app. Establish **one shared layout system** before restyling pages:

- Exactly **one** Header, **one** Footer, and **one** shell system — no headers or footers inlined/duplicated inside feature layouts. Today the app shell is `client/src/shared/components/AppLayout.tsx` (+ `Header.tsx`, `Footer.tsx`) while `client/src/features/marketing/components/MarketingLayout.tsx` inlines its own `<header>` and `<footer>` markup — consolidate: shared building blocks in `shared/`, with an **app variant** and a **marketing variant** composed from them.
- Consistent behavior everywhere: same sticky height and z-index, same mobile-menu mechanism (`Sheet`, replacing any native `<details>` menus in chrome — the marketing `MobileMenu.tsx` folds into this), theme and locale controls (`ThemeToggle`, the locale switcher) present on every surface, and **every** label internationalized via `t(...)` (no hardcoded strings).
- **This phase also migrates the app shell to the sidebar anatomy (SPEC-01/02/03)** using the already-vendored `client/src/shared/ui/sidebar.tsx` — `AppLayout.tsx` becomes the framed sidebar shell; the marketing variant stays a top-nav layout (SSR surface, per dockstash-design-system §4).
- A richer surface (marketing) may be a *variant* composed from the shared building blocks — never a second, divergent language. A user must not visibly cross layout styles mid-funnel (marketing → register → setup wizard → dashboard).

> **Gate out (Phase 2):** GATE-CORE green; BAN block clean (or excepted); i18n parity suites green (both packages); shell screenshots per §e — app **and** marketing header/footer variants, light+dark, `ar` RTL, at 320/768/1440; `grep -n '<header\|<footer' client/src/features/marketing/components/MarketingLayout.tsx` shows only composed shared components, no inlined markup (G-09); **G-17 executed now** — both rule files created and indexed (see Standing rules); **G-19 executed now** — SPEC-A1…A5 tokens landed in `tailwind.css` (light+dark) and written into `.claude/rules/dockstash-design-system.md`; the SPEC-01/02/03 shell (sidebar + topbar + framed content column) is live so every subsequent surface composes it. New primitives (`spinner.tsx`, `Button` `loading` prop, `StatChip`, `StatCard`, `StatusChip`, `IconTile`, `DeltaPill` — see SPEC) carry unit tests (`client/src/shared/ui/**` is excluded from the coverage threshold, tests are still required).

## Phase 3 — The Landing Page (the centerpiece)

> **Gate:** `landing-page-optimization`, `page-cro`, `copywriting`, `marketing-psychology` loaded.

The landing page (`client/src/features/marketing/components/Home.tsx`, server-rendered) must make a first-time visitor visibly *stunned*, then *act*. Highest-stakes surface — spend disproportionate care here.

- Hero lands the value proposition in under 3 seconds — "back up your entire Docker project" — with striking visual impact and one unmistakable CTA. Copy comes from `copywriting`; structure and CTA hierarchy from `landing-page-optimization` + `page-cro`; persuasion levers from `marketing-psychology`. No lorem, no fake testimonials, no invented logos.
- Scroll-driven storytelling: choreographed one-shot reveals, layered depth, moments of delight that reward scrolling — without hurting load time, SSR-visibility, or accessibility. The `TerminalFrame` install-command moment is the natural signature detail: developers buy what they can paste.
- Every section feels composed and inevitable, with generous rhythm (`sectionClass` whitespace, not rules) and a memorable signature detail (hero treatment with `pattern-dot-grid` + serif accent, terminal moment, `InvertedBand` closing CTA).
- The FAQ stays a native `<details>` accordion (`FaqSection`) — answers must exist in server-rendered HTML for crawlers and answer engines. Never swap it for a JS-only accordion.
- Optimize first meaningful paint and hero load ruthlessly — the "wow" cannot cost speed (LCP/CLS budget below).

### Ordered task — bootstrap the E2E suite (G-20)

Playwright is not installed and `client/e2e/` does not exist. Create it now, as part of this phase:

1. Add `@playwright/test` (+ `@axe-core/playwright`) as client devDependencies; `npx playwright install chromium`.
2. Create `client/playwright.config.ts` reading `PLAYWRIGHT_BASE_URL` from the environment (derived from `.env` `WEB_PORT` — never hardcoded), with four projects: **`smoke`** (marketing routes render, auth flow, dashboard loads, register-agent dialog opens), **`a11y`** (axe wcag2a/2aa/21a/21aa on every touched surface, light + dark + RTL), **`locale-ar`** (RTL layout + Arabic strings on marketing and app shells), **`cwv`** (`client/e2e/cwv.spec.ts` asserting CLS < 0.1 via `performance.getEntriesByType('layout-shift')` and the LCP element rendered < 2.5s on the compose stack).
3. Add the local-stack origin fixture if the baked `VITE_*` origin breaks API calls (see Gate machinery caveat).
4. The suite joins the repo permanently; e2e specs are excluded from the vitest coverage scan (they are Playwright-run), documented in the config.

> **Gate out (Phase 3):** GATE-E2E green (first full run of the new suite); landing screenshots at all five widths × both themes indexed in §4; zero browser-console errors on the landing route.

## Phase 4 — SEO & AI-search discoverability

> **Gate:** `seo-audit`, `ai-seo`, `schema-markup`, `site-architecture` loaded.

Dockstash sells to developers who search and ask AI assistants; its own surfaces must be exemplary.

- Fix everything the Phase 1 `seo-audit` flagged: titles, meta descriptions, heading hierarchy, canonical, sitemaps/robots, internal linking (`site-architecture`). The SEO infrastructure lives in `server/src/modules/seo/` (robots.txt, sitemap index + `sitemap-core/alternatives/guides/usecases.xml`, llms.txt) and `client/src/shared/seo/` (`Seo.tsx`, `meta.ts`, `schema.ts`) — extend these, do not fork them.
- Structured data via `schema-markup`: JSON-LD (Organization, SoftwareApplication/Product, FAQ, BreadcrumbList as applicable) that parses as valid JSON with the required `@type` keys. Google Rich Results is a post-ship manual check — record it as a ledger §5 follow-up, not a claim.
- Per-locale `hreflang` + OG/Twitter cards on every SSR marketing route — all seven locales, all routes including the programmatic sets (`alternatives/:slug`, `vs/:slug`, `guides/:entry`, `backup/:entry`).
- Apply `ai-seo` (AEO/GEO): structure content so AI answer engines (AI Overviews, ChatGPT, Perplexity, Claude) can cite it — clear question-shaped headings, extractable answers (the `<details>` FAQ pattern already serves this), entity clarity ("Dockstash", "Docker backup", "restic", "fleet agent"), and a current llms.txt.
- Core Web Vitals are a **design constraint**, not an afterthought — LCP, CLS, INP stay in budget.

> **Gate out (Phase 4)** — run against the live stack, repeat the HTML checks for every SSR marketing route:

```bash
curl -fsS "$WEB/robots.txt"
curl -fsS "$WEB/sitemap.xml" | head -5
curl -fsSI "$WEB/llms.txt" | grep -i 'content-type: text/plain'
curl -fsS "$WEB/" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=[...s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];if(!m.length){console.error("FAIL: no JSON-LD");process.exit(1)}m.forEach(x=>JSON.parse(x[1]));console.log("PASS: "+m.length+" JSON-LD block(s) valid")})'
for l in en ar fr de es ru zh; do curl -fsS "$WEB/" | grep -qi "hreflang=\"$l\"" && echo "PASS hreflang $l" || echo "FAIL hreflang $l"; done
curl -fsS "$WEB/" | grep -q 'rel="canonical"' && echo 'PASS canonical' || echo 'FAIL canonical'
```

## Phase 5 — Verify & harden

> **Gate:** Accessibility Auditor pass.

- Accessibility Auditor sweep: keyboard-only path, screen-reader labels, focus order, contrast — on every touched surface, including dialogs (`RestoreDialog`, `RegisterAgentDialog`, `AgentSetupDialog`, `AlertDialog` confirmations).
- Light/dark parity verified visually on every surface.
- Responsive sweep across the real breakpoints, 320px → ultrawide, including RTL for `ar` (logical utilities only — `ps-`/`pe-`/`text-start`, per dockstash-design-system §7).
- Confirm `prefers-reduced-motion`, 60fps, no CLS.
- Visual review for emoji-as-icons (lucide-react only) and any banned pattern the greps can't see (serif accent creeping into UI chrome, more than one accent per headline, shadow escalation on overlays that aren't overlays).
- No-regression check: every prior route/flow still works — register agent, assign project, run backup, browse snapshots, restore, billing checkout, superadmin tabs.

> **Gate out (Phase 5):** the full stack — GATE-CORE + GATE-E2E (all four projects, including `locale-ar`) + the complete BAN block + the full §e screenshot sweep across every touched surface. All green, all in the ledger.

## Phase 6 — Security gate (100% security)

> **Gate:** repo `security-auditor` agent + `security-review` skill run. Do **not** use `prompts/SECURITY.md` as authority — it targets a different stack; only its find→fix→verify ledger discipline carries over.

Design changes touch the highest-exposure surfaces: SSR HTML, head tags, links, fonts, the client bundle. Dockstash additionally holds secrets that must never surface: the `MASTER_ENCRYPTION_KEY`, per-agent Bearer tokens, restic repository passwords, and destination credentials. Every SEC item below is a gate — fix, verify, record. All evidence into the ledger.

- **SEC-01 — Zero `dangerouslySetInnerHTML`, kept at zero.** The repo is clean today; it stays clean. Styled fragments, if ever wanted, are composed JSX — never HTML strings. *Gate:* BAN-09 PASS repo-wide.
- **SEC-02 — JSON-LD stays `JSON.stringify`-as-children.** The safe pattern is `client/src/shared/seo/Seo.tsx` (`<script type="application/ld+json">{JSON.stringify(doc)}</script>` via Helmet, schema built in `client/src/shared/seo/schema.ts`). All new schema markup uses it. *Gate:* `grep -rn 'ld+json' client/src server/src` hits only that pattern.
- **SEC-03 — every `target="_blank"` anchor carries `rel="noopener noreferrer"`.** *Gate:* BAN-10 PASS (file-level) + a logged per-instance review of every `target="_blank"` hit confirming the `rel` attribute on that same element.
- **SEC-04 — No secrets in the client bundle.** Only `VITE_*` values may reach the browser. *Gate:*

  ```bash
  npm --prefix client run build
  grep -rEn 'sk_live|sk_test|whsec_|polar_(at|oat)|re_[A-Za-z0-9]|AIza|-----BEGIN' client/dist && echo 'FAIL SEC-04a' || echo 'PASS SEC-04a'
  grep -E '^[A-Z_]+=' .env | grep -v '^VITE_' | cut -d= -f2- | while read -r v; do
    [ ${#v} -ge 12 ] && grep -rqlF -- "$v" client/dist && echo "FAIL SEC-04b: server env value leaked"; done; echo 'SEC-04b sweep done'
  ```

  (The SEC-04b sweep covers `JWT_SECRET`, `SESSION_SECRET`, `MASTER_ENCRYPTION_KEY`, `SUPERADMIN_PASSWORD`, Polar and Resend credentials — any ≥12-char non-VITE value from the root `.env`.)
- **SEC-05 — Dependency audit.** `(cd client && npm audit --audit-level=high)`, `(cd server && npm audit --audit-level=high)`, and `(cd agent && npm audit --audit-level=high)` all exit 0 (zero high/critical — mirrors the CI gate; the new Playwright devDependency must not introduce an advisory).
- **SEC-06 — No weakening of security middleware.** *Gate:* `git diff --name-only "$BASE_COMMIT" -- server/src/shared/middleware/` is empty, OR every hunk is reviewed and justified in ledger §2 — helmet config (`security-headers.ts`), CSRF double-submit (`csrf.ts`, keeps `timingSafeEqual`), the auth/webhook rate limiters (`rate-limit.ts`), `require-auth.ts`, `require-agent-auth.ts` (the fleet-agent machine surface), and `require-role.ts` are never loosened. The SEC-11 CSP change is the one sanctioned (strengthening) diff.
- **SEC-07 — Fonts stay self-hosted.** Inter, JetBrains Mono, and Instrument Serif already ship via `@fontsource` packages from the repo's own origin — keep it that way, preloaded where on the LCP path, `font-display: swap` — never a third-party CDN (performance + privacy). *Gate:* BAN-11 PASS + `curl -fsS "$WEB/" | grep -E 'preload[^>]*font'` shows a same-origin href.
- **SEC-08 — i18n values render as text, never HTML.** Locale strings flow only into text children/attributes via `t(...)` / server `translate(...)` — never into `__html`, `href`/`src` construction, or template-built markup. *Gate:* BAN-09 + a logged review of every new `t(` call site.
- **SEC-09 — Zero external scripts on SSR pages.** *Gate:* `grep -rnE '<script[^>]*src="https?://' client/index.html client/src server/src` empty. Marketing SSR ships no third-party script tags, period.
- **SEC-10 — Adversarial review, zero unresolved findings.** Run the repo `security-auditor` agent AND the `security-review` skill (branch mode) against `git diff "$BASE_COMMIT"`. Every finding is fixed, or recorded in ledger §5 with an explicit user-visible justification. "Unreviewed" is a failing state.
- **SEC-11 — Content-Security-Policy (ordered task — the repo currently has none).** Enable CSP via the existing helmet middleware (`server/src/shared/middleware/security-headers.ts`, where `contentSecurityPolicy: false` today) for the SSR web surface and the API, in two steps:
  1. Ship `Content-Security-Policy-Report-Only` with the starter policy below; drive all Playwright projects plus a manual click-through; collect violations from the browser console.
  2. Fix every violation (hash/nonce the inline no-flash theme-bootstrap script; inline JSON-LD is inert data — `type="application/ld+json"` never executes and needs no `unsafe-inline`), then **enforce**.

  Starter policy:

  ```text
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self';
  object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```

  (`style-src 'unsafe-inline'` is the pragmatic starter for React inline styles; tightening to hashes is a ledger §5 follow-up. `font-src 'self'` is coherent because SEC-07 keeps fonts self-hosted. `connect-src 'self'` must still admit the Socket.IO endpoint — same origin through the web proxy; if any surface needs a third-party `connect-src` (e.g. Polar checkout), add the specific origin — never a wildcard — and log it in ledger §2.)

  *Gate:*

  ```bash
  curl -fsSI "$WEB/" | grep -i '^content-security-policy:' && echo 'PASS SEC-11a' || echo 'FAIL SEC-11a'
  curl -fsSI "$WEB/api/health" | grep -i '^content-security-policy:' && echo 'PASS SEC-11b' || echo 'FAIL SEC-11b'
  (cd client && npx playwright test)   # all projects green under the ENFORCED policy — zero CSP console violations
  ```

  The middleware change is server code: it needs a unit test asserting the header value (100% v8 threshold applies).
- **SEC-12 — Backup-secret surfaces untouched by design work.** No agent Bearer token, restic repository password, destination credential, or decrypted secret is ever rendered into DOM outside the existing explicit reveal flows (`AgentKeyReveal` — one-time reveal semantics preserved), logged to the browser console, or placed in a URL/query param. *Gate:* logged review of every touched component that handles agent keys or destination config + SEC-04 bundle sweep.
- **SEC-13 — Infrastructure trust boundary untouched.** `git diff "$BASE_COMMIT" -- docker-compose.yml agent/` contains no changes to the `docker-socket-proxy` least-privilege configuration, agent auth, or volume mounts — or every hunk is justified in ledger §2. Design work has no business at this layer.

**Named out-of-scope** (a decision, not an omission): broadening pino logger redaction across all server modules is observability work, not a design surface — record in ledger §5 as a follow-up with owner.

> **Gate out (Phase 6):** SEC-01…SEC-13 all green in the matrix with evidence. Any `FAIL` anywhere = the phase is open.

## Dockstash guardrails (repo-specific — pinned)

The stack-agnostic backbone above is reusable; **for this repo these are hard constraints.** The visual authority is `.claude/rules/dockstash-design-system.md` — defer to it on every visual question — as amended by the sanctioned SPEC-A1…A5 items in the Reference UI spec below (warning token, soft tints, pill status chips, tinted row actions, flat area fills). For authenticated-surface anatomy (shell, sidebar, tables, stat cards, detail pages — **including admin/superadmin**), the Reference UI spec section is the binding layout contract.

- **One design system: monochrome shadcn/ui.** Achromatic tokens — near-black `--primary` in light mode, near-white in dark (token inversion, oklch, in `client/src/styles/tailwind.css`). Flat cards, 1px border, `rounded-xl`, `shadow-xs` max on static surfaces, no hover lift/scale/shadow escalation. Monochrome chart ramp (`--chart-1..5` lightness steps); single-series charts stay `--primary`. **Semantic tokens only** (`bg-primary`, `text-muted-foreground`, `bg-muted/50`) — never raw hex or palette classes in feature code. **Never reintroduce a brand hue**: color is reserved for semantic state (`--destructive`, `--success`, and the SPEC-A1 `--warning`). Emphasis = contrast + weight, never hue.
- **Typography:** Inter for everything, JetBrains Mono for code/terminal, Instrument Serif *italic* as the single display accent — max one accent phrase per headline, never in body text, buttons, labels, badges, or dashboard chrome (use the `Serif` component). All three fonts self-hosted via `@fontsource` (SEC-07).
- **Banned everywhere:** gradient text/fills (only permitted "pattern" is the token-driven `pattern-dot-grid`), glassmorphism/backdrop blur, card-lift/scale on hover, `transition: all`, bounce/pulse (Skeleton excepted), parallax, marquee, emoji as icons (lucide-react only), pill **buttons** everywhere (no marketing exception — `rounded-full` only for status chips/badges per SPEC-A3, avatars, status dots, and the circled-check micro-icon).
- **Marketing (SSR) anatomy** (dockstash-design-system §4): centered hero with eyebrow → H1 with serif accent → one-paragraph sub → CTA pair (solid primary with `ArrowRightIcon` + `outline`) → `CheckItem` trust row → badge chips, on a `pattern-dot-grid` backdrop; `FeatureCard` grids; oversized serif-italic step numerals; `<details>`-based `FaqSection` (SSR-visible answers — AEO, never Radix Accordion here); `InvertedBand` closing CTA via the `dark` token scope — never hardcoded dark colors. Sections separate by whitespace (`py-16 sm:py-24`), not rules.
- **Seven locales, always.** Every user-facing string ships in `en, ar, fr, de, es, ru, zh` — client via `i18next`/`react-i18next`, server via the typed dictionary in `server/src/shared/i18n/`; parity tests fail the build on a missing key (see both `shared/i18n/README.md` files). `dir="rtl"` and logical utilities (`ps-`/`pe-`/`ms-`/`me-`/`text-start`) for `ar`.
- **Named exports only**; **no hardcoded URLs** (derive from `CLIENT_URL` / `SERVER_URL` / `VITE_*`); **tab state in `?tab=`** (superadmin tabs, billing tabs, settings tabs — all of them).
- **Two surfaces, one language.** Dashboard, auth, settings, billing, fleet, superadmin use shadcn defaults verbatim in monochrome tokens; marketing is the boldest expression of the *same* system — never a second visual language.
- **Interaction hygiene (current gaps to fix).** No `Spinner` primitive and no `Button` `loading` prop exist in `client/src/shared/ui/` — add both and replace per-feature ad-hoc flags with the shared affordance. Verify pointer/disabled cursor semantics on the `Button` cva base. React 18 caveat: native-element primitives and `asChild` targets need `forwardRef` — verify on every new primitive.
- **Unify the shell (2 variants of 1 system).** Consolidate the app chrome (`client/src/shared/components/Header.tsx`, `Footer.tsx`, `AppLayout.tsx`) and the header/footer inlined in `client/src/features/marketing/components/MarketingLayout.tsx` into one shared system: app variant = SPEC-01 sidebar shell; marketing variant = top-nav + sitemap footer, composed from the same building blocks. Every label through `t(...)` in all 7 locales; mobile menu = `Sheet` everywhere; consistent sticky height, z-index, `ThemeToggle` + locale switcher on both. The `GuideWidget` (onboarding tours) stays mounted in the app shell.

## Reference UI spec — app shell & dashboard anatomy (SCREENSHOT AUTHORITY)

Transcribed from the four reference screenshots (shadcnspace admin: Orders table, Invoice Details, Invoice List, Analytics dashboard). **This spec is binding for every authenticated surface — dashboard, projects list, project detail, snapshots, fleet, billing, settings, setup wizard, profile, admin, and EVERY superadmin tab (Overview, Users, Billing, System, Audit). No page is exempt: a superadmin table gets the same shell, toolbar, chips, and pagination anatomy as a user-facing one.** The SSR marketing surface keeps the dockstash-design-system §4 anatomy; this spec governs everything behind login.

**Brand adaptation rule (read first).** The template is monochrome (black primary) — and so is Dockstash. Everywhere the screenshots show a **solid black fill** (active nav item, "New Invoice"/"View Full Report" buttons, current-page pagination square, dark chart series), render **`bg-primary text-primary-foreground`** — which IS near-black in light mode and inverts to near-white in dark mode automatically. Never hardcode black or white; copy the *role* (the single dominant action / active state) via tokens so both themes work. Everything else (grays, tints, structure, spacing, radii) maps to existing semantic tokens plus the SPEC-A additions below. Raw hex stays banned in feature code (BAN-05); palette classes stay banned (BAN-12).

### Sanctioned design-system amendments (SPEC-A — execute in Phase 2, verified by G-19)

The screenshots introduce five patterns the current `.claude/rules/dockstash-design-system.md` doesn't cover (or nominally bans). These are **sanctioned amendments** — write them into the rule file; they are not BAN violations:

- **SPEC-A1 — Warning status token (the ONE new hue).** Add `--warning` + `--warning-foreground` (amber; light and dark values, oklch) in `client/src/styles/tailwind.css`, registered in `@theme` so `bg-warning`, `text-warning` compile. **No `--info` token** — the monochrome discipline stands; informational/in-progress states use muted neutral. Status color language becomes: success=`--success` (completed / verified / healthy / online / active subscription), warning=`--warning` (pending / queued / stale agent / trialing / draft), destructive=`--destructive` (failed / offline / past-due / DLQ / restore-drill failure), muted=neutral (running / in-progress / archived / disabled / none).
- **SPEC-A2 — Soft-tint fills.** Register the five `--chart-*` tokens and the three status tokens as Tailwind color utilities so **opacity-modified tints** (`bg-success/10`, `bg-warning/15`, `bg-chart-3/10`) work. Tint recipe everywhere: background = token at 10–15% opacity, icon/text = the full-strength token. This is how the stat chips, status chips, icon tiles, and tinted icon buttons are built — never with new hex values.
- **SPEC-A3 — `rounded-full` status chips.** Status chips/badges (SPEC-06) are pill-shaped. This amends the rule file's `rounded-full` whitelist (currently: micro-icons, avatars, status dots): status **chips**, count badges, and delta pills are `rounded-full` everywhere. Pills stay banned on **buttons**.
- **SPEC-A4 — Tinted icon-button row actions.** Per-row icon actions (edit/view/delete) may be small circular tinted icon buttons (SPEC-07). Destructive row action = `bg-destructive/10 text-destructive`.
- **SPEC-A5 — Flat low-opacity area fill.** Area/sparkline charts may use a **flat** fill of the series color at ≤10% opacity under the line. Gradient fills stay banned (BAN-04 unchanged) — the screenshot's gradient fade is rendered as a flat tint instead.

Everything else in the rule file stands: no card lift/scale, no `transition: all`, ≤200ms transitions, no glassmorphism, no gradient text, lucide-react only, semantic tokens only, monochrome everywhere else, light+dark parity, one `default` button per screen, serif accent never in app chrome.

### SPEC-01 — App shell frame

- **Two-column shell:** fixed sidebar (~280–300px, `bg-background`) + main column, built on the vendored `client/src/shared/ui/sidebar.tsx` primitive — this run **migrates `AppLayout.tsx`** from the current topbar layout to this anatomy. The main column is a **framed surface**: `rounded-2xl` (≤16px), `border border-border`, `bg-background`, separated from the sidebar/page edge by ~16px gutter, containing topbar, page content, and the in-frame footer. On `ar` the sidebar sits right (logical properties only — `ms-*`/`me-*`, `border-s`).
- **Every** authed page renders inside this frame — including superadmin. One shell component in `shared/`; zero per-feature copies (G-09 / shared-layout-system rule). The `GuideWidget` mounts once, in the shell.
- **In-frame footer:** muted copyright line start-aligned (`© {year} Dockstash` via `t(...)` with interpolated year), end-aligned muted text links (Guides, Security, Privacy, Terms). Same footer on every authed page.
- **Breakpoints:** below `lg` the sidebar collapses into the existing `Sheet` drawer; the frame goes full-bleed (no gutter) below `md`; tables collapse to cards per SPEC-07.

### SPEC-02 — Sidebar

- **Logo block** top: brand mark (rounded square, `bg-primary` with `text-primary-foreground` glyph) + "Dockstash" wordmark, links to the dashboard. No serif accent here — chrome is sans-only.
- **Grouped nav** with uppercase group labels — `text-xs font-medium text-muted-foreground tracking-wide` — every label through `t(...)` in all 7 locales. Groups for this product: **OVERVIEW** (Dashboard), **BACKUPS** (Projects, Snapshots), **FLEET** (Agents), **ACCOUNT** (Billing, Settings, Profile), **ADMIN** (Admin, Superadmin — role-gated).
- **Items:** 18px lucide icon + 14–15px label, row height ~40px, `rounded-lg`, hover = `bg-muted`. **Active item = solid `bg-primary text-primary-foreground` full-width rounded row.** Exactly one active item, derived from the route.
- **Expandable groups:** trailing chevron (rotates on open, ≤200ms, transform-only on the chevron); children indented with a `border-s` guide line; **active child = `bg-muted` rounded row** (not primary — primary is reserved for the top-level active).
- **Optional trailing badge** on an item: small `rounded-full` chip, `bg-primary/10 text-primary` — use for genuinely new features only, string localized. A `warning`-tinted count on Fleet when agents are stale/offline is sanctioned (it is state, not decoration).
- **Admin/Superadmin group:** rendered only for the matching role, same anatomy — no bespoke admin sidebar.
- **Bottom promo card:** `bg-muted rounded-xl` card with title, one muted line, and a `default` button — the **plan/upgrade card** (current tier + "Upgrade" → `/billing`). Hidden for the top paid tier and for superadmin sessions. No illustration dependency; if art is used it ships from our origin (SEC-07/SEC-09 logic applies).

### SPEC-03 — Topbar

- Left → right (logical order, flips under RTL): **sidebar-collapse icon button** (ghost, `PanelLeft`), thin vertical `Separator`, **page context / global search**. If no search backend exists, ship breadcrumb context instead of a dead search box — a non-functional input is worse than none; record the choice in ledger §5 as an owner decision.
- End cluster, 36px ghost icon buttons with `aria-label`s: **ThemeToggle** (existing component), **locale switcher** (existing component — never a flag-only control), **avatar menu** (32–36px `Avatar` with initials fallback → `DropdownMenu`: profile, settings, admin link when role permits, sign out).
- The screenshot's cart/mail/notification icons have no product equivalent today (alerting is server-side email) — **do not** ship dead icons.

### SPEC-04 — Page header + breadcrumb

- Every page opens with a **header card**: `rounded-xl border bg-card`, page title `text-xl font-semibold` start-aligned; **`Breadcrumb`** end-aligned (`Home / {Section} / {Page}` — muted ancestors, `/` separators, current item `text-foreground`; localized; collapses to title-only below `sm`). The `breadcrumb.tsx` primitive is already vendored.
- Page-level primary actions (e.g. "Add project", "Register agent", "Run backup") live in this header card or the table toolbar (SPEC-07) — never floating. **No floating FAB.**

### SPEC-05 — Stat cards (three sanctioned variants)

- **Variant A — soft-tint chip row:** grid of 4–6 compact chips, each `rounded-xl` with a **soft tint background** (SPEC-A2: status or chart token at 10–15% opacity), padding ~16–20px. Anatomy: top row = **value** (`text-xl font-bold text-foreground`) + end-aligned small **icon in a full-strength-token circle**; below = muted label. Tint follows the metric's semantic: succeeded backups=`success`, pending/queued=`warning`, failed=`destructive`, neutral counts=`muted`. Use for: dashboard backup rollups (succeeded / pending / failed last 24h), snapshot verify rollups, superadmin queue/DLQ counts.
- **Variant B — bordered stat card with progress bar:** `bg-card border rounded-xl`; value `text-2xl font-bold`; muted label under it; end-aligned **icon tile** (SPEC-08); footer = thin (~4px) `rounded-full` progress bar — filled segment in the semantic token, track `bg-muted`. Use for: **usage-vs-cap meters** in billing `UsageTab` (storage vs plan cap, projects vs cap, agents vs cap — the bar IS the cap meter), superadmin health cards.
- **Variant C — KPI + delta:** value `text-2xl/3xl font-bold` + **DeltaPill** (SPEC-09) beside it, muted context line ("than last month" — localized, interpolated), optional single-series sparkline in `--primary` with flat ≤10% fill (SPEC-A5), optional "See details →" `outline` button (arrow flips under RTL). Use for: dashboard KPIs (protected projects, total snapshots, storage growth), superadmin MRR.
- The superadmin `StatTile.tsx` is an existing ad-hoc take on this — **promote/replace it with the shared primitive** so superadmin and user surfaces share one implementation.
- All variants: static — no hover lift, no animated counters. Values formatted per locale (`Intl.NumberFormat`); bytes through the existing `formatBytes` helper.

### SPEC-06 — Status chips

One shared `StatusChip` primitive (in `shared/`), used by **every** table and detail view, app and superadmin alike:

- Shape: `rounded-full` (SPEC-A3), `px-2.5 py-0.5 text-xs font-medium`; fill `bg-{token}/10 text-{token}` (dark mode: same tokens, dark values — verify contrast both modes).
- Semantic map (SPEC-A1): success = completed / verified / healthy / online / active; warning = pending / queued / stale / trialing; destructive = failed / offline / past-due / DLQ; muted = running / in-progress / archived / disabled / none.
- Always token + **localized text**, never color alone (a11y). Static — no pulse — including agent-health indicators.
- Applies to: backup-run status, snapshot verify state, agent health (online/stale/offline), restore-drill result, subscription status (billing + superadmin), invite status, webhook delivery status (superadmin), audit-event severity.

### SPEC-07 — Data tables (the one table anatomy, everywhere)

Every listing — projects, snapshots, fleet agents, billing invoices/orders, settings destinations, **superadmin Users / Billing / Audit tabs** — follows this exact anatomy on shadcn `Table`:

- **Card wrapper:** table lives in a `rounded-xl border bg-card` section with a header row: section title (`text-lg font-semibold`) start-aligned; end-aligned **ghost icon-button cluster** (`Search`, `Filter`/`SlidersHorizontal` column toggle, `Download` export — only icons with real handlers; each `aria-label`ed).
- **Optional filter-tab row:** segmented status filters — each tab = label + small `rounded-full` count badge tinted per SPEC-06 semantics ("All 12 / Healthy 9 / Stale 2 / Offline 1"); **selected tab = `bg-muted rounded-lg`**; state persists as `?tab=` (url-tab-state rule). Beside it: scoped search input + `outline` filter buttons (date-range etc. as `Popover`); the page's single **`default` button** end-aligned ("Add project" / "Register agent" / superadmin "Replay webhook").
- **Header row:** muted background or muted semibold text; sortable columns show the double-arrow sort icon (`ArrowUpDown`, 14px, muted; active sort = `text-foreground` directional arrow); optional leading checkbox column (`Checkbox` primitive) when bulk actions exist.
- **Cells:**
  - *Entity cell:* 32px `Avatar` (image or initials fallback) + `font-medium` name — users (superadmin), agents (host initials), projects (project-name mark).
  - *Status:* `StatusChip` (SPEC-06).
  - *Date:* two-line — date `font-medium text-foreground`, time on the second line `text-sm text-muted-foreground`; locale-formatted (`Intl.DateTimeFormat`). Applies to last-backup / last-heartbeat / snapshot-created columns.
  - *Numeric/size:* end-aligned, tabular-nums; sizes via `formatBytes`; money from cents via locale currency format.
  - *Row actions:* either (a) trailing ghost `ChevronDown` (expandable detail) + `⋯` `DropdownMenu`, or (b) an **icon-button trio** — circular tinted buttons per SPEC-A4: primary action = `bg-primary/10 text-primary`, view = `outline`/muted, delete/forget = `bg-destructive/10 text-destructive`. Pick ONE style per table; destructive actions (delete project, forget snapshot, revoke agent) confirm via `AlertDialog`.
- **Rows:** 1px `border-border` separators, generous height (~64–72px), hover = `bg-muted/50` background change only.
- **Footer:** start = "Show [N ▾] per page" (`Select`, localized); end = "1–6 of 6" range text (localized, interpolated) + previous/next **arrow icon buttons** (disabled state at bounds, arrows flip under RTL) + **current page square** (`bg-primary text-primary-foreground rounded-md`). Replace/absorb the ad-hoc superadmin `Pagination.tsx` with the shared implementation.
- **Empty / loading / error:** designed states required — `Skeleton` rows while loading, `Empty` with one next-step action ("Register your first agent"), inline error `Alert` with retry. Below `md`, rows collapse to stacked cards keeping chip + actions anatomy.

### SPEC-08 — Icon tiles

Shared `IconTile` primitive: lucide icon (16–20px) centered in a `rounded-lg`/`rounded-xl` square (~40px), `bg-{token}/10 text-{token}` (or `bg-muted text-muted-foreground` neutral). Used in: stat cards (SPEC-05B/C), activity/feed rows (SPEC-11), feature lists. Never emoji, never raw hex.

### SPEC-09 — Delta pills

Shared `DeltaPill` primitive: `rounded-full px-2 py-0.5 text-xs font-medium`; positive = `bg-success/10 text-success` with `+` prefix; negative = `bg-destructive/10 text-destructive`; neutral = muted. **Invertible semantics prop** — for storage-cost or failure-count metrics a *decrease* is good; the pill colors by *goodness*, not by sign. Used beside KPIs (SPEC-05C) and in activity lists (SPEC-11). Values locale-formatted; sign rendering RTL-safe.

### SPEC-10 — Charts (Analytics anatomy → `dataviz` skill governs execution)

No charting library is installed today — any chart this run adds goes through `dataviz` first, and stays in the monochrome ramp.

- **Chart card anatomy:** title (`font-semibold`) + one muted subtitle line; end-aligned control (`Select` range — state in query params) or `IconTile`; chart body; optional side rail: `IconTile` + big total + legend rows (color dot + label + `font-semibold` value); optional full-width **`default` button** footer ("View details" → deep link). Button counts toward the one-primary-per-screen budget — if the page already has a primary, use `outline`.
- **Column/bar:** rounded-top bars; multi-series uses the monochrome `--chart-1..5` lightness ramp in declaration order; sparse horizontal gridlines only; muted axis labels; no drop shadows.
- **Sparkline/area:** single series = `--primary`, ~2px line, flat ≤10% fill (SPEC-A5). No gradient.
- **Donut:** `--chart-*` segments (lightness-differentiated), legend = color dots + localized labels; center or side total.
- **Every chart:** light+dark parity, accessible data-table fallback, `prefers-reduced-motion` honored (no entrance animation when set). Load `dataviz` before writing any of it.
- Product mapping: backup success-rate trend (line/columns), storage growth over time (area), snapshots per project (columns), superadmin MRR trend (SPEC-05C + sparkline), superadmin queue depth (columns).

### SPEC-11 — List/feed rows

Shared row anatomy for compact card lists: `IconTile` (or 32px round `Avatar`) + title `font-medium` with one muted subtitle line + end-aligned value (`font-semibold`) or `StatusChip`/`DeltaPill`. Rows separated by whitespace or 1px borders; whole-row link where navigable (hover = background change only). Card may end with a full-width details button per SPEC-10. Use for: recent backup runs (dashboard), latest snapshots, agent heartbeat feed, billing history snippets, **superadmin recent signups / recent webhook events / audit trail preview**. Avatar stacks: overlapping 28px avatars, `-ms-2` logical overlap, `+N` overflow bubble, `ring-2 ring-background` — use if/where seat display appears.

### SPEC-12 — Detail-document pages (Invoice Details → project detail, snapshot/restore, billing invoice, superadmin event detail)

- **Action bar** on top: a single row of ghost **text-buttons with leading icons**, separated by thin vertical `Separator`s — e.g. project detail: Run backup / View snapshots / Edit / Delete; snapshot: Restore / Verify / Forget; billing invoice: View / Download; superadmin webhook: Replay / View payload. All localized; each async action uses the shared in-button loading state (backup/restore triggers especially).
- **Document header:** name/`#id` (`text-xl font-bold`) start; **`StatusChip`** far end (last-run status / verify state / Paid / Failed…). The project-detail **last-failure alert** (existing feature) renders as an inline `Alert` (destructive variant) directly under this header — keep it, restyle it into the anatomy.
- **Two-column meta panels:** label (`font-semibold`) above a **`bg-muted rounded-xl` panel** of 3–4 plain text lines. Map to: project config vs. assigned agent (project detail), snapshot meta vs. repository/destination (snapshot detail), seller vs. customer (billing invoice), endpoint vs. event meta (superadmin webhook). Stacks below `md`; RTL mirrors.
- **Date pairs:** bold label + value below (Created / Last backup → Started / Finished), locale-formatted.
- **Items table:** simplified SPEC-07 (muted header, no checkboxes/actions) — e.g. artifacts within a snapshot (volumes, file-mode dumps, configs), line items on an invoice; numeric/size columns end-aligned.
- **Totals panel:** full-width `bg-muted rounded-xl` block, rows end-aligned — muted label : value; final row (total size / amount due) `font-bold` and larger. Sizes via `formatBytes`; money from cents, locale currency.
- **Log surface:** where restic output streams (`ResticLogPanel`), frame it in the JetBrains Mono code surface (`TerminalFrame`-style chrome adapted to the app), never a bare `<pre>`.
- **Notes footer:** `**{t('notes')}:**` + muted line.

### Per-surface application map (the G-18 checklist — every row needs ledger evidence)

| Surface | Applies |
| --- | --- |
| Dashboard | SPEC-01…05, 09, 10, 11 (KPI row, backup rollup chips, recent-runs feed, optional trend chart) |
| Projects list | SPEC-07 (entity cells, last-backup status chips, icon-trio or `⋯` actions, empty state → "Add project") |
| Project detail | SPEC-12 (action bar, last-failure `Alert`, config/agent meta panels, runs table) |
| Snapshots | SPEC-07 table (verify-state chips, size columns, filter tabs by project/status) + SPEC-12 snapshot detail + `RestoreDialog` with in-button loading |
| Fleet (agents) | SPEC-07 table (host entity cells, health chips, heartbeat date cells) + Register/Setup/Update dialogs + `TerminalFrame`-style install command + SPEC-05A health rollup |
| Billing | SPEC-05B usage/cap cards (UsageTab), SPEC-07 invoice/order table, SPEC-12 invoice detail, SPEC-06 subscription chips, PricingGrid in monochrome anatomy |
| Settings + Setup wizard | SPEC-01…04 shell + design-system form patterns; wizard steps with one primary per step |
| Profile | SPEC-01…04 shell + form patterns |
| Admin | SPEC-01…04 shell + whatever listing/detail anatomy its content matches (SPEC-07/12) |
| **Superadmin: Overview tab** | SPEC-05B+C cards (MRR, health), SPEC-10 trend, SPEC-11 recent signups — via the promoted shared StatCard (absorbs `StatTile.tsx`) |
| **Superadmin: Users tab** | SPEC-07 full anatomy (avatar cells, role/status chips, filter tabs, shared pagination — absorbs `Pagination.tsx`) |
| **Superadmin: Billing tab** | SPEC-07 events/subscriptions table (delivery-status chips) + SPEC-12 event detail w/ Replay action bar |
| **Superadmin: System + Audit tabs** | SPEC-05A queue/DLQ chips row + SPEC-07 audit table (severity chips, date cells) |
| Auth screens | shared shell chrome (logo, ThemeToggle, locale switcher), form patterns, in-button loading on submit |

## Standing rules & references (always apply — not one-time)

Every constraint above is backed by a rule file in `.claude/rules/` (the source of truth; this prompt summarizes). When in doubt, open the rule file. These apply on **every** change, forever — not just this design pass.

| Concern in this prompt | Authoritative rule | Enforces |
| --- | --- | --- |
| Visual system, tokens, banned patterns, marketing anatomy | [`.claude/rules/dockstash-design-system.md`](../.claude/rules/dockstash-design-system.md) (packaged as the `dockstash-design` skill) | monochrome shadcn tokens, serif-accent headlines, flat `shadow-xs` cards, `pattern-dot-grid`, `InvertedBand`, semantic tokens only, no brand hue — as amended by SPEC-A1…A5 |
| Interaction hygiene, accessibility, forms, loading/error states | [`.claude/rules/ui-ux-patterns.md`](../.claude/rules/ui-ux-patterns.md) | keyboard reach, visible focus, disable-on-submit + loading, inline errors, no card-lift/pulse (visual sections superseded by the design-system rule) |
| 7 locales + RTL | `client/src/shared/i18n/README.md` + `server/src/shared/i18n/README.md` | every string in `en, ar, fr, de, es, ru, zh`; parity tests; `dir="rtl"` + logical utilities for `ar` |
| Feature/module isolation (shared shell lives in `shared/`) | [`.claude/rules/mern-feature-modules.md`](../.claude/rules/mern-feature-modules.md) | cross-feature imports via `shared/` or a module's `index.ts` only |
| Named exports | [`.claude/rules/mern-no-default-exports.md`](../.claude/rules/mern-no-default-exports.md) | no `export default` on components/utils |
| Typed Mongoose schemas | [`.claude/rules/mern-mongoose-typed-schemas.md`](../.claude/rules/mern-mongoose-typed-schemas.md) | `InferSchemaType` + exported types on any touched model |
| No hardcoded URLs | [`.claude/rules/site-url-env-pattern.md`](../.claude/rules/site-url-env-pattern.md) | derive from `CLIENT_URL` / `SERVER_URL` / `VITE_*` |
| Tab state in URL | [`.claude/rules/url-tab-state.md`](../.claude/rules/url-tab-state.md) | active tab persists as `?tab=` |
| Env from root `.env` only | [`.claude/rules/environment-variables.md`](../.claude/rules/environment-variables.md) | one root `.env`; no subdir env files |
| Spec-first for non-trivial features | [`.claude/rules/spec-driven-development.md`](../.claude/rules/spec-driven-development.md) | spec → plan → tasks before build |
| No destructive git without per-turn confirmation | [`.claude/rules/git-destructive-commands.md`](../.claude/rules/git-destructive-commands.md) | no `reset --hard` / `checkout --` / `clean` / force-push / `--amend` without explicit fresh approval |
| Interaction hygiene (promoted — created by G-17) | `.claude/rules/interaction-hygiene.md` | cursor semantics, in-button loading, all interaction states |
| One shared layout system (promoted — created by G-17) | `.claude/rules/shared-layout-system.md` | one Header/Footer/shell system; variants, never forks |
| App-surface anatomy incl. superadmin (this run — amendments landed by G-19) | Reference UI spec (SPEC-01…12, SPEC-A1…A5) above + amended `dockstash-design-system.md` | shell frame, sidebar/topbar, stat-card variants, status chips, table anatomy, detail-document pages — on every authed surface, superadmin included |

### Two conventions promoted to standing rules — MANDATORY step (G-17)

These are binding from now on, and promoting them is a **gated step of this run** (executed during Phase 2, verified by G-17 — not "when convenient"):

1. **Create `.claude/rules/interaction-hygiene.md`.** Content: the Interaction-hygiene baseline from Phase 2 —
   - `cursor: pointer` on every clickable (disabled → `cursor: not-allowed` + reduced opacity), set on the base primitive (`Button`, `Link`) so it cascades — never per call site.
   - Every async action: disable immediately + show an **in-button loading indicator** until it resolves (success *and* error); no double-submit; one shared loading affordance (a `shared/ui` `Spinner` wired into `Button` via a `loading` prop), not per-feature flags. Long-running restic jobs additionally stream visible progress.
   - Every interactive element ships all states: default, hover, focus-visible, active/pressed, disabled, loading. Feedback within ~100ms of any click. Hover affordances have focus-visible equivalents.
   - New/changed UI that ships a button without pointer cursor, or an async action without in-button loading, is **incomplete** — a failing gate.
2. **Create `.claude/rules/shared-layout-system.md`.** Content: the shell-unification contract — exactly one Header, one Footer, and one shell *system* in `shared/`; marketing and app are **variants** composed from those building blocks — never inlined, divergent, or a second visual language. Every label internationalized; theme + locale controls, mobile-menu mechanism, sticky height, and z-index consistent across surfaces. Adding a new page NEVER means hand-rolling a new header/footer.
3. **Index both** in the repo `CLAUDE.md` rules list (§5) and in the table above.
4. **Verify** with the G-17 one-liner from the Exit criteria.

## Rules of engagement

- **Preserve, then elevate.** Reuse existing components and tokens; refactor rather than rewrite unless a component is fundamentally broken.
- **Consistency is mandatory.** All upgraded pages share one cohesive system. The landing page is its boldest expression, not a different language.
- **No regressions.** Existing functionality, routes, socket streams, and data flows stay intact — the fleet-agent machine surface (`/api/agent/*`) above all.
- **Ship incrementally.** Shared tokens/components first, then pages, so improvements cascade.
- **No destructive git — ever without fresh approval.** Never `git reset --hard`, `git checkout -- <path>`, `git clean`, `git stash`, `--amend`, or force-push; per `.claude/rules/git-destructive-commands.md` each requires explicit per-turn user confirmation. Commit only when the user asks.
- **New code in scope needs tests.** All three `vitest.config.ts` files enforce 100% v8 on owned code; only `client/src/shared/ui/**` is threshold-excluded (tests for new primitives are still required). Vitest 2.1.9 coverage quirk: prefer `include: ['src/**']` scoping over exclusions when adjusting config.
- **Explain key decisions briefly** — what you changed and why it serves simplicity, the award bar, conversion, discoverability, or security.

## Completion protocol

1. **Self-audit.** Enumerate every touched surface from `git diff --name-only "$BASE_COMMIT"` and re-open each against the Exit criteria.
2. **Adversarial pass.** `docker compose down && docker compose up -d --build && docker compose ps` (all healthy — never `-v`; volumes hold real backup state and are not yours to destroy). Then re-run the Phase 5 and Phase 6 gate blocks **verbatim, from scratch**, treating all prior evidence as stale. Record the runs in ledger §3.
3. **Final matrix.** Paste the completed traceability matrix — every G/BAN/SEC ID green with evidence — plus the change report (what changed, why, which axis it serves). Zero non-green IDs, zero empty Evidence cells, or the run is not finished.

Begin with Phase 0.
