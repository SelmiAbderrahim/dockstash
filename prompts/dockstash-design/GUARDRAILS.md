# Dockstash Guardrails & Standing Rules — shared appendix

> **Reference appendix, not a runnable prompt.** Pinned repo-specific constraints
> every phase obeys, the standing-rules table, and the two rule files Phase `02`
> must create (G-17). The stack-agnostic backbone in `prompts/MASTER-DESIGN.md` is
> reusable; **for THIS repo these are hard constraints.**
>
> The visual authority is `.claude/rules/dockstash-design-system.md` (packaged as the
> `dockstash-design` skill) — defer to it on every visual question — as amended by
> the sanctioned SPEC-A1…A5 items in `REFERENCE-UI-SPEC.md`. For authenticated-surface
> anatomy (shell, sidebar, tables, stat cards, detail pages — **including
> admin/superadmin**), `REFERENCE-UI-SPEC.md` is the binding layout contract.

## Pinned constraints (apply every phase)

- **One design system: monochrome shadcn/ui.** Achromatic tokens — near-black
  `--primary` in light, near-white in dark (token inversion, oklch, in
  `client/src/styles/tailwind.css`). Flat cards, 1px border, `rounded-xl`, `shadow-xs`
  max on static surfaces, no hover lift/scale/shadow escalation. Monochrome chart ramp
  (`--chart-1..5` lightness steps); single-series charts stay `--primary`. **Semantic
  tokens only** (`bg-primary`, `text-muted-foreground`, `bg-muted/50`) — never raw hex
  or palette classes in feature code. **Never reintroduce a brand hue**: color is
  reserved for semantic state (`--destructive`, `--success`, and the SPEC-A1
  `--warning`). Emphasis = contrast + weight, never hue. *(Enforced: BAN-05, BAN-12.)*
- **Typography:** Inter for everything, JetBrains Mono for code/terminal, Instrument
  Serif *italic* as the single display accent — max one accent phrase per headline,
  never in body text, buttons, labels, badges, or dashboard chrome (use the `Serif`
  component). All three fonts self-hosted via `@fontsource` (SEC-07).
- **Banned everywhere:** gradient text/fills (only permitted "pattern" is the
  token-driven `pattern-dot-grid`), glassmorphism/backdrop blur, card-lift/scale on
  hover, `transition: all`, bounce/pulse (Skeleton excepted), parallax, marquee, emoji
  as icons (lucide-react only), pill **buttons** everywhere (no marketing exception —
  `rounded-full` only for status chips/badges per SPEC-A3, avatars, status dots, and the
  circled-check micro-icon). *(Enforced: BAN-01…BAN-04, Phase-5 emoji sweep.)*
- **Marketing (SSR) anatomy** (dockstash-design-system §4): centered hero with eyebrow →
  H1 with serif accent → one-paragraph sub → CTA pair (solid primary with
  `ArrowRightIcon` + `outline`) → `CheckItem` trust row → badge chips, on a
  `pattern-dot-grid` backdrop; `FeatureCard` grids; oversized serif-italic step numerals;
  `<details>`-based `FaqSection` (SSR-visible answers — AEO, never Radix Accordion here);
  `InvertedBand` closing CTA via the `dark` token scope — never hardcoded dark colors.
  Sections separate by whitespace (`py-16 sm:py-24`), not rules.
- **Seven locales, always.** Every user-facing string ships in `en, ar, fr, de, es, ru,
  zh` — client via `i18next`/`react-i18next`, server via the typed dictionary in
  `server/src/shared/i18n/`; parity tests fail the build on a missing key (both
  `shared/i18n/README.md`). `dir="rtl"` + logical utilities (`ps-`/`pe-`/`ms-`/`me-`/
  `text-start`) for `ar`. *(Enforced: G-06, BAN-06.)*
- **Named exports only** *(BAN-07)*; **no hardcoded URLs** — derive from
  `CLIENT_URL`/`SERVER_URL`/`VITE_*` *(BAN-08)*; **tab state in `?tab=`** (superadmin,
  billing, settings tabs — all of them).
- **Two surfaces, one language.** Dashboard, auth, settings, billing, fleet, superadmin
  use shadcn defaults verbatim in monochrome tokens; marketing is the boldest expression
  of the *same* system — never a second visual language.
- **Interaction hygiene (current gaps to fix).** No `Spinner` primitive and no `Button`
  `loading` prop exist in `client/src/shared/ui/` — add both and replace per-feature
  ad-hoc flags with the shared affordance. Verify pointer/disabled cursor semantics on
  the `Button` cva base. **React 18 caveat: native-element primitives and `asChild`
  targets need `forwardRef`** — verify on every new primitive (memory: shadcn-react18-
  forwardref — poppers render off-screen otherwise).
- **Unify the shell (2 variants of 1 system).** Consolidate the app chrome
  (`client/src/shared/components/Header.tsx`, `Footer.tsx`, `AppLayout.tsx`) and the
  header/footer inlined in `client/src/features/marketing/components/MarketingLayout.tsx`
  into one shared system: app variant = SPEC-01 sidebar shell; marketing variant =
  top-nav + sitemap footer, composed from the same building blocks. Every label through
  `t(...)` in all 7 locales; mobile menu = `Sheet` everywhere; consistent sticky height,
  z-index, `ThemeToggle` + locale switcher on both. The `GuideWidget` stays mounted in
  the app shell. *(Enforced: G-09, G-17.)*

## Standing rules & references (always apply — not one-time)

Every constraint above is backed by a rule file in `.claude/rules/` (the source of
truth). When in doubt, open the rule file. These apply on **every** change, forever.

| Concern | Authoritative rule | Enforces |
| --- | --- | --- |
| Visual system, tokens, banned patterns, marketing anatomy | `.claude/rules/dockstash-design-system.md` (`dockstash-design` skill) | monochrome shadcn tokens, serif-accent headlines, flat `shadow-xs` cards, `pattern-dot-grid`, `InvertedBand`, semantic tokens only, no brand hue — as amended by SPEC-A1…A5 |
| Interaction hygiene, a11y, forms, loading/error | `.claude/rules/ui-ux-patterns.md` | keyboard reach, visible focus, disable-on-submit + loading, inline errors, no card-lift/pulse (visuals superseded by design-system rule) |
| 7 locales + RTL | `client/src/shared/i18n/README.md` + `server/src/shared/i18n/README.md` | every string in 7 locales; parity tests; `dir="rtl"` + logical utilities |
| Feature/module isolation (shared shell in `shared/`) | `.claude/rules/mern-feature-modules.md` | cross-feature imports via `shared/` or a module's `index.ts` only |
| Named exports | `.claude/rules/mern-no-default-exports.md` | no `export default` on components/utils |
| Typed Mongoose schemas | `.claude/rules/mern-mongoose-typed-schemas.md` | `InferSchemaType` + exported types on any touched model |
| No hardcoded URLs | `.claude/rules/site-url-env-pattern.md` | derive from `CLIENT_URL`/`SERVER_URL`/`VITE_*` |
| Tab state in URL | `.claude/rules/url-tab-state.md` | active tab persists as `?tab=` |
| Env from root `.env` only | `.claude/rules/environment-variables.md` | one root `.env`; no subdir env files |
| Spec-first for non-trivial features | `.claude/rules/spec-driven-development.md` | spec → plan → tasks before build |
| No destructive git without per-turn confirmation | `.claude/rules/git-destructive-commands.md` | no `reset --hard` / `checkout --` / `clean` / force-push / `--amend` / `stash` without explicit fresh approval |
| Interaction hygiene (promoted — created by G-17) | `.claude/rules/interaction-hygiene.md` | cursor semantics, in-button loading, all interaction states |
| One shared layout system (promoted — created by G-17) | `.claude/rules/shared-layout-system.md` | one Header/Footer/shell system; variants, never forks |
| App-surface anatomy incl. superadmin (this run — amendments landed by G-19) | `REFERENCE-UI-SPEC.md` (SPEC-01…12, SPEC-A1…A5) + amended `dockstash-design-system.md` | shell frame, sidebar/topbar, stat-card variants, status chips, table anatomy, detail-document pages — every authed surface, superadmin included |

## Two conventions promoted to standing rules — MANDATORY step (G-17, executed in Phase 2)

Binding from now on; promoting them is a **gated step** (not "when convenient").
**The rule-file content is pre-written below — copy each fenced block verbatim into
its file. Do not re-author, summarize, or restyle it** (drift in the rule text is
drift in the gate).

1. **Create `.claude/rules/interaction-hygiene.md`** with exactly this content:

   ````markdown
   # Interaction Hygiene - Strict Rule

   ## MANDATORY REQUIREMENT - ZERO TOLERANCE

   **Every interactive element ships complete interaction affordances. New or changed
   UI that lacks them is incomplete — a failing gate, not a follow-up.**

   ## Rules

   1. **Pointer affordance.** Every clickable element shows `cursor: pointer` on hover
      — buttons, links, tabs, menu items, switches, clickable cards. Disabled controls
      show `cursor: not-allowed` with reduced opacity. Set on the base primitive
      (`Button`, `Link`) so it cascades — NEVER patched per call site.
   2. **Every async action shows progress in place.** The moment an async-triggering
      control is clicked it: (1) disables immediately (no double-submit), (2) shows an
      in-button loading indicator — the shared `Spinner` via the `Button` `loading`
      prop, not swapped label text elsewhere — and (3) restores on success AND on
      error. ONE shared loading affordance app-wide; per-feature ad-hoc submitting
      flags are forbidden. Long-running restic jobs additionally stream visible
      progress (`ResticLogPanel`).
   3. **All states designed.** Every interactive element ships: default, hover,
      focus-visible, active/pressed, disabled, and (where async) loading. No element
      ships with only a default state.
   4. **No dead air.** Visible feedback within ~100ms of any click — optimistic update
      or spinner. Never a frozen UI with no signal the click registered.
   5. **Keyboard parity.** Every hover affordance has a focus-visible equivalent;
      nothing is discoverable by mouse only.

   ## CORRECT

   ```tsx
   <Button loading={isPending} onClick={onSubmit}>{t('save')}</Button>
   ```

   ## FORBIDDEN

   ```tsx
   // WRONG — ad-hoc flag, label swap, no disable:
   <Button onClick={onSubmit}>{isPending ? t('saving') : t('save')}</Button>
   // WRONG — per-call-site cursor patch:
   <div className="cursor-pointer" onClick={...}>
   ```

   ## Validation Checklist

   - [ ] Clickables show `cursor: pointer`; disabled show `cursor: not-allowed`
   - [ ] Async actions disable + show in-button `Spinner` via `loading`, restore on
         success and error
   - [ ] All six states present on every interactive element
   - [ ] Feedback within ~100ms; keyboard parity for every hover affordance
   ````

2. **Create `.claude/rules/shared-layout-system.md`** with exactly this content:

   ````markdown
   # Shared Layout System - Strict Rule

   ## MANDATORY REQUIREMENT - ZERO TOLERANCE

   **Exactly one Header, one Footer, one shell system — building blocks live in
   `client/src/shared/components/`; every surface composes a variant of them. Adding a
   page NEVER means hand-rolling a new header or footer.**

   ## Rules

   1. **Two variants, one system.** App variant = the SPEC-01 sidebar shell (framed
      main column, grouped sidebar, topbar, in-frame footer). Marketing variant =
      top-nav + sitemap footer. Both composed from the same shared building blocks —
      never inlined `<header>`/`<footer>` markup inside feature layouts, never a
      second visual language.
   2. **Consistent chrome everywhere.** Same sticky height and z-index; mobile menu =
      `Sheet` on every surface; `ThemeToggle` + locale switcher present on both
      variants; `GuideWidget` mounts once, in the app shell.
   3. **Every label internationalized** via `t(...)` in all 7 locales — no
      hardcoded-English chrome strings.
   4. **A user never visibly crosses layout styles mid-funnel** (marketing → register
      → setup wizard → dashboard).

   ## FORBIDDEN

   ```tsx
   // WRONG — feature layout inlining its own chrome:
   export const SomeFeatureLayout = () => (
     <div>
       <header>...</header>   {/* belongs to the shared shell */}
       ...
     </div>
   );
   ```

   ## Validation Checklist

   - [ ] No `<header`/`<footer` markup inside `client/src/features/**` layouts
   - [ ] New pages render inside an existing shell variant
   - [ ] Chrome labels resolve through `t(...)` in all 7 locales
   - [ ] `Sheet` mobile menu, `ThemeToggle`, locale switcher on every surface
   ````

3. **Index both** in the repo `CLAUDE.md` rules list (§5) and in the standing-rules
   table above.
4. **Verify** with the G-17 one-liner:
   `test -f .claude/rules/interaction-hygiene.md && test -f
   .claude/rules/shared-layout-system.md && grep -q interaction-hygiene CLAUDE.md &&
   grep -q shared-layout-system CLAUDE.md`.

## Rules of engagement

- **Preserve, then elevate.** Reuse existing components and tokens; refactor rather than
  rewrite unless a component is fundamentally broken.
- **Consistency is mandatory.** All upgraded pages share one cohesive system. The
  landing page is its boldest expression, not a different language.
- **No regressions.** Existing functionality, routes, socket streams, and data flows
  stay intact — the fleet-agent machine surface (`/api/agent/*`) above all.
- **Ship incrementally.** Shared tokens/components first, then pages, so improvements
  cascade.
- **No destructive git — ever without fresh approval.** Never `git reset --hard`,
  `git checkout -- <path>`, `git clean`, `git stash`, `--amend`, or force-push; per
  `.claude/rules/git-destructive-commands.md` each requires explicit per-turn user
  confirmation. Commit only when the user asks.
- **New code in scope needs tests.** All three `vitest.config.ts` files enforce 100% v8
  on owned code; only `client/src/shared/ui/**` is threshold-excluded (tests for new
  primitives are still required). Vitest 2.1.9 quirk: prefer `include: ['src/**']` over
  exclusions.
- **Explain key decisions briefly** — what you changed and why it serves simplicity, the
  award bar, conversion, discoverability, or security.
