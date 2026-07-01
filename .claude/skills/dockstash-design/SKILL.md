---
name: dockstash-design
description: Dockstash monochrome shadcn/ui design system — apply when building, restyling, or reviewing ANY page or component (marketing, auth, dashboard, admin). Covers tokens, serif-accent headlines, flat cards, section anatomy, inverted CTA bands, and the validation greps. Use for requests like "build a page", "add a section", "style this component", "does this match our design".
---

# Dockstash Design Skill

Authority: `.claude/rules/dockstash-design-system.md` (strict rule — read it).
Tokens: `client/src/styles/tailwind.css`. Primitives: `@shared/ui/*`.
Marketing helpers: `client/src/features/marketing/components/shared.tsx`.

## Identity in one line

Monochrome shadcn neutral (near-black ↔ near-white), Inter for UI, **one** Instrument
Serif italic accent per display headline, flat 1px-border cards with `shadow-xs`,
whitespace-separated sections, dot-grid hero backdrops, token-inverted dark CTA band.

## Decision procedure

1. Need a component? Check `client/src/shared/ui/` first; add via shadcn CLI if missing
   (React 18: verify `forwardRef` on native-element and `asChild` targets).
2. Building marketing sections? Compose from `shared.tsx` exports:
   `Container, Eyebrow, Serif, CheckItem, FeatureCard, InvertedBand, FaqSection,
   LinkCard, sectionClass, h1Class, h2Class, cardClass, codeClass`.
3. Color decision = token decision. If you're typing a palette class
   (`bg-blue-*`, `text-zinc-*`) or hex, stop — use `bg-primary`, `text-muted-foreground`,
   `border`, `bg-muted/50`, `text-destructive`, `text-success`.
4. Emphasis = contrast/weight, never hue.
5. Before finishing: run the validation greps from the rule file; check both themes.

## Canonical snippets

Headline with serif accent (marketing only):

```tsx
<h1 className={h1Class}>
  Back Up Your <Serif>Entire</Serif><br />Docker Project
</h1>
```

Hero CTA pair + trust row:

```tsx
<Button asChild size="lg">
  <Link to="/register">Start free<ArrowRightIcon aria-hidden="true" /></Link>
</Button>
<Button asChild size="lg" variant="outline">…</Button>

<CheckItem>Encrypted Restic snapshots</CheckItem>
```

Feature card:

```tsx
<FeatureCard icon={<ShieldCheckIcon />} title="Verified restore drills">
  Restores the latest snapshot to scratch and diffs it against the source.
</FeatureCard>
```

Dark closing band (token inversion — never hardcode dark colors):

```tsx
<InvertedBand className="pattern-dot-grid text-center">
  <Container className="max-w-2xl">
    <h2 className={h2Class}>Ready to Trust Your <Serif>Backups?</Serif></h2>
    …
  </Container>
</InvertedBand>
```

Step numeral:

```tsx
<span aria-hidden="true" className="font-serif text-5xl italic text-muted-foreground/40">01</span>
<span className="mb-3 mt-2 block h-px w-10 bg-border" aria-hidden="true" />
```

## Hard bans (reject in review)

Palette/hex colors · gradients (except `pattern-dot-grid`) · hover lift/scale/shadow
escalation · `shadow-md`+ on static surfaces · `rounded-2xl`+ containers · pill CTA
buttons · serif in body/UI chrome · emoji icons · Radix Accordion for marketing FAQ
(SSR/AEO: keep `<details>`) · physical direction utilities (`pl-`, `text-left`) outside
`shared/ui/` · hardcoded dark-band colors (use `dark` token scope).
