# Reference UI Spec — app shell & dashboard anatomy (SCREENSHOT AUTHORITY)

> **Reference appendix, not a runnable prompt.** Phases `02`, `03`, and `05` link
> here instead of re-inlining. Transcribed from the four reference screenshots
> (shadcnspace admin: Orders table, Invoice Details, Invoice List, Analytics
> dashboard).
>
> **This spec is binding for every authenticated surface** — dashboard, projects
> list, project detail, snapshots, fleet, billing, settings, setup wizard, profile,
> admin, and **EVERY superadmin tab (Overview, Users, Billing, System, Audit)**. No
> page is exempt: a superadmin table gets the same shell, toolbar, chips, and
> pagination anatomy as a user-facing one. The SSR marketing surface keeps the
> `.claude/rules/dockstash-design-system.md` §4 anatomy; this spec governs everything
> behind login.

## How to use this appendix

- **Load `dockstash-design` and `shadcn` before applying any SPEC.** Any chart (SPEC-10)
  additionally loads `dataviz`. Skills are gates (Execution Contract rule 1).
- Each SPEC below ends with a **Validate** line naming the BAN/G ID that proves it —
  cross-reference `GATE-MACHINERY.md` §d.
- Compose vendored `client/src/shared/ui/*` primitives; **never hand-fight their
  internals.** New shared primitives named here land in `shared/ui/` with unit tests
  (Phase 02) — **canonical filenames** (all phases use exactly these; a different
  name/path is drift):

  | Primitive | File | Test file | SPEC | Consumed by |
  |---|---|---|---|---|
  | `Spinner` | `client/src/shared/ui/spinner.tsx` | `spinner.test.tsx` | hygiene | `Button loading`, dialogs |
  | `Button` `loading` prop | `client/src/shared/ui/button.tsx` (extend) | `button.test.tsx` | hygiene | every async action |
  | `StatChip` | `client/src/shared/ui/stat-chip.tsx` | `stat-chip.test.tsx` | SPEC-05A | dashboard/superadmin rollups |
  | `StatCard` | `client/src/shared/ui/stat-card.tsx` | `stat-card.test.tsx` | SPEC-05B/C | dashboard, billing `UsageTab`, superadmin (absorbs `StatTile.tsx`) |
  | `StatusChip` | `client/src/shared/ui/status-chip.tsx` | `status-chip.test.tsx` | SPEC-06 | every table + detail view |
  | `IconTile` | `client/src/shared/ui/icon-tile.tsx` | `icon-tile.test.tsx` | SPEC-08 | stat cards, feed rows |
  | `DeltaPill` | `client/src/shared/ui/delta-pill.tsx` | `delta-pill.test.tsx` | SPEC-09 | KPI cards |

- **G-18** is the per-surface application-map checklist at the bottom — every row needs
  ledger evidence (§e screenshots, both themes) recorded via the Phase-05 iteration
  protocol, entry template:
  `G-18 <surface>: SPECs [...] | keyboard | themes | widths | rtl | states | shots | fixes`.

## Brand adaptation rule (read first)

The template is monochrome (black primary) — and so is Dockstash. Everywhere the
screenshots show a **solid black fill** (active nav item, "New Invoice"/"View Full
Report" buttons, current-page pagination square, dark chart series), render
**`bg-primary text-primary-foreground`** — which IS near-black in light mode and
inverts to near-white in dark mode automatically. **Never hardcode black or white;**
copy the *role* (the single dominant action / active state) via tokens so both themes
work. Everything else (grays, tints, structure, spacing, radii) maps to existing
semantic tokens plus the SPEC-A additions below. Raw hex stays banned in feature code
(BAN-05); palette classes stay banned (BAN-12).

---

## Sanctioned design-system amendments (SPEC-A — execute in Phase 2, verified by G-19)

The screenshots introduce five patterns the current
`.claude/rules/dockstash-design-system.md` doesn't cover (or nominally bans). These
are **sanctioned amendments** — write them into the rule file; they are **not** BAN
violations.

- **SPEC-A1 — Warning status token (the ONE new hue).** Add `--warning` +
  `--warning-foreground` (amber; light **and** dark values, oklch) in
  `client/src/styles/tailwind.css`, registered in `@theme` so `bg-warning`,
  `text-warning` compile. **No `--info` token** — the monochrome discipline stands;
  informational/in-progress states use muted neutral. Status color language:
  success=`--success` (completed / verified / healthy / online / active subscription),
  warning=`--warning` (pending / queued / stale agent / trialing / draft),
  destructive=`--destructive` (failed / offline / past-due / DLQ / restore-drill
  failure), muted=neutral (running / in-progress / archived / disabled / none).
- **SPEC-A2 — Soft-tint fills.** Register the five `--chart-*` tokens and the three
  status tokens as Tailwind color utilities so **opacity-modified tints** (`bg-success/10`,
  `bg-warning/15`, `bg-chart-3/10`) work. Tint recipe everywhere: background = token at
  10–15% opacity, icon/text = the full-strength token. This builds the stat chips,
  status chips, icon tiles, and tinted icon buttons — **never** with new hex values.
- **SPEC-A3 — `rounded-full` status chips.** Status chips/badges (SPEC-06) are
  pill-shaped. Amends the rule file's `rounded-full` whitelist (currently: micro-icons,
  avatars, status dots): status **chips**, count badges, and delta pills are
  `rounded-full` everywhere. **Pills stay banned on buttons.**
- **SPEC-A4 — Tinted icon-button row actions.** Per-row icon actions (edit/view/delete)
  may be small circular tinted icon buttons (SPEC-07). Destructive row action =
  `bg-destructive/10 text-destructive`.
- **SPEC-A5 — Flat low-opacity area fill.** Area/sparkline charts may use a **flat** fill
  of the series color at ≤10% opacity under the line. **Gradient fills stay banned
  (BAN-04 unchanged)** — the screenshot's gradient fade is rendered as a flat tint.

Everything else in the rule file stands: no card lift/scale, no `transition: all`,
≤200ms transitions, no glassmorphism, no gradient text, lucide-react only, semantic
tokens only, monochrome everywhere else, light+dark parity, one `default` button per
screen, serif accent never in app chrome.

**Validate (SPEC-A):** G-19 — `grep -q 'warning' client/src/styles/tailwind.css &&
grep -qi 'status chip' .claude/rules/dockstash-design-system.md`; tints must not trip
BAN-04/BAN-05/BAN-12.

---

## SPEC-01 — App shell frame

- **Two-column shell:** fixed sidebar (~280–300px, `bg-background`) + main column, built
  on the vendored `client/src/shared/ui/sidebar.tsx` primitive — this run **migrates
  `client/src/shared/components/AppLayout.tsx`** from the current topbar layout to this
  anatomy. The main column is a **framed surface**: `rounded-2xl` (≤16px),
  `border border-border`, `bg-background`, ~16px gutter from sidebar/page edge,
  containing topbar, page content, and the in-frame footer. On `ar` the sidebar sits
  right (logical properties only — `ms-*`/`me-*`, `border-s`).
- **Every** authed page renders inside this frame — including superadmin. One shell
  component in `shared/`; zero per-feature copies (G-09 / shared-layout-system rule).
  The `GuideWidget` mounts once, in the shell.
- **In-frame footer:** muted copyright line start-aligned (`© {year} Dockstash` via
  `t(...)` with interpolated year), end-aligned muted text links (Guides, Security,
  Privacy, Terms). Same footer on every authed page.
- **Breakpoints:** below `lg` the sidebar collapses into the existing `Sheet` drawer;
  the frame goes full-bleed (no gutter) below `md`; tables collapse to cards per SPEC-07.

**Validate:** G-09 (no inlined shell), G-18 §e screenshots both themes + `ar`.

## SPEC-02 — Sidebar

- **Logo block** top: brand mark (rounded square, `bg-primary` with
  `text-primary-foreground` glyph) + "Dockstash" wordmark, links to the dashboard. No
  serif accent — chrome is sans-only.
- **Grouped nav** with uppercase group labels — `text-xs font-medium
  text-muted-foreground tracking-wide` — every label through `t(...)` in all 7 locales.
  Groups: **OVERVIEW** (Dashboard), **BACKUPS** (Projects, Snapshots), **FLEET**
  (Agents), **ACCOUNT** (Billing, Settings, Profile), **ADMIN** (Admin, Superadmin —
  role-gated).
- **Items:** 18px lucide icon + 14–15px label, row height ~40px, `rounded-lg`, hover =
  `bg-muted`. **Active item = solid `bg-primary text-primary-foreground` full-width
  rounded row.** Exactly one active item, derived from the route.
- **Expandable groups:** trailing chevron (rotates on open, ≤200ms, transform-only on
  the chevron); children indented with a `border-s` guide line; **active child =
  `bg-muted` rounded row** (not primary — primary is reserved for the top-level active).
- **Optional trailing badge:** small `rounded-full` chip, `bg-primary/10 text-primary` —
  genuinely new features only, string localized. A `warning`-tinted count on Fleet when
  agents are stale/offline is sanctioned (state, not decoration).
- **Admin/Superadmin group:** rendered only for the matching role, same anatomy — no
  bespoke admin sidebar.
- **Bottom promo card:** `bg-muted rounded-xl` card with title, one muted line, a
  `default` button — the **plan/upgrade card** (current tier + "Upgrade" → `/billing`).
  Hidden for the top paid tier and for superadmin sessions. Any art ships from our
  origin (SEC-07/SEC-09).

**Validate:** G-06 (i18n×7 labels), BAN-06 (logical props), G-18.

## SPEC-03 — Topbar

- Left → right (logical order, flips under RTL): **sidebar-collapse icon button**
  (ghost, `PanelLeft`), thin vertical `Separator`, **page context / global search**. If
  no search backend exists, ship breadcrumb context instead of a dead search box — a
  non-functional input is worse than none; record the choice in ledger §5.
- End cluster, 36px ghost icon buttons with `aria-label`s: **ThemeToggle** (existing),
  **locale switcher** (existing — never a flag-only control), **avatar menu** (32–36px
  `Avatar` initials fallback → `DropdownMenu`: profile, settings, admin link when role
  permits, sign out).
- The screenshot's cart/mail/notification icons have no product equivalent (alerting is
  server-side email) — **do not** ship dead icons.

**Validate:** G-03 (aria-labels, keyboard), G-08 (interaction states).

## SPEC-04 — Page header + breadcrumb

- Every page opens with a **header card**: `rounded-xl border bg-card`, page title
  `text-xl font-semibold` start-aligned; **`Breadcrumb`** end-aligned (`Home / {Section}
  / {Page}` — muted ancestors, `/` separators, current item `text-foreground`;
  localized; collapses to title-only below `sm`). `breadcrumb.tsx` is already vendored.
- Page-level primary actions ("Add project", "Register agent", "Run backup") live in
  this header card or the table toolbar (SPEC-07) — never floating. **No floating FAB.**

**Validate:** one `default` button per view (G-08), G-06.

## SPEC-05 — Stat cards (three sanctioned variants)

- **Variant A — soft-tint chip row:** grid of 4–6 compact chips, each `rounded-xl` with
  a **soft tint** (SPEC-A2: status/chart token at 10–15% opacity), padding ~16–20px.
  Anatomy: top row = **value** (`text-xl font-bold text-foreground`) + end-aligned small
  **icon in a full-strength-token circle**; below = muted label. Tint follows the
  metric's semantic: succeeded=`success`, pending/queued=`warning`, failed=`destructive`,
  neutral=`muted`. Use for: dashboard backup rollups (succeeded/pending/failed last 24h),
  snapshot verify rollups, superadmin queue/DLQ counts.
- **Variant B — bordered stat card with progress bar:** `bg-card border rounded-xl`;
  value `text-2xl font-bold`; muted label; end-aligned **icon tile** (SPEC-08); footer =
  thin (~4px) `rounded-full` progress bar — filled segment in the semantic token, track
  `bg-muted`. Use for: **usage-vs-cap meters** in billing `UsageTab` (storage/projects/
  agents vs cap — the bar IS the cap meter), superadmin health cards.
- **Variant C — KPI + delta:** value `text-2xl/3xl font-bold` + **DeltaPill** (SPEC-09),
  muted context line ("than last month" — localized, interpolated), optional single-
  series sparkline in `--primary` with flat ≤10% fill (SPEC-A5), optional "See details →"
  `outline` button (arrow flips under RTL). Use for: dashboard KPIs (protected projects,
  total snapshots, storage growth), superadmin MRR.
- The superadmin `StatTile.tsx` is an existing ad-hoc take — **promote/replace it with
  the shared primitive** so superadmin and user surfaces share one implementation.
- All variants: **static** — no hover lift, no animated counters. Values per locale
  (`Intl.NumberFormat`); bytes via the existing `formatBytes` helper.

**Validate:** BAN-03 (no hover lift), SPEC-A2 tint recipe, G-18.

## SPEC-06 — Status chips

One shared `StatusChip` primitive (in `shared/`), used by **every** table and detail
view, app and superadmin alike:

- Shape: `rounded-full` (SPEC-A3), `px-2.5 py-0.5 text-xs font-medium`; fill
  `bg-{token}/10 text-{token}` (dark mode: same tokens, dark values — verify contrast
  both modes).
- Semantic map (SPEC-A1): success = completed/verified/healthy/online/active; warning =
  pending/queued/stale/trialing; destructive = failed/offline/past-due/DLQ; muted =
  running/in-progress/archived/disabled/none.
- Always token + **localized text**, never color alone (a11y). Static — no pulse —
  including agent-health indicators.
- Applies to: backup-run status, snapshot verify state, agent health
  (online/stale/offline), restore-drill result, subscription status (billing +
  superadmin), invite status, webhook delivery status (superadmin), audit-event severity.

**Validate:** G-03 (color+text, never color alone), SPEC-A3, G-04 (both modes).

## SPEC-07 — Data tables (the one table anatomy, everywhere)

Every listing — projects, snapshots, fleet agents, billing invoices/orders, settings
destinations, **superadmin Users / Billing / Audit tabs** — follows this exact anatomy
on shadcn `Table`:

- **Card wrapper:** `rounded-xl border bg-card` section, header row: section title
  (`text-lg font-semibold`) start-aligned; end-aligned **ghost icon-button cluster**
  (`Search`, `Filter`/`SlidersHorizontal`, `Download` export — only icons with real
  handlers; each `aria-label`ed).
- **Optional filter-tab row:** segmented status filters — each tab = label + small
  `rounded-full` count badge tinted per SPEC-06 ("All 12 / Healthy 9 / Stale 2 / Offline
  1"); **selected tab = `bg-muted rounded-lg`**; state persists as **`?tab=`**
  (url-tab-state rule). Beside it: scoped search input + `outline` filter buttons
  (date-range as `Popover`); the page's single **`default` button** end-aligned.
- **Header row:** muted background or muted semibold text; sortable columns show the
  double-arrow sort icon (`ArrowUpDown`, 14px, muted; active sort = `text-foreground`
  directional arrow); optional leading checkbox column (`Checkbox`) when bulk actions
  exist.
- **Cells:**
  - *Entity cell:* 32px `Avatar` (image or initials) + `font-medium` name.
  - *Status:* `StatusChip` (SPEC-06).
  - *Date:* two-line — date `font-medium text-foreground`, time `text-sm
    text-muted-foreground`; locale-formatted (`Intl.DateTimeFormat`).
  - *Numeric/size:* end-aligned, tabular-nums; sizes via `formatBytes`; money from cents
    via locale currency format.
  - *Row actions:* either (a) trailing ghost `ChevronDown` + `⋯` `DropdownMenu`, or (b)
    an **icon-button trio** — circular tinted per SPEC-A4: primary = `bg-primary/10
    text-primary`, view = `outline`/muted, delete/forget = `bg-destructive/10
    text-destructive`. Pick ONE style per table; destructive actions confirm via
    `AlertDialog`.
- **Rows:** 1px `border-border` separators, height ~64–72px, hover = `bg-muted/50`
  background change only.
- **Footer:** start = "Show [N ▾] per page" (`Select`, localized); end = "1–6 of 6"
  range (localized, interpolated) + previous/next **arrow icon buttons** (disabled at
  bounds, arrows flip under RTL) + **current page square** (`bg-primary
  text-primary-foreground rounded-md`). Replace/absorb the ad-hoc superadmin
  `Pagination.tsx` with the shared implementation.
- **Empty / loading / error:** designed states required — `Skeleton` rows while loading,
  `Empty` with one next-step action ("Register your first agent"), inline error `Alert`
  with retry. Below `md`, rows collapse to stacked cards keeping chip + actions anatomy.

**Validate:** url-tab-state (`?tab=`), BAN-06, G-03 empty/loading/error, G-18.

## SPEC-08 — Icon tiles

Shared `IconTile` primitive: lucide icon (16–20px) centered in a `rounded-lg`/`rounded-xl`
square (~40px), `bg-{token}/10 text-{token}` (or `bg-muted text-muted-foreground`).
Used in: stat cards (SPEC-05B/C), activity/feed rows (SPEC-11), feature lists. Never
emoji, never raw hex.

**Validate:** BAN-05, Phase-5 emoji visual sweep.

## SPEC-09 — Delta pills

Shared `DeltaPill` primitive: `rounded-full px-2 py-0.5 text-xs font-medium`; positive =
`bg-success/10 text-success` with `+` prefix; negative = `bg-destructive/10
text-destructive`; neutral = muted. **Invertible semantics prop** — for storage-cost or
failure-count metrics a *decrease* is good; the pill colors by *goodness*, not by sign.
Values locale-formatted; sign rendering RTL-safe.

**Validate:** SPEC-A3, unit test (invert prop), G-06.

## SPEC-10 — Charts (Analytics anatomy → `dataviz` skill governs execution)

No charting library is installed today — any chart this run adds goes through
**`dataviz`** first, and stays in the monochrome ramp.

- **Chart card anatomy:** title (`font-semibold`) + one muted subtitle; end-aligned
  control (`Select` range — state in query params) or `IconTile`; chart body; optional
  side rail (`IconTile` + big total + legend rows); optional full-width **`default`
  button** footer ("View details" → deep link). Button counts toward the one-primary
  budget — if the page has a primary already, use `outline`.
- **Column/bar:** rounded-top bars; multi-series uses `--chart-1..5` lightness ramp in
  declaration order; sparse horizontal gridlines only; muted axis labels; no shadows.
- **Sparkline/area:** single series = `--primary`, ~2px line, flat ≤10% fill (SPEC-A5).
  No gradient.
- **Donut:** `--chart-*` segments (lightness-differentiated), legend = color dots +
  localized labels; center or side total.
- **Every chart:** light+dark parity, **accessible data-table fallback**,
  `prefers-reduced-motion` honored (no entrance animation when set). Load `dataviz`
  before writing any of it.
- Product mapping: backup success-rate trend (line/columns), storage growth (area),
  snapshots per project (columns), superadmin MRR (SPEC-05C + sparkline), superadmin
  queue depth (columns).

**Validate:** BAN-04 (no gradient), G-07 (reduced-motion), `dataviz` loaded (G-01).

## SPEC-11 — List/feed rows

Shared row anatomy for compact card lists: `IconTile` (or 32px round `Avatar`) + title
`font-medium` with one muted subtitle + end-aligned value (`font-semibold`) or
`StatusChip`/`DeltaPill`. Rows separated by whitespace or 1px borders; whole-row link
where navigable (hover = background change only). Card may end with a full-width details
button per SPEC-10. Use for: recent backup runs (dashboard), latest snapshots, agent
heartbeat feed, billing history, **superadmin recent signups / webhook events / audit
preview**. Avatar stacks: overlapping 28px avatars, `-ms-2` logical overlap, `+N`
overflow bubble, `ring-2 ring-background`.

**Validate:** BAN-03/BAN-06, G-18.

## SPEC-12 — Detail-document pages (Invoice Details → project/snapshot/invoice/event)

- **Action bar** on top: single row of ghost **text-buttons with leading icons**,
  separated by thin vertical `Separator`s — project detail: Run backup / View snapshots
  / Edit / Delete; snapshot: Restore / Verify / Forget; invoice: View / Download;
  superadmin webhook: Replay / View payload. All localized; each async action uses the
  shared in-button loading state (backup/restore especially).
- **Document header:** name/`#id` (`text-xl font-bold`) start; **`StatusChip`** far end.
  The project-detail **last-failure alert** (existing feature) renders as an inline
  `Alert` (destructive variant) directly under this header — keep it, restyle into the
  anatomy.
- **Two-column meta panels:** label (`font-semibold`) above a **`bg-muted rounded-xl`
  panel** of 3–4 text lines. Map to: project config vs assigned agent; snapshot meta vs
  repository/destination; seller vs customer; endpoint vs event meta. Stacks below `md`;
  RTL mirrors.
- **Date pairs:** bold label + value below (Created / Last backup → Started / Finished),
  locale-formatted.
- **Items table:** simplified SPEC-07 (muted header, no checkboxes/actions) — snapshot
  artifacts (volumes, file-mode dumps, configs), invoice line items; numeric/size
  columns end-aligned.
- **Totals panel:** full-width `bg-muted rounded-xl` block, rows end-aligned — muted
  label : value; final row (total size / amount due) `font-bold` and larger. Sizes via
  `formatBytes`; money from cents, locale currency.
- **Log surface:** where restic output streams (`ResticLogPanel`), frame it in the
  JetBrains Mono code surface (`TerminalFrame`-style chrome adapted to the app), never a
  bare `<pre>`.
- **Notes footer:** `**{t('notes')}:**` + muted line.

**Validate:** shared in-button loading (interaction-hygiene rule), G-06, G-18.

---

## Per-surface application map (the G-18 checklist — every row needs ledger evidence)

| Surface | Applies |
| --- | --- |
| Dashboard | SPEC-01…05, 09, 10, 11 (KPI row, backup rollup chips, recent-runs feed, optional trend chart) |
| Projects list | SPEC-07 (entity cells, last-backup status chips, icon-trio or `⋯` actions, empty state → "Add project") |
| Project detail | SPEC-12 (action bar, last-failure `Alert`, config/agent meta panels, runs table) |
| Snapshots | SPEC-07 table (verify-state chips, size columns, filter tabs) + SPEC-12 snapshot detail + `RestoreDialog` in-button loading |
| Fleet (agents) | SPEC-07 table (host entity cells, health chips, heartbeat date cells) + Register/Setup/Update dialogs + `TerminalFrame` install command + SPEC-05A health rollup |
| Billing | SPEC-05B usage/cap cards (UsageTab), SPEC-07 invoice/order table, SPEC-12 invoice detail, SPEC-06 subscription chips, PricingGrid monochrome |
| Settings + Setup wizard | SPEC-01…04 shell + form patterns; wizard steps with one primary per step |
| Profile | SPEC-01…04 shell + form patterns |
| Admin | SPEC-01…04 shell + listing/detail anatomy its content matches (SPEC-07/12) |
| **Superadmin: Overview tab** | SPEC-05B+C cards (MRR, health), SPEC-10 trend, SPEC-11 recent signups — via promoted shared StatCard (absorbs `StatTile.tsx`) |
| **Superadmin: Users tab** | SPEC-07 full anatomy (avatar cells, role/status chips, filter tabs, shared pagination — absorbs `Pagination.tsx`) |
| **Superadmin: Billing tab** | SPEC-07 events/subscriptions table (delivery-status chips) + SPEC-12 event detail w/ Replay action bar |
| **Superadmin: System + Audit tabs** | SPEC-05A queue/DLQ chips row + SPEC-07 audit table (severity chips, date cells) |
| Auth screens | shared shell chrome (logo, ThemeToggle, locale switcher), form patterns, in-button loading on submit |

**G-18 done rule:** each row above has a per-surface SPEC checklist in the ledger + §e
screenshots (both themes) showing shell, stat-card, table, and status-chip anatomy.
