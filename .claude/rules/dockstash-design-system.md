# Dockstash Design System - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

Every page and component — marketing, auth, dashboard, admin, everything — follows the
**monochrome shadcn/ui design language** defined here. Source of truth for tokens:
`client/src/styles/tailwind.css`. Source of truth for primitives: `client/src/shared/ui/`
(import via `@shared/ui/*`). Marketing layout primitives: `client/src/features/marketing/components/shared.tsx`.

This rule supersedes the visual sections of `ui-ux-patterns.md`.

## 1. Color — Monochrome Only

The palette is **achromatic**. Primary is near-black in light mode, near-white in dark mode.

| Do | Don't |
|----|-------|
| `bg-primary`, `text-muted-foreground`, `bg-muted/50`, `border` | Any Tailwind palette color (`bg-blue-600`, `text-zinc-500`, …) |
| Semantic state tokens: `text-destructive`, `text-success`, `text-warning` | Hardcoded hex/oklch in components |
| Monochrome chart ramp (`--chart-1..5`, lightness steps) | Multi-hue chart palettes |

- **Never reintroduce a brand hue** into tokens or components. Color is reserved for
  semantic state (destructive/success/warning) only.
- Emphasis is achieved with **contrast and weight** (`text-foreground` + `font-medium`
  vs `text-muted-foreground`), never with hue.
- Links inside body copy: `font-medium underline-offset-4 hover:underline` — dark text,
  not blue.

## 2. Typography

- Sans: `Inter Variable` (`--font-sans`) for everything.
- Mono: `JetBrains Mono` (`--font-mono`) for code.
- Serif: `Instrument Serif` italic (`--font-serif`) — **display accent only**.

### The serif italic accent

The single decorative flourish this design allows: one italic serif phrase inside a
display headline. Use the `Serif` component from marketing `shared.tsx`:

```tsx
<h1 className={h1Class}>
  Back Up Your <Serif>Entire</Serif><br />Docker Project
</h1>
```

Rules: max **one accent phrase per headline**; never in body text, buttons, labels,
badges, or the dashboard UI chrome; never bold; never colored.

### Scale

- Headlines: `font-semibold tracking-tighter text-balance` (h1: `text-4xl sm:text-5xl lg:text-6xl`;
  h2: `text-3xl sm:text-4xl`). Use `h1Class` / `h2Class` from marketing `shared.tsx`.
- Section sub-copy: `text-muted-foreground`, max-width capped (`max-w-[560px]` ballpark).
- Eyebrow labels: `text-sm font-medium uppercase tracking-widest text-muted-foreground`.

## 3. Surfaces & Depth

- Cards: flat — `rounded-xl border bg-card shadow-xs`. Nothing heavier than `shadow-xs`
  on static surfaces. Overlays (dropdowns, dialogs, popovers) keep their shadcn default
  shadow.
- No hover lift, no scale, no shadow escalation, no glassmorphism/backdrop blur.
- Hover feedback: background tint (`hover:bg-muted/50`) or text color only.
- Radius comes from the token scale (`--radius: 0.625rem`): `rounded-md` buttons/inputs,
  `rounded-lg`/`rounded-xl` cards. Never `rounded-2xl`+ containers; `rounded-full` only
  for the circled-check micro-icon, avatars, and status dots.
- **No color gradients.** The only permitted "pattern" is the token-driven `pattern-dot-grid`
  utility (hero/CTA backdrop, defined in `tailwind.css`).

## 4. Section Anatomy (marketing surface)

Sections separate by **whitespace, not rules**: `py-16 sm:py-24` (`sectionClass`).

- **Hero**: centered column; eyebrow → H1 with serif accent → one-paragraph sub →
  CTA pair (solid primary with `ArrowRightIcon`, plus `outline`) → `CheckItem` trust row →
  outline `Badge` chip row. `pattern-dot-grid` backdrop.
- **Feature grid**: `FeatureCard` (bordered icon tile `size-9 rounded-md border` +
  lucide icon `size-4`, title, muted body) in a 2-col grid, optionally beside a
  sticky heading column.
- **Steps**: oversized serif italic numerals (`01`, `02`, `03`) in `text-muted-foreground/40`,
  hairline `h-px w-10 bg-border` divider, title + muted body.
- **FAQ**: `FaqSection` — native `<details>` accordion inside one bordered card.
  Never replace with Radix Accordion on the marketing surface: answers must exist in
  server-rendered HTML for crawlers (AEO).
- **Closing CTA**: `InvertedBand` — full-bleed dark band via the `dark` token scope
  (`dark bg-background`), centered headline with serif accent, CTA pair. Never hardcode
  dark colors for this; token inversion only.

## 5. Component Sourcing

- Always use `@shared/ui/*` primitives (Button, Card, Badge, Accordion, Alert, Empty,
  Skeleton, Separator, Sonner, …) before writing custom markup.
- Icons: **lucide-react only** (`*Icon` named exports). Never emoji as icons.
- New shadcn components are added via the shadcn CLI into `client/src/shared/ui/`
  (vendored, coverage-excluded). Do not hand-edit their visual defaults to fight
  this rule — the neutral tokens already style them correctly.
- React 18 caveat: native-element primitives and `asChild` targets need `forwardRef`
  (see memory/CLAUDE.md note) — verify when adding new primitives.

## 6. Motion

- Allowed: the marketing one-shot scroll reveal (`Reveal`, 240ms, reduced-motion-gated),
  loader spin, accordion expand, `transition-colors`/`opacity` ≤ 200ms.
- Banned: bounce, pulse (outside Skeleton), hover transforms, `transition: all`,
  parallax, marquee.

## 7. Still In Force

Accessibility, forms & feedback, loading/error states, and contrast-parity sections of
`.claude/rules/ui-ux-patterns.md` fully apply (keyboard reachability, visible focus,
inline errors, 4.5:1 contrast, light/dark parity). RTL-safe logical utilities only
(`ps-`/`pe-`/`text-start` — never `pl-`/`pr-`/`text-left`) outside vendored `shared/ui/`.

## 7a. SPEC-A amendments (sanctioned — not BAN violations)

These five patterns were transcribed from the reference UI (`REFERENCE-UI-SPEC.md`
SPEC-A1…A5) into this rule. They amend, they do not weaken — every other constraint
(no gradient text/fills, no hover lift/scale, no `transition: all`, `shadow-xs` max,
serif accent never in chrome, semantic tokens only, no palette classes, no raw hex)
still applies verbatim.

- **SPEC-A1 — Warning status token (the ONE new hue).** `--warning` +
  `--warning-foreground` (amber, oklch, light AND dark values) live in
  `client/src/styles/tailwind.css` and are registered in `@theme` so `bg-warning`,
  `text-warning`, `bg-warning/10` compile. **No `--info` token** — informational /
  in-progress state stays `muted`. Status color language:
  - success (`--success`) = completed / verified / healthy / online / active subscription
  - warning (`--warning`) = pending / queued / stale agent / trialing / draft
  - destructive (`--destructive`) = failed / offline / past-due / DLQ / restore-drill failure
  - muted = running / in-progress / archived / disabled / none
- **SPEC-A2 — Soft-tint fills.** The five `--chart-*` tokens and the three status
  tokens (`--success`, `--warning`, `--destructive`) are registered as Tailwind color
  utilities in `@theme`, so **opacity-modified tints** (`bg-success/10`, `bg-warning/15`,
  `bg-chart-3/10`) compile. Tint recipe everywhere: **background = token at 10–15%
  opacity, icon/text = the full-strength token**. This builds stat chips, status chips,
  icon tiles, and tinted icon buttons — **never** with new hex values.
- **SPEC-A3 — `rounded-full` status chips.** Amends §3's `rounded-full` whitelist. In
  addition to micro-icons / avatars / status dots, **status chips**, count badges, and
  delta pills are `rounded-full` everywhere. **Pills stay banned on buttons** — the ban
  is on button pills specifically, not on chip pills.
- **SPEC-A4 — Tinted icon-button row actions.** Per-row icon actions (edit / view /
  delete) may be small circular tinted icon buttons: primary = `bg-primary/10
  text-primary`, view = `outline`/muted, destructive row action = `bg-destructive/10
  text-destructive`. Never raw hex, always the tint recipe.
- **SPEC-A5 — Flat low-opacity area fill.** Area / sparkline charts may use a **flat**
  fill of the series color at ≤10% opacity under the line. **Gradient fills stay
  banned (BAN-04 unchanged)** — the reference screenshot's gradient fade is rendered
  as a flat tint.

## 8. Validation

```bash
# No palette hues outside vendored ui/ and tests:
grep -rnE '(bg|text|border|from|to|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]' \
  client/src --include='*.tsx' | grep -v 'shared/ui/' | grep -v '.test.'

# No hex colors in components:
grep -rnE '#[0-9a-fA-F]{3,8}\b' client/src/features client/src/shared/components --include='*.tsx'

# No gradients / lifts / heavy shadows:
grep -rnE 'gradient-to|hover:(scale|-?translate|shadow)|shadow-(md|lg|xl|2xl)' \
  client/src/features --include='*.tsx'
```

All three greps must return nothing (documented exceptions: overlay primitives in
`shared/ui/`).

## Checklist

- [ ] Only semantic tokens; zero palette/hex colors
- [ ] One serif italic accent max per display headline; none in UI chrome
- [ ] Cards flat: `border` + `shadow-xs` max; hover = background tint
- [ ] Sections separated by whitespace (`py-16 sm:py-24`), not borders
- [ ] Dark CTA band uses `dark` token scope, not hardcoded colors
- [ ] Marketing FAQ stays `<details>`-based (SSR-visible answers)
- [ ] lucide icons only; RTL-safe logical utilities
- [ ] Light and dark mode both verified
