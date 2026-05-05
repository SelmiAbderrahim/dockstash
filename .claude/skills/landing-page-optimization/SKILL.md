---
name: landing-page-optimization
description: Conversion optimization toolkit for the ServerlessBase landing page. Covers PASTOR framework section ordering, trust escalation, micro-commitment patterns, competitor positioning, A/B testing, and analytics instrumentation. Use when working on landing page, conversion rate, hero section, CTA optimization, pricing presentation, or email capture.
license: MIT
metadata:
  version: "1.0"
  author: "ServerlessBase Team"
  category: "marketing"
  dependencies: "react@18+, typescript, tailwindcss, shadcn/ui"
---

# Landing Page Optimization

## Overview

This skill provides a structured approach to optimizing the ServerlessBase landing page for maximum conversion. It implements the PASTOR copywriting framework, trust escalation patterns, micro-commitment funnels, and data-driven A/B testing -- all within the ServerlessBase tech stack constraints (React 18, TypeScript, Tailwind CSS, RTL/i18n support).

**Keywords**: landing page, conversion, hero section, CTA optimization, conversion rate, pricing page, email capture, A/B testing, trust signals, social proof, competitor comparison, PASTOR framework, savings calculator, exit intent

## When to Use This Skill

- Optimizing landing page copy, layout, or section ordering
- Designing or refining CTA buttons and email capture forms
- Implementing A/B tests on landing page sections
- Adding or reordering trust signals (logos, testimonials, stats)
- Building competitor comparison sections
- Improving pricing page conversion
- Instrumenting analytics events on landing page interactions
- Optimizing for mobile conversion rates
- Selecting or applying a design style to a landing page
- Generating unique landing page prompts with emotional atmosphere
- Reducing landing page sections for higher conversion
- Improving the feeling or atmosphere of a landing page
- Visual storytelling on landing pages
- Creating a cohesive emotional journey through a single page

## Related Agent

Use the **conversion-optimizer** agent (`.claude/agents/marketing/conversion-optimizer.md`) for deep expertise on PASTOR framework, competitor positioning, and pricing psychology.

## PASTOR Framework Section Ordering

The landing page follows the PASTOR framework. Sections MUST appear in this order for maximum persuasion flow.

### Mandatory Section Order

```
1. Header              - Navigation, primary CTA
2. HeroSection         - [P] Problem headline + primary CTA
3. LogoWallSection     - Trust signal (immediate credibility)
4. SocialProofBar      - Trust signal (social proof numbers)
5. PainPointsSection   - [A] Amplify the problem
6. ComparisonSection   - [A] Competitor cost comparison
7. SavingsCalculator   - [A→S] Quantify pain, transition to solution
8. HowItWorksSection   - [S] Solution in 3 steps
9. FeaturesSection     - [S] Feature showcase
10. AppStudioSection   - [S] AI differentiator
11. TestimonialsSection - [T] Customer transformation stories
12. StatsSection       - [T] Quantified results
13. PricingSection     - [O] The offer
14. SecuritySection    - [O] Risk reduction
15. MigrationSection   - [R] Easy next step
16. FAQSection         - [R] Objection handling
17. CTASection         - [R] Final call to action
18. Footer             - Links, legal

Overlays (conditional):
- StickyBottomCTA      - [R] Persistent mobile CTA
- ExitIntentCapture    - [R] Last-chance email capture
```

### Section File Locations

All landing page section components are located at:

```
client/src/components/landing/
  Header.tsx
  HeroSection.tsx
  LogoWallSection.tsx
  SocialProofBar.tsx
  PainPointsSection.tsx
  ComparisonSection.tsx
  SavingsCalculator.tsx
  HowItWorksSection.tsx
  FeaturesSection.tsx
  AppStudioSection.tsx
  TestimonialsSection.tsx
  StatsSection.tsx
  PricingSection.tsx
  SecuritySection.tsx
  MigrationSection.tsx
  FAQSection.tsx
  CTASection.tsx
  StickyBottomCTA.tsx
  ExitIntentCapture.tsx
  EmailCapture.tsx
  StructuredData.tsx
  Footer.tsx
```

## Trust Escalation Pattern

Trust signals must follow a specific escalation order. Early trust signals are low-commitment (logos), progressing to high-commitment (security certifications) as the visitor gets closer to a purchase decision.

### Trust Ladder

```
Scroll Position    Trust Signal          Component              Purpose
---------------------------------------------------------------------------
Above fold         Brand logos           LogoWallSection        "Others use this"
After hero         Social proof numbers  SocialProofBar         "Many people use this"
Mid-page           Customer quotes       TestimonialsSection    "Real people vouch"
Near pricing       Security badges       SecuritySection        "My data is safe"
Before final CTA   Uptime/perf stats     StatsSection           "It actually works"
```

### Implementation Rules

1. Never place security badges above testimonials (feels defensive too early)
2. Logo wall must appear within first viewport scroll
3. Social proof numbers should be specific (e.g., "2,147 developers" not "2,000+")
4. Testimonials must directly address the top 3 objections: cost, reliability, migration
5. Stats section must show independently verifiable metrics

## Emotional Design System

Landing pages that convert don't just inform — they make visitors FEEL something. This system maps 25+ professional design styles to emotional qualities, enabling unique page designs that resonate rather than just communicate.

### Why Style Matters for Conversion

- **48% of visitors leave** without engaging (Gartner) — feeling is what keeps them
- Visitors form a design opinion in **50ms** — before reading a single word
- Emotional resonance increases **time on page by 2-3x** vs purely informational pages
- Consistent emotional tone builds **unconscious trust** through the scroll journey

### Style-to-Feeling Mapping

Each style creates a distinct emotional environment. The style you choose defines how every element — from headline weight to button shape to section spacing — makes the visitor feel.

| Style | Primary Feeling | Typography Feel | Interaction Feel | Best For |
|-------|----------------|-----------------|------------------|----------|
| Neobrutalist | Confrontational honesty | Heavy, unapologetic | Snappy, direct | Developer tools, indie products |
| Swiss/International | Systematic trust | Clean, precise | Crisp, predictable | Enterprise, B2B SaaS |
| Editorial | Curated authority | Serif-accented, literary | Measured, intentional | Content platforms, premium tools |
| Minimal | Essential clarity | Light, spacious | Subtle, disappearing | Design tools, productivity apps |
| Dark Mode First | Sophisticated power | High-contrast, luminous | Smooth, cinematic | Dev tools, monitoring, tech |
| Tech Forward | Innovative confidence | Geometric, modern | Responsive, intelligent | Cloud platforms, AI products |
| Luxury Minimal | Premium exclusivity | Refined, restrained | Elegant, unhurried | Enterprise, high-ticket SaaS |
| Typography First | Expressive authority | Hero-scale, varied | Scroll-reveal, rhythmic | Agencies, creative tools |
| Japandi | Serene professionalism | Balanced, calm | Gentle, natural | Wellness tech, team tools |
| Corporate Professional | Established reliability | Conservative, trustworthy | Stable, predictable | Finance tech, compliance tools |

(Full 25+ catalog available in the conversion-optimizer agent)

### Abstract Quality References

For each style, reference the FEELING of these environments — not specific brands:

- **Spaces**: What kind of physical space embodies this aesthetic? (gallery, workshop, forest, laboratory)
- **Materials**: What textures and surfaces? (concrete, silk, wood, glass, matte black)
- **Movements**: What cultural or artistic movement? (Bauhaus, Art Nouveau, Minimalism, Punk)
- **Craftsmanship**: What level of making? (hand-letterpress, precision engineering, organic pottery)
- **Experiences**: What premium experience? (boutique hotel check-in, museum private viewing, bespoke tailoring)

These references guide design decisions without copying any specific brand.

### Section Reduction Guidelines

**Why fewer sections convert better:**
- Each additional section increases the chance of abandonment
- Long pages dilute the emotional arc — visitors lose the thread
- 9 focused sections with clear progression outperform 26 sections with repetition
- Every section must earn its place: if it doesn't advance the emotional journey, cut it

**The 9-Section Rule:**

| # | Section | Emotional Purpose | Max Scroll % |
|---|---------|-------------------|-------------|
| 1 | Hero | Hook — "This is for me" | 0-15% |
| 2 | TrustBar | Reassure — "Others trust this" | 15-20% |
| 3 | Features | Excite — "This solves my problems" | 20-45% |
| 4 | Testimonials | Validate — "People like me succeeded" | 45-55% |
| 5 | Pricing | Convince — "This is a great deal" | 55-70% |
| 6 | FAQ | Resolve — "My doubts are answered" | 70-85% |
| 7 | CTA | Convert — "I'm ready to try" | 85-95% |
| 8 | Footer | Support — "I can find help" | 95-100% |

### Generating Unique Prompts

To generate a landing page prompt with a specific style:

1. **Select style** — randomly from the catalog (NEVER default to the same one)
2. **Write 3 paragraphs** following the template in the conversion-optimizer agent
3. **Map to PASTOR** — each PASTOR stage gets the style's emotional treatment
4. **Verify constraints** — Uncodixify compliance, dark mode, RTL, touch targets

## Micro-Commitment Pattern

Convert visitors through a series of small, escalating commitments rather than asking for the sale immediately.

### Commitment Ladder

```
Step 1: Consume content       -> Read landing page (free, no commitment)
Step 2: Engage with tool      -> Use savings calculator (reveals personalized value)
Step 3: Provide email         -> Email capture for savings report or deployment guide
Step 4: Create free account   -> Sign up with no credit card
Step 5: First deployment      -> Deploy a test application
Step 6: Upgrade to Pro        -> $29/mo after experiencing value
```

### CTA Progression

| Page Position | CTA Text | Commitment Level |
|---------------|----------|-----------------|
| Hero | "Start Deploying Free" | Low (explore) |
| After calculator | "See Your Full Savings Report" | Low (email) |
| After features | "Try It Free" | Medium (account) |
| Pricing section | "Get Started" / "Start Free Trial" | Medium (account) |
| Migration section | "Migrate in 5 Minutes" | Medium (action) |
| Final CTA | "Deploy Your First App" | Medium (action) |
| Sticky CTA | "Start Free" | Low (account) |

### Rules

1. Primary CTA always appears above the fold
2. Never show "Buy Now" or "Purchase" -- use action-oriented language
3. Always include risk reversal near CTA ("No credit card required")
4. Each CTA should feel like the logical next micro-step
5. Track every CTA interaction: `landing.cta_click` with `{ location, cta_text }` properties

## Competitor Positioning

### Data Source

All competitor pricing data is maintained in `client/src/config/competitor-pricing.ts`. This is the single source of truth for competitor claims used in comparison sections and the savings calculator.

### Positioning Framework

```
1. State the visitor's current situation   -> "You're paying $X/month on [platform]"
2. Quantify the waste                      -> "That's $Y/year more than you need to spend"
3. Show the ServerlessBase alternative     -> "With ServerlessBase: flat $29/mo, everything included"
4. Make switching easy                     -> "Migrate in 5 minutes with Docker Compose"
```

### Key Differentiators to Emphasize

| Differentiator | Against | Messaging |
|---------------|---------|-----------|
| Flat $29/mo pricing | Vercel ($20/seat + overages) | "One price for your whole team" |
| No bandwidth markup | Vercel ($0.15/GB) | "Zero bandwidth charges, ever" |
| Docker Compose native | Railway, Render | "Bring your docker-compose.yml, deploy instantly" |
| AI builders (WebSmith, App Studio) | Coolify (no AI) | "AI-powered deployments, not just containers" |
| No per-seat pricing | Vercel, Railway | "Add teammates free" |
| Data sovereignty | All competitors | "Your data stays on your infrastructure" |
| Security track record | Coolify (11 CVEs, Jan 2026) | "Enterprise security, zero CVEs" |

### Rules

1. Only make claims that can be verified from public pricing pages
2. Update competitor data quarterly in `competitor-pricing.ts`
3. Never use disparaging language -- let the numbers speak
4. Always show the source/date of competitor pricing data
5. Comparison tables must be factual and fair

## A/B Testing Workflow

### Step 1: Identify Hypothesis

```
"Changing [element] from [current] to [proposed] will increase [metric] by [expected %]
because [reasoning based on conversion psychology]."
```

### Step 2: Implement with Feature Flags

```typescript
// Use platform feature flags for section-level tests
import { useFeatureFlags } from "@/hooks/useFeatureFlags";

function LandingPage() {
  const { isEnabled, getVariant } = useFeatureFlags();

  const heroVariant = getVariant("landing_hero_headline");

  return (
    <>
      <HeroSection variant={heroVariant} />
      {isEnabled("landing_savings_calculator") && <SavingsCalculator />}
    </>
  );
}
```

### Step 3: Instrument Analytics

Every variant must fire analytics events with the variant identifier:

```typescript
trackEvent("landing.cta_click", {
  section: "hero",
  variant: heroVariant,     // "control" | "a" | "b"
  cta_text: buttonText,
  device_type: deviceType,
});
```

### Step 4: Analyze Results

- Wait for minimum sample size (1,000 per variant)
- Check statistical significance (95% confidence)
- Review guardrail metrics (bounce rate, scroll depth)
- Ship winning variant, document learnings

## Pricing Section Psychology

### Anchoring Strategy

1. Comparison section (above pricing) shows competitor costs first -- this sets a high anchor
2. Savings calculator quantifies how much the visitor overpays -- personalizes the anchor
3. Pricing section reveals ServerlessBase pricing -- feels like a deal by comparison

### Three-Tier Structure

```
FREE ($0)          PRO ($29/mo)           ENTERPRISE (Custom)
Anchor             Target                  Decoy (upward)
"Try it out"       "Most Popular"          "For large teams"
```

- Free tier exists to let visitors experience value before paying
- Pro tier is the target -- highlighted with "Most Popular" badge
- Enterprise tier makes Pro feel affordable by comparison
- Annual pricing shown with "Save X%" badge to encourage commitment
- All prices derive from `serverlessbase/packages/server/src/billing/pricing-config.ts`

### Pricing Display Rules

1. Always show monthly price with annual discount option
2. Feature lists must be complete (no "Contact us for details")
3. Most valuable features listed first in each tier
4. Free tier shows limits clearly (avoids bait-and-switch perception)
5. Pro tier lists everything in Free plus additions

## Mobile Conversion Optimization

### Mobile-Specific Rules

1. Hero CTA must be visible without scrolling on all mobile viewports
2. Sticky bottom CTA appears after scrolling past the hero section
3. Comparison table uses horizontal swipe instead of full table
4. Savings calculator uses a simplified mobile layout
5. Testimonials show one at a time with swipe navigation
6. Touch targets: minimum 44x44px for all interactive elements

### Mobile Performance Budget

| Resource | Budget |
|----------|--------|
| Hero image | < 100KB |
| Total page weight (initial) | < 500KB |
| Time to interactive | < 3s on 4G |
| Largest Contentful Paint | < 2.5s |
| Cumulative Layout Shift | < 0.1 |

## RTL and i18n Requirements

All landing page sections must support:

- 5 languages: English, Arabic, French, German, Spanish
- RTL layout for Arabic (via `dir="rtl"` on HTML element)
- Logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`)
- Icon mirroring for directional icons (`rtl:scale-x-[-1]`)
- Locale-aware number formatting (`Intl.NumberFormat`)
- No `rtl:flex-row-reverse` (native RTL handles flex direction)

See `.claude/rules/rtl-support-arabic.md` for comprehensive RTL patterns.

## Guidelines

- Every change to the landing page must have a measurable hypothesis
- Track all interactions with the analytics event naming convention: `landing.{section}.{action}`
- Never sacrifice page load performance for conversion tactics
- Test on real mobile devices, not just browser DevTools responsive mode
- Keep pricing claims synchronized with `pricing-config.ts` (single source of truth)
- All copy changes require translation to all 5 supported languages
- Use semantic color tokens for dark mode compatibility

## Reference Files

- [Conversion Patterns](./references/conversion-patterns.md) - Detailed PASTOR breakdown, trust escalation, micro-commitment patterns, and mobile conversion best practices
- [Competitor Analysis](./references/competitor-analysis.md) - Comprehensive analysis of Vercel, Railway, Render, and Coolify weaknesses with ServerlessBase differentiators

## Troubleshooting

**Problem**: CTA click rate dropped after copy change
**Solution**: Verify the new copy follows PASTOR framework stage expectations. Check that the CTA text describes an outcome, not an action. Roll back via feature flag if needed.

**Problem**: Savings calculator shows incorrect competitor pricing
**Solution**: Update `client/src/config/competitor-pricing.ts` with current competitor pricing. All calculator outputs derive from this config.

**Problem**: A/B test shows no significant difference after 2 weeks
**Solution**: Check traffic volume -- you may need more time. Verify analytics events are firing correctly for both variants. Consider if the change was too subtle to detect.

**Problem**: Landing page performance degraded on mobile
**Solution**: Run Lighthouse audit. Check for unoptimized images, excessive JavaScript, or layout shifts. Defer below-fold sections with Intersection Observer.

**Problem**: RTL layout broken in comparison table
**Solution**: Replace any `ml-*`/`mr-*` with `ms-*`/`me-*`. Remove any `rtl:flex-row-reverse` classes. Test in Arabic locale.
