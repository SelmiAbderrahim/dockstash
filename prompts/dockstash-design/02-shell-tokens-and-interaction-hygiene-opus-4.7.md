# Phase 02 — Shell, Tokens & Interaction Hygiene — Design-Upgrade Prompt

> **Land the foundation so everything downstream cascades.** Tokens and shell first,
> then per-surface application. This phase: adds the SPEC-A tokens (G-19), builds the
> missing shared primitives (`Spinner`, `Button` `loading`, `StatChip`, `StatCard`,
> `StatusChip`, `IconTile`, `DeltaPill`), migrates `AppLayout.tsx` to the SPEC-01
> sidebar shell, unifies the app + marketing chrome into one shared system (G-09),
> promotes the two standing rules (G-17), and fixes the interaction-hygiene gaps at the
> primitive level. Optimizes for **radical simplicity** (Key 1) and an **award-winning,
> responsive UI** (Key 2).

---

## Agent

`react-specialist` (primary — tokens, primitives, shell) + `Accessibility Auditor`
(focus order, keyboard, contrast on every new primitive). **Depends on Phase 01** (the
gap list) and **Phase 00** (ledger). Everything in Phases 3–5 composes what this phase
ships — get it right first.

## Preflight (blocking)

Run `GATE-MACHINERY.md` **§f verbatim** — STOP on any FAIL. Phase-specific extras:

- Phases 00 **and** 01 carry the `_done` rename; the audit artifact exists
  (`test -f .claude/plans/design-upgrade-audit.md`).
- Read the audit's **Primitive gap list** and **Friction list** — they are this
  phase's work order; do not re-derive them from scratch.

## Scope fence — NOT this phase

| Deferred work | Owner |
|---|---|
| Landing-page copy/sections (`Home.tsx` content) | Phase 3 |
| Playwright / `client/e2e/` | Phase 3 |
| Meta/JSON-LD/hreflang/sitemap/llms.txt | Phase 4 |
| Per-surface SPEC-04…12 application beyond what the shell forces | Phases 3/5 |
| CSP or any `server/src/shared/middleware/` change | Phase 6 |
| `docker-compose.yml`, `agent/` | never (SEC-13) |

The shell migration MAY touch feature files where they compose the old chrome (imports
of `Header`/`Footer`/`AppLayout`) — mechanical rewires only, no restyling of page
content here. Anything else → §5 note + owner phase.

## Coverage contract (100% v8 — non-negotiable)

- Tests ship **in the same step** as the code they cover — never batched at phase end.
  After every Mission step (A/B/C/D), run
  `(cd client && npx vitest run --coverage)` before starting the next step; the
  phase-end GATE-CORE is **confirmation, not discovery**.
- New/changed files under `client/src/shared/components/**` and `client/src/features/**`
  are **inside** the 100% threshold — every branch (role-gated nav, RTL flips, mobile
  collapse, loading/error states) needs a test the moment it exists. Only
  `client/src/shared/ui/**` is threshold-excluded — and its new primitives still ship
  tests (see step map below).
- Vitest 2.1.9 quirks (memory): keep `include: ['src/**']` scoping — never add
  `exclude` entries; on concurrent-session collisions isolate
  `--coverage.reportsDirectory=coverage-<session>`.
- A <100% run is diagnosed per `GATE-MACHINERY.md` §g (read the uncovered `file:line`
  list; write that test). Exclusions and threshold edits are FORBIDDEN.

## Skill gates (MANDATORY — load before touching the surface)

| Skill | Load it for | Satisfies |
|---|---|---|
| `dockstash-design` | the token/primitive/anatomy authority — every visual decision | G-01, G-02, G-19 |
| `shadcn` | composing/adding vendored primitives (`sidebar.tsx`, `Button`, `Sheet`) — never hand-fight internals | G-01 |
| `page-cro` | the Key-1 friction analysis that collapses the three core funnels | G-01 |
| `shadcn-design-system-compliance` | verifying new primitives obey the monochrome token discipline | G-01, G-02 |

`REFERENCE-UI-SPEC.md` (SPEC-01/02/03 + SPEC-A1…A5) is the **anatomy contract** for this
phase. `GUARDRAILS.md` §"Two conventions promoted" is the G-17 spec.

## Mission

### A. SPEC-A tokens (G-19 — do first, they unblock primitives)
1. Add `--warning` + `--warning-foreground` (amber; **light AND dark** oklch values) to
   `client/src/styles/tailwind.css`, registered in `@theme` so `bg-warning`/`text-warning`
   compile (SPEC-A1). **No `--info` token.**
2. Register the five `--chart-*` + three status tokens as Tailwind color utilities so
   opacity tints (`bg-success/10`, `bg-warning/15`, `bg-chart-3/10`) work (SPEC-A2).
3. Write SPEC-A1…A5 into `.claude/rules/dockstash-design-system.md` (warning token, soft
   tints, `rounded-full` status chips, tinted row actions, flat area fill) — they are
   sanctioned amendments, not BAN violations.

### B. Interaction-hygiene primitives (fixes the verified gaps)
4. Add `client/src/shared/ui/spinner.tsx` (`Loader2 animate-spin`, `aria-label`).
5. Add a `loading` prop to `client/src/shared/ui/button.tsx` — disables + shows the
   `Spinner`, restores on success **and** error. Verify the `cva` base string carries
   pointer/disabled cursor semantics (`cursor-pointer`, disabled → `cursor-not-allowed`
   + reduced opacity). **React 18: `forwardRef` on `asChild` targets** (memory).
6. Build the shared SPEC primitives in `shared/ui/`: `StatChip` (SPEC-05A tint chip),
   `StatCard` (SPEC-05B/C — absorbs superadmin `StatTile.tsx`), `StatusChip` (SPEC-06),
   `IconTile` (SPEC-08), `DeltaPill` (SPEC-09, invertible-semantics prop). Each with unit
   tests. Then replace per-feature ad-hoc submitting flags with the shared `Button
   loading` affordance across the app.

### C. Unify the shell (G-09 — structural, cascades)
7. Consolidate the app chrome (`client/src/shared/components/Header.tsx`, `Footer.tsx`,
   `AppLayout.tsx`) and the header/footer **inlined** in
   `client/src/features/marketing/components/MarketingLayout.tsx` into **one shared
   system** in `shared/`: an **app variant** (SPEC-01 sidebar shell, built on the
   vendored `client/src/shared/ui/sidebar.tsx`) and a **marketing variant** (top-nav +
   sitemap footer), composed from the same building blocks.
8. Migrate `AppLayout.tsx` to the SPEC-01/02/03 anatomy: framed `rounded-2xl` main
   column, SPEC-02 grouped sidebar (OVERVIEW/BACKUPS/FLEET/ACCOUNT/ADMIN, role-gated),
   SPEC-03 topbar (collapse button, `ThemeToggle`, locale switcher, avatar menu),
   in-frame footer. `GuideWidget` mounts once, in the shell. Mobile menu = `Sheet`
   everywhere (folds in marketing `MobileMenu.tsx`, replaces native `<details>` chrome
   menus). Every label through `t(...)` in all 7 locales.

### D. Promote the standing rules (G-17)
9. Create `.claude/rules/interaction-hygiene.md` and
   `.claude/rules/shared-layout-system.md` (content per `GUARDRAILS.md`); index both in
   `CLAUDE.md` §5 and the standing-rules table.

### Key 1 — radical simplicity (apply `page-cro`)
- Fewest steps/clicks per core flow; collapse multi-step sequences; one obvious primary
  action per view; smart defaults, inline validation, instant feedback (Socket.IO +
  `ResticLogPanel` already wired). Zero dead ends — every empty/loading/error state
  designed with a next step (empty dashboard → "register your first agent"; offline
  agent → troubleshooting).

### Key 2 — award-winning, responsive
- Flawless 320px→ultrawide; fluid type/spacing (`clamp()`), container queries where
  useful. Motion only: one-shot `Reveal` (240ms, reduced-motion-gated), loader spin,
  accordion expand, `transition-colors`/`opacity` ≤200ms. WCAG AA contrast + touch
  targets.

## Operating Constraints

| Rule | Detail |
|---|---|
| Tokens/primitives before pages | SPEC-A tokens → primitives → shell → per-surface. Improvements must cascade, not be patched per usage. |
| Monochrome, semantic tokens only | No hex (BAN-05), no palette classes (BAN-12), no brand hue. Tints via SPEC-A2 opacity recipe only. |
| No banned patterns | BAN-01…04: no `transition-all`, no `backdrop-blur`, no hover lift/scale/shadow escalation, no gradient. |
| RTL logical utilities | `ps-`/`pe-`/`ms-`/`me-`/`text-start` only outside vendored `ui/` (BAN-06). |
| Named exports | No `export default` (BAN-07). |
| i18n×7 | Every shell/primitive label via `t(...)` in all 7 locales; parity tests must stay green. |
| React 18 forwardRef | Native-element primitives + `asChild` targets need `forwardRef` (memory) or poppers render off-screen. |
| Preserve behavior | Every route/socket/data flow intact — the shell migration must not break navigation or `/api/agent/*`. |
| Primitive tests required | `shared/ui/**` is coverage-threshold-excluded but new primitives still ship unit tests. |

## Ordered step map — each step verifies before the next starts

| Step | Work | New/changed files | Test files (ship in the same step) | Step verification |
|---|---|---|---|---|
| A1 | `--warning`/`--warning-foreground` tokens, light+dark oklch, `@theme` registration | `client/src/styles/tailwind.css` | — (CSS) | `grep -c 'warning' client/src/styles/tailwind.css` ≥ 2 (one per mode) |
| A2 | chart+status tokens as Tailwind color utilities (opacity tints compile) | `tailwind.css` | — | temp probe: add `bg-warning/10` to any component, `npm --prefix client run build` compiles it, then keep the first real consumer |
| A3 | SPEC-A1…A5 written into the rule file | `.claude/rules/dockstash-design-system.md` | — | `grep -qi 'status chip' .claude/rules/dockstash-design-system.md && grep -q 'warning' .claude/rules/dockstash-design-system.md` |
| B1 | `Spinner` primitive | `client/src/shared/ui/spinner.tsx` | `client/src/shared/ui/spinner.test.tsx` (renders, `aria-label`, spin class) | `npx vitest run src/shared/ui/spinner` green |
| B2 | `Button` `loading` prop + cursor semantics + `forwardRef` | `client/src/shared/ui/button.tsx` | `client/src/shared/ui/button.test.tsx` (loading disables, spinner visible, double-click fires once, restores on resolve AND reject, `cursor-pointer`/`not-allowed`, ref forwards) | `npx vitest run src/shared/ui/button` green |
| B3 | `StatChip`, `StatCard`, `StatusChip`, `IconTile`, `DeltaPill` | `client/src/shared/ui/{stat-chip,stat-card,status-chip,icon-tile,delta-pill}.tsx` | matching `*.test.tsx` per file (token→class mapping per status, `DeltaPill` invert prop, localized text rendering, no color-only state) | `npx vitest run src/shared/ui` green |
| B4 | Replace per-feature ad-hoc submitting flags with `Button loading` | every feature form/dialog with an async submit (find: `grep -rn 'isSubmitting\|submitting\|isLoading' client/src/features --include='*.tsx'`) | update the co-located feature tests in the same edit | `(cd client && npx vitest run --coverage)` green |
| C1 | Shared shell building blocks + app variant (SPEC-01/02/03 sidebar shell on vendored `sidebar.tsx`) | `client/src/shared/components/AppLayout.tsx` (+ new shell components in `shared/components/`) | co-located `*.test.tsx` — nav-parity (below), role gating, footer links, `GuideWidget` single mount | nav-parity checklist + coverage run |
| C2 | Marketing variant — de-inline `MarketingLayout.tsx` header/footer; `MobileMenu` → `Sheet` | `client/src/features/marketing/components/MarketingLayout.tsx`, `MobileMenu.tsx` | update co-located tests | `grep -n '<header\|<footer' client/src/features/marketing/components/MarketingLayout.tsx` → composed components only |
| C3 | i18n keys for every new label, **all 7 locales** | `client/src/shared/i18n/locales/{en,ar,fr,de,es,ru,zh}/common.json` (nav/shell keys live in `common`) | parity suite is the test | `(cd client && npx vitest run --coverage)` — parity suite green |
| D | Promoted rule files + CLAUDE.md index | `.claude/rules/interaction-hygiene.md`, `.claude/rules/shared-layout-system.md`, `CLAUDE.md` | — | the G-17 one-liner |

**Rule-file content is pre-written** — copy the two fenced blocks in `GUARDRAILS.md`
§"Two conventions promoted" **verbatim** into the rule files; do not re-author.

### Nav-parity checklist (C1 — the shell migration must lose nothing)

Every destination reachable from the **current** chrome must be reachable from the new
sidebar/topbar. Current inventory (from `client/src/shared/components/Header.tsx`):
authed — `/dashboard`, `/projects`, `/snapshots`, `/fleet`, `/settings`, logout;
role-gated — `/superadmin`; anon — `/`, `/login`, `/register`. Plus the SPEC-02 groups
add `/billing`, `/profile`, `/admin` (role-gated). Assert in the shell test: render with
an authed store → every route above has a link; render anon → marketing chrome shows
login/register; render non-admin → no admin/superadmin items. Also assert: `GuideWidget`
mounted exactly once; `Sheet` drawer opens on menu button, traps focus, `Escape` closes
and returns focus (keyboard check — Testing Library).

## Execute → Validate → Test

**Execute** — the step map above, in order: A (tokens + rule amendments) → B
(primitives + hygiene) → C (shell) → D (promoted rules). Verify each new primitive
live in the browser (both themes, 320/768/1440) before wiring it into pages. Run the
step-verification column after every step; a red step verification blocks the next
step.

**Validate**
```bash
# GATE-CORE (GATE-MACHINERY.md §b) — all three packages exit 0, incl. i18n parity:
npm --prefix client run typecheck; npm --prefix server run typecheck; npm --prefix agent run typecheck
npm --prefix client run lint;      npm --prefix server run lint;      npm --prefix agent run lint
(cd client && npx vitest run --coverage); (cd server && npx vitest run --coverage); (cd agent && npx vitest run --coverage)

# BAN block (GATE-MACHINERY.md §d) — clean or excepted (no new hits):
#   ...paste the full g(){...} block...

# G-19 — SPEC-A landed:
grep -q 'warning' client/src/styles/tailwind.css && grep -qi 'status chip' .claude/rules/dockstash-design-system.md && echo 'PASS G-19' || echo 'FAIL G-19'

# G-09 — no inlined marketing shell markup:
grep -n '<header\|<footer' client/src/features/marketing/components/MarketingLayout.tsx   # only composed shared components, no inlined markup

# G-17 — promoted rules exist and indexed:
test -f .claude/rules/interaction-hygiene.md && test -f .claude/rules/shared-layout-system.md && grep -q interaction-hygiene CLAUDE.md && grep -q shared-layout-system CLAUDE.md && echo 'PASS G-17' || echo 'FAIL G-17'
```
- GATE-E2E does not exist yet (Phase 3 creates it, G-20). Substitute **manual browser
  verification + §e screenshots** (app + marketing header/footer variants, light+dark,
  `ar` RTL, at 320/768/1440) and note "suite pending (G-20)" in the ledger.

**Test**
- New primitives (`spinner.tsx`, `Button loading`, `StatChip`, `StatCard`, `StatusChip`,
  `IconTile`, `DeltaPill`) each carry unit tests (states, `loading` disables +
  double-submit guard, `DeltaPill` invert prop, chip token→text mapping). Command:
  `cd client && npx vitest run src/shared/ui`.
- **STOP-and-fix:** any GATE-CORE command ≠ exit 0, any new BAN hit, or a failed G-09/
  G-17/G-19 check halts the phase. Fix, then re-run the **entire** validate block (not
  just the failing command) before advancing (Execution Contract rules 7–8).

## Gate out (Phase 2 → 3) — every box has a check command; all must PASS

- [ ] GATE-CORE green (all 9 commands exit 0, incl. both i18n parity suites) — §3
      entries with final status lines.
- [ ] BAN block clean or excepted (§2) — full §d run pasted into §3, zero
      un-excepted FAIL lines.
- [ ] **G-19** —
      `grep -q 'warning' client/src/styles/tailwind.css && grep -qi 'status chip' .claude/rules/dockstash-design-system.md && echo 'PASS G-19' || echo 'FAIL G-19'`;
      plus dark-mode value present (`grep -A40 '\.dark' client/src/styles/tailwind.css | grep -q 'warning' && echo 'PASS dark'`).
- [ ] **G-09** —
      `grep -n '<header\|<footer' client/src/features/marketing/components/MarketingLayout.tsx`
      shows only composed shared components (no inlined chrome markup); VISUAL —
      evidence: §4 rows for app + marketing shells, both themes, `ar` RTL, 320/768/1440.
- [ ] SPEC-01/02/03 sidebar shell live —
      `grep -q 'sidebar' client/src/shared/components/AppLayout.tsx && echo PASS`
      (composes the vendored primitive); nav-parity test green.
- [ ] **G-17** —
      `test -f .claude/rules/interaction-hygiene.md && test -f .claude/rules/shared-layout-system.md && grep -q interaction-hygiene CLAUDE.md && grep -q shared-layout-system CLAUDE.md && echo 'PASS G-17' || echo 'FAIL G-17'`.
- [ ] New primitives + tests exist —
      `for f in spinner stat-chip stat-card status-chip icon-tile delta-pill; do test -f client/src/shared/ui/$f.tsx && test -f client/src/shared/ui/$f.test.tsx || echo "FAIL $f"; done; echo done`;
      `(cd client && npx vitest run src/shared/ui)` green.
- [ ] Ad-hoc widgets absorbed —
      `grep -rn "from './StatTile'\|from './Pagination'" client/src/features/superadmin --include='*.tsx'`
      is **empty** (superadmin imports the shared `StatCard`/table pagination instead)
      — or §5 records why absorption is deferred to Phase 5.
- [ ] Scope fence held — `git diff --name-only "$BASE_COMMIT"` contains no
      `client/e2e/`, no `server/src/shared/middleware/`, no `docker-compose.yml`,
      no `agent/`.

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
