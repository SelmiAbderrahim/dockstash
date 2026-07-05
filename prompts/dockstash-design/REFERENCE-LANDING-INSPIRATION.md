# Reference Landing Inspiration — Mobbin-class landing anatomy (SCREENSHOT AUTHORITY)

> **Reference appendix, not a runnable prompt.** Phase `03` (the landing page) links
> here instead of re-inlining; Phase `05` re-verifies against it. Transcribed from the
> uploaded full-page reference screenshot (Mobbin.com landing — hero → trust strip →
> full-bleed product canvas → pattern sections → feature trio → testimonial masonry →
> closing CTA → logo wall → dark footer).
>
> **This spec is binding for the SSR marketing landing (`Home.tsx`) only.** It refines —
> never replaces — `.claude/rules/dockstash-design-system.md` §4 and Phase 03's Mission.
> Where the two conflict, the design-system rule file wins and the conflict is logged
> in ledger §5. Authenticated surfaces stay governed by `REFERENCE-UI-SPEC.md`.
>
> IDs here use the `LP-` prefix **deliberately** — the batch's 62-ID no-drift check
> greps only `(G|BAN|SEC)-##` / `SPEC-*`, so this appendix adds zero drift. Never mint
> new `G-`/`BAN-`/`SEC-`/`SPEC-` IDs in this file.

## Why this reference (what the screenshot gets right)

The reference page converts by **subtraction**: one idea per section, headlines under
seven words, the product screenshot doing the persuading, a single repeated CTA, and
motion so restrained it reads as confidence. That is the award-winning register
(Awwwards/CSSDA jury language: composed, inevitable, fast). Dockstash's landing copies
the **register and anatomy**, never the brand.

## How to use this appendix

- **Load `landing-page-optimization`, `page-cro`, `copywriting`, `marketing-psychology`
  before applying any LP item** (same skill gates as Phase 03 — skills are gates,
  Execution Contract rule 1).
- Each LP item ends with a **Validate** line naming the existing gate/ban that proves
  it — no new gate machinery; everything lands inside Phase 03's existing gate-out.
- Compose the existing marketing primitives (`shared.tsx`: `Serif`, `h1Class`,
  `sectionClass`, `FeatureCard`, `CheckItem`, `TerminalFrame`, `FaqSection`,
  `InvertedBand`, `Reveal`, `pattern-dot-grid`) — never a parallel primitive set.

## Brand adaptation rule (read first)

The reference is near-monochrome (black text, white ground, one warm-gray band, black
footer) — so is Dockstash; the token mapping is 1:1. Everywhere the screenshot shows a
**solid black element** (primary CTA, footer band), render
**`bg-primary text-primary-foreground`** / the `dark` token scope (`InvertedBand`) so
both themes work. Three deliberate **non-copies**:

| Reference pattern | Dockstash rendering | Why |
|---|---|---|
| Pill-shaped buttons (`rounded-full`) | `rounded-md` buttons via `@shared/ui/button` | Pills stay banned on buttons (design-system radius scale). Copy the *role* — one dominant dark CTA — not the radius. |
| Infinite logo marquee rows above the footer | **Static** wrapped badge/logo grid, one-shot `Reveal` stagger | Marquee is banned motion. The *role* (breadth-of-ecosystem proof) survives; the loop doesn't. |
| Colorful third-party brand chips (Pinterest red, Spotify green…) | Outline `Badge` chips, monochrome, real Dockstash-ecosystem names (Docker, restic, MongoDB, Redis, SFTP, S3…) | BAN-05/BAN-12 (no hex, no palette classes) + no-fake-proof: Dockstash has no logo wall of customers yet — ecosystem/integration chips are the honest equivalent. |

Color may appear **only inside product imagery** (real screenshots, terminal frames) —
never in page chrome.

---

## LP-01 — Copy budget (less text, everywhere)

Hard word budgets, enforced by review not by tooling:

| Slot | Budget | Reference example |
|---|---|---|
| H1 | ≤ 7 words, ends with a period | "Discover real-world design inspiration." |
| Hero sub | 1 sentence, ≤ 16 words | "Featuring over 1,000 iOS & Web apps…" |
| Section H2 | ≤ 6 words, ends with a period | "Find design patterns in seconds." |
| Section sub | ≤ 1 sentence or **none** | most reference sections carry none |
| Card body | ≤ 1 line (~12 words) | feature-trio captions |
| CTA label | ≤ 3 words | "Join for free" |

No paragraph anywhere above the FAQ. If a section needs two sentences to explain
itself, the section's **visual** is wrong — fix the visual, not the copy. Every string
still flows through `t(...)` ×7 locales; budgets apply to the `en` source strings.
**Validate:** ledger §3 entry `LP-01: copy audit` listing each slot with its word count.

## LP-02 — Hero (single decision above the fold)

Anatomy top-to-bottom, centered column, `pattern-dot-grid` backdrop:

1. Brand mark / eyebrow chip (small, quiet).
2. H1, 2 lines max, **one** `Serif` italic accent, period at the end.
3. One-sentence sub in `text-muted-foreground`.
4. **CTA pair, primary visually dominant**: solid `bg-primary` with `ArrowRightIcon`
   + quiet `outline` secondary. The primary CTA label is identical everywhere it
   repeats on the page (LP-07).
5. One line of microcopy under the CTAs (`CheckItem` row) — real claims only
   (self-host, free tier, no card — whatever is true).

Nothing else. No badge rows competing with the CTA, no two-column hero, no video.
**Validate:** SSR proof line for the hero (Phase 03 curl protocol) + G-12 (hero is the
LCP element, < 2.5s).

## LP-03 — Trust strip under the hero

Reference: "Trusted by design teams at" + five muted logos. Dockstash equivalent: one
quiet `text-muted-foreground` line + a static row of monochrome ecosystem marks or
outline chips (Docker, restic, MongoDB, Redis, S3, SFTP). **No invented customer
logos** (Phase 03 "no fake proof" constraint) — ecosystem/works-with framing only,
worded honestly ("Built on tools you already trust" or equivalent via `copywriting`).
**Validate:** BAN block clean (no palette/hex in chips) + SSR proof line.

## LP-04 — Full-bleed product canvas (the screenshot IS the pitch)

Directly under the trust strip, before any feature copy: one **huge** framed product
visual — `rounded-xl border bg-card shadow-xs` container spanning the content column,
containing the real Dockstash dashboard (or the `TerminalFrame` install→first-backup
moment) as a real, current screenshot or SSR-safe composed markup. Reference shows
floating app-screen thumbnails around the canvas; Dockstash may float 2–3 small
`StatusChip`/snapshot-card vignettes, statically positioned, `Reveal`-staggered.

Rules: real product only (no mockup fakery), both-theme variants (`<picture>` or
token-driven markup), lazy-loaded **only if** it is not the LCP element, explicit
dimensions (CLS < 0.1).
**Validate:** G-12 cwv spec green + §4 screenshots at all five widths × both themes.

## LP-05 — Section rhythm (one idea, one visual, centered header)

Every section below the canvas follows the reference's beat:

```
centered H2 (≤6 words, period) → optional 1-line sub → ONE dominant visual → [CTA]
```

Section order for Dockstash (maps Phase 03's Mission list onto the reference rhythm):

| # | Section | Dominant visual | Reference analogue |
|---|---|---|---|
| 1 | Hero | dot-grid + copy | hero |
| 2 | Trust strip | ecosystem chips | logo strip |
| 3 | Product canvas | dashboard/terminal frame | full-bleed canvas |
| 4 | Feature grid | `FeatureCard` 2-col grid | "Find design patterns in seconds." |
| 5 | Terminal moment | `TerminalFrame` paste-able install | "From inspiration to creation." |
| 6 | Steps | oversized serif `01/02/03` numerals | "Explore entire user journeys." |
| 7 | FAQ | native `<details>` (`FaqSection`) | — (keep; AEO requirement) |
| 8 | Closing CTA | `InvertedBand`, dark token scope | "Never run out of inspiration again." |

Sections separate by whitespace only (`sectionClass`, `py-16 sm:py-24`) — no rules, no
alternating background stripes except at most **one** `bg-muted/50` band mid-page (the
reference uses exactly one warm band).
**Validate:** SSR proof lines for all sections (Phase 03 gate-out ≥ 7) + `<details`
present in curl output.

## LP-06 — Motion map (the reference's animation style, inside the sanctioned budget)

The reference animates with soft fade + small translate-up on scroll, staggered
children, once per element. That is exactly the existing `Reveal` primitive:

| Moment | Motion | Budget |
|---|---|---|
| Every section header + visual | one-shot `Reveal` (fade + translate-up), 240ms | existing sanctioned motion |
| Grids/chip rows/floating vignettes | same `Reveal`, staggered 40–80ms per child | stagger = delay, not new animation |
| CTA / links / cards hover | `transition-colors` / `opacity` ≤ 200ms, background tint only | existing |
| Terminal frame | optional type-in ONLY if SSR HTML contains the full command statically (progressive enhancement) | else static |
| Banned regardless of reference | marquee, parallax, hover lift/scale, pulse, looping anything | design-system §6 |

All motion `prefers-reduced-motion`-gated; zero motion in SSR HTML (no CLS from
reveal offsets — reserve space, animate opacity/transform only).
**Validate:** G-12 (CLS < 0.1) + design-system grep block clean.

## LP-07 — Conversion spine (more conversion, structurally)

- **One** conversion goal on the whole page (primary signup/get-started CTA). The
  identical primary CTA appears exactly: hero, after the product canvas OR feature
  grid (one, not both), closing `InvertedBand`. Nav keeps a compact persistent CTA.
- Secondary CTA (docs/self-host/demo) exists only in the hero + footer — never beside
  every section headline.
- Each scroll unit answers, in order: *what is it* (hero) → *can I trust it* (strip +
  canvas) → *how does it work* (features/terminal/steps) → *objections* (FAQ) → *act*
  (inverted band). `page-cro` reviews the final order against this funnel before the
  phase's gate-out.
- No pricing tables, carousels, or newsletter capture on the landing — one decision.

**Validate:** ledger §3 entry `LP-07: funnel review` written while the `page-cro`
skill is loaded, naming CTA count and placement.

## LP-08 — Testimonial masonry (only when real)

The reference's strongest trust section is a 3–4 column masonry of short real quotes
with names/avatars. Dockstash ships this section **only when ≥ 6 real, attributable
quotes exist**. Until then the section is omitted entirely — never lorem, never
synthetic avatars (Phase 03 "no fake proof"). When it ships: flat quote cards
(`border` + `shadow-xs`), quote ≤ 3 lines, name + role in `text-muted-foreground`,
`Reveal`-staggered.
**Validate:** if present — SSR proof line + §4 screenshots; if absent — ledger §5 note
`LP-08 deferred: no real quotes yet`.

## LP-09 — Closing CTA + footer (the dark exit)

Reference ends: giant centered headline ("Never run out of inspiration again."), one
sub-line, one CTA — then a dense dark multi-column footer. Dockstash: `InvertedBand`
(dark token scope, **never** hardcoded dark colors) with H2 ≤ 6 words + one `Serif`
accent + the primary CTA; footer is the existing shared marketing footer in the same
`dark` scope, columns for product/docs/legal/locale switcher.
**Validate:** existing gate — InvertedBand via token inversion (grep block), SSR proof
line for the band's copy.

---

## Application checklist (Phase 03 runs this before its gate-out)

- [ ] LP-01 copy budgets met for every slot (§3 audit entry)
- [ ] LP-02 hero = single decision; one serif accent; primary CTA dominant
- [ ] LP-03 trust strip honest (ecosystem framing, no fake logos)
- [ ] LP-04 product canvas is a real product visual, both themes, CLS-safe
- [ ] LP-05 section rhythm table implemented in order; ≤ 1 muted band
- [ ] LP-06 motion = `Reveal` + stagger only; reduced-motion verified
- [ ] LP-07 one conversion goal; CTA placements exactly as specified
- [ ] LP-08 testimonials real-or-omitted
- [ ] LP-09 inverted closing band + dark footer via token scope

Every box maps into Phase 03's existing gate-out (SSR proofs, G-12, §4 evidence, BAN
block) — this appendix adds review criteria, not new gate machinery.
