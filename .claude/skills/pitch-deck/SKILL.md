---
name: pitch-deck
description: "Create investor-grade pitch decks, partnership presentations, and accelerator applications for ServerlessBase. Use when the user mentions 'pitch deck,' 'investor deck,' 'fundraising deck,' 'demo day,' 'partnership deck,' 'accelerator application,' 'seed deck,' 'Series A deck,' 'investor presentation,' 'pitch practice,' 'create a deck for investors,' 'prepare for fundraising,' 'VC presentation,' or 'business proposal deck.' This skill runs a full interactive discovery workflow and produces slide-by-slide content with headlines, body copy, speaker notes, and visual direction. For monthly investor communications, see investor-update. For customer-facing sales decks, see sales-enablement."
metadata:
  version: 1.0.0
---

# Pitch Deck

Create investor-grade pitch decks, partnership presentations, accelerator applications, and business proposals tailored to ServerlessBase's positioning, metrics, and narrative.

## Before Starting

**Load product marketing context first.**

Read `.claude/product-marketing-context.md` if it exists. Use that context for positioning, personas, competitive landscape, objections, and brand voice. Only ask questions not already answered there.

Also read `leadership/playbooks/fundraising-prep.md` for metrics thresholds, financial targets, and due diligence requirements.

## Interactive Discovery

Ask the following 8 questions **one at a time** using AskUserQuestion. Wait for each answer before asking the next. Skip questions already answered by the product marketing context or user's initial request.

### Question 1: Deck Purpose

> What is this deck for?
> - Investor pitch (VC, angel, or syndicate meeting)
> - Demo day presentation (accelerator or competition)
> - Partnership proposal (strategic partner or integration)
> - Email deck (send-ahead for investor intros)
> - Business proposal (non-equity business deal)

### Question 2: Audience

> Who will see this deck? Be specific about:
> - Investor type (angel, micro VC, seed fund, Series A fund)
> - Partner type (technology partner, distribution partner, channel partner)
> - Their likely familiarity with DevTools / PaaS / cloud infrastructure
> - Any specific firms or people you're targeting

### Question 3: Stage and Ask

> What are you asking for?
> - Fundraising amount and instrument (SAFE, priced round, convertible note)
> - Partnership terms (integration, co-marketing, revenue share)
> - Accelerator acceptance (which program, cohort timing)
> - Business deal specifics

### Question 4: Current Metrics

> Share your current numbers (or confirm I should use placeholders):
> - MRR and MRR growth rate
> - Total users and paid customers
> - Churn rate
> - Activation rate
> - Cash position / runway
> - Any other traction proof (waitlist, LOIs, pilot customers)

### Question 5: Key Narrative

> What is the single most compelling thing about ServerlessBase right now?
> Pick one or describe your own:
> - Growth momentum (MRR trajectory)
> - AI-augmented team efficiency (1 founder + agents = 20-person output)
> - Market timing (PaaS consolidation, Heroku decline, AI-native tools)
> - Technical moat (all-in-one architecture, Docker-native, 8 DB types)
> - Cost advantage ($29 vs $60+ multi-tool alternative)

### Question 6: Competitive Framing

> Which competitors will your audience most likely compare you to?
> Pick 2-3:
> - Vercel, Railway, Render, Fly.io, Heroku, DigitalOcean, Coolify, AWS
> - Or name others

### Question 7: Known Objections

> What objections or concerns do you expect?
> Common ones:
> - "Single founder risk"
> - "How defensible is this?"
> - "Can you scale to enterprise?"
> - "Why not just use AWS/Vercel?"
> - Or describe specific concerns you've heard

### Question 8: Presentation Context

> How will this deck be used?
> - Presented live (you'll talk through it) — optimize for minimal text, strong visuals
> - Sent by email (must stand alone) — optimize for readable text, self-explanatory
> - Both (will be sent, then presented live)
> - Time limit (e.g., 3 minutes for demo day, 20 minutes for VC meeting)

---

## Deck Type Selection

Map discovery answers to the appropriate framework from [references/slide-frameworks.md](references/slide-frameworks.md).

| Situation | Framework | Slides | Time |
|-----------|-----------|--------|------|
| VC or angel meeting | Investor Pitch (Full) | 12 | 20-30 min |
| Accelerator demo day | Demo Day Deck | 8 | 3-5 min |
| Strategic partner proposal | Partnership Deck | 10 | 15-20 min |
| Sent ahead via email intro | Email Deck | 10 | Self-paced |
| Non-equity business deal | Business Proposal | 10 | 15-20 min |

---

## Slide Generation Workflow

### Step 1: Select Framework

Choose the slide framework from `references/slide-frameworks.md` based on deck type.

### Step 2: Pull Narrative Blocks

Load `references/serverlessbase-narrative.md` and select the content blocks that match the user's answers:
- Problem variant matching their audience's pain awareness
- Solution positioning matching their competitive framing
- Market size data (TAM/SAM/SOM)
- Competitive matrix for their named competitors
- Team narrative (AI-augmented operations)
- Pricing comparison data
- GTM strategy summary

### Step 3: Draft Each Slide

For every slide, produce:

```markdown
## Slide [N]: [Slide Name]

**Headline:** [One sentence — the claim this slide makes]

**Body:**
[Supporting content — 3-5 bullets, a data table, or a short paragraph.
Use specific numbers from the user's metrics. Use placeholders [X] only
when the user hasn't provided the number.]

**Speaker Notes:**
[What the presenter should SAY while this slide is on screen. 2-4 sentences.
Include the key insight, a transition to the next slide, and one anticipated
question with a brief answer.]

**Visual Direction:**
[What the slide should LOOK like. Specify: chart type, screenshot placement,
icon style, or layout suggestion. Keep it concrete — "bar chart comparing
monthly costs across 4 competitors" not "visually appealing graphic."]
```

### Step 4: Add Appendix Slides

Include 2-4 appendix slides for deep-dive questions:
- Detailed financial model / projections
- Full competitive feature matrix
- Technical architecture overview
- Customer case study detail

### Step 5: Prepare for Objections

Reference `references/investor-questions.md` and embed answers to the user's anticipated objections into speaker notes throughout the deck.

---

## Narrative Principles

### Story Arc

Every deck follows: **Problem - Urgency - Solution - Proof - Vision**

1. **Problem** — Establish pain the audience recognizes
2. **Urgency** — Show why this problem is getting worse or why the timing is now
3. **Solution** — Present ServerlessBase as the answer
4. **Proof** — Metrics, customers, competitive comparison
5. **Vision** — Where this goes with funding/partnership/acceptance

### Slide-Level Rules

- **One idea per slide.** If a slide makes two points, split it.
- **Headline = claim.** The headline alone should tell the story if someone just reads headlines.
- **Data over adjectives.** Replace "fast-growing" with "23% MoM for 4 months." Replace "loved by developers" with "NPS 47."
- **Speaker notes are substantive.** Not just "talk about this" — include the actual talking point, transition, and one pre-loaded objection answer.
- **Visual direction is specific.** Not "nice chart" — specify chart type, data series, and layout.

### Tone

Match ServerlessBase brand voice:
- Technical but approachable
- Direct, no corporate jargon
- Show confidence without arrogance
- Use "you" and "we" — never "users" or "the platform"
- Short sentences preferred

---

## Customization by Audience

| Audience | Emphasize | De-emphasize | Tone |
|----------|-----------|--------------|------|
| Angel investors | Founder story, vision, early traction | Detailed financials, unit economics | Personal, passionate |
| Seed VCs | Market size, growth rate, team leverage | Revenue projections beyond 18 months | Data-driven, efficient |
| Series A VCs | Unit economics, path to $1M ARR, defensibility | Early-stage hustle stories | Metrics-forward, strategic |
| Accelerators | Learning velocity, coachability, market insight | Detailed cap table, complex financials | Hungry, self-aware |
| Strategic partners | Mutual value creation, integration depth, shared audience | Internal metrics, cap table | Collaborative, specific |
| Business proposals | ROI for the other party, timeline, deliverables | Fundraising narrative, team story | Professional, outcome-focused |

---

## Output Format

Save the completed deck to `marketing/plan/pitch-decks/[type]-[YYYY-MM-DD].md`.

Filename examples:
- `investor-pitch-2026-03-16.md`
- `demo-day-2026-03-16.md`
- `partnership-acme-2026-03-16.md`
- `email-deck-2026-03-16.md`

The output file includes:
1. YAML header with metadata (deck type, audience, date, version)
2. Executive summary (3 sentences — the deck's thesis)
3. All slides in the format above
4. Appendix slides
5. Key objection responses (from investor-questions.md)

---

## Anti-Patterns

| Pattern | Why It Fails | Instead |
|---------|-------------|---------|
| Feature tour | Investors buy outcomes, not features | Map features to business impact |
| "We're the Uber of X" | Lazy analogy, invites unfavorable comparison | Describe the category you're creating |
| Hockey stick projections without basis | Destroys credibility | Show assumptions behind each number |
| 30+ slide decks | Attention drops after slide 12 | Cut to framework slide count |
| Generic market size numbers | "$500B cloud market" means nothing | Show your specific SAM/SOM with logic |
| No competition slide | Signals naivety, not lack of competition | Honest positioning against 2-3 alternatives |
| Burying the ask | Investors want to know the number early | State the ask by slide 2-3 in email decks |

---

## Related Skills

- **investor-update** — Monthly investor communications (complements pitch deck for ongoing relationship)
- **sales-enablement** — Customer-facing sales decks and collateral (different audience, different goal)
- **copywriting** — Website and marketing copy
- **competitor-alternatives** — Detailed competitive positioning pages
- **pricing-strategy** — Pricing model and tier design decisions
- **launch-strategy** — Product launch and GTM planning
- **leadership-dashboard** — Current metrics for populating deck data
- **product-marketing-context** — Foundation document all skills reference
