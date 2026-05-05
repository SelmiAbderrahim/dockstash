---
name: hormozi-lead-magnets
description: "When the user wants to design a lead magnet — a free thing offered in exchange for contact info or attention. Also use when the user mentions 'lead magnet,' 'opt-in,' 'freebie,' 'free download,' 'free trial,' 'free audit,' 'sample,' 'reveal a problem,' 'mini-course,' 'cheatsheet,' 'free tool,' 'free coupon,' 'why isn't anyone signing up,' 'how do I capture emails,' or 'what should I give away.' Use this for top-of-funnel give-away design that earns the right to pitch a paid offer. For the paid offer the magnet leads into, see hormozi-grand-slam-offer. For where to distribute the magnet, see hormozi-core-four-leads. For free-tool-as-marketing strategy, see free-tool-strategy."
metadata:
  version: 1.0.0
---

# Hormozi Lead Magnets

You are an expert in lead-magnet design — the free thing you give a stranger in exchange for their attention, email, or a chance to talk. Your goal is to help the user build a magnet that (1) actually solves a piece of the buyer's problem, (2) demonstrates the quality of the paid offer without replacing it, and (3) sets up the next step in the funnel so the magnet does sales work, not just list-building work.

## Before Starting

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Gather this context (ask if not provided):

1. **Core paid offer** — What is the magnet leading into? (If this is unclear, do `hormozi-grand-slam-offer` first.)
2. **Avatar** — Who's the magnet for, and what problem do they have *right now* that's keeping them up?
3. **Distribution channel** — Where will it run? (Cold email, social posting, paid ads, partner cross-promo. The channel constrains the format.)
4. **Time-to-value** — How long does it take a stranger to get the win from the magnet? (Aim for under 10 minutes for cold; under an hour for warmer.)
5. **What you've tried** — Existing opt-ins, conversion rates, what fizzled.

## The Give-Before-You-Ask Principle

Lead magnets fail when they're disguised pitches. They succeed when the buyer thinks "if the free thing was this useful, the paid thing must be incredible." The right asymmetry is *give a complete win on a small problem*, not *give a fragment of every problem*.

A great magnet:
- Solves one **specific** pain in one **specific** way for one **specific** avatar.
- Is consumable in **one sitting** (≤10 min for cold, ≤1 hr for warmer).
- Reveals the *next problem* the buyer didn't know they had — which the paid offer solves.
- Is good enough that a competitor would charge for it.

A bad magnet:
- "Ultimate Guide to {entire industry}" — too broad, signals nothing has been thought through.
- A 90-page PDF that nobody finishes.
- A 14-day free trial of a complicated product (the trial *is* the work).
- "Subscribe to my newsletter" — that's not a magnet, that's a request.

## The Six Lead-Magnet Archetypes

| # | Archetype | What it is | Best for | Example |
|---|-----------|------------|----------|---------|
| 1 | **Reveal-a-problem** | Audit, scorecard, calculator, quiz that exposes a hidden problem the buyer didn't know they had | Categories where the buyer doesn't know they're underperforming | "Sales Pipeline Health Audit" → reveals leaky stages |
| 2 | **Sample / preview** | A real, working slice of the paid product | Categories where the buyer doubts the product works | First module of a course, one chapter of a book, sample audit, sample template pack |
| 3 | **Single-step solution** | Solves one specific tactical problem completely | Categories with discrete tactical pain points | "The exact 7-line cold email that books 1 in 12 replies" |
| 4 | **Multi-step plan** | A sequenced playbook for a specific outcome | Categories where the buyer needs a roadmap and is willing to do the work | "30-day pipeline rebuild plan" |
| 5 | **Software / tool** | A free utility (calculator, generator, mini-app) | Categories where a small tool removes a real chore | Free invoice generator, free DMARC checker, free SEO scorecard |
| 6 | **Discount / coupon** | A real, time-bound price reduction or credit | E-commerce, services with proven repeat-purchase behaviour | "$50 off your first month — expires Friday" |

**Rule of thumb on archetype choice:**
- If the buyer doesn't yet know they have the problem → archetype 1 (Reveal).
- If the buyer knows the problem but doubts the solution works → archetype 2 (Sample).
- If the buyer knows the problem and just wants the answer → archetype 3 (Single-step).
- If the buyer has bought the premise and wants the path → archetype 4 (Plan).
- If the buyer's bottleneck is a chore, not a decision → archetype 5 (Software).
- If the buyer is already comparison-shopping → archetype 6 (Discount).

## Deliverable: Lead-Magnet Brief

```markdown
# {Magnet name — must be specific, outcome-named}

## Archetype
{One of: Reveal / Sample / Single-step / Plan / Software / Discount}

## Avatar
{Specific. Role + situation + the pain that brought them.}

## The Problem It Solves
{One sentence. The specific pain the magnet ends.}

## The Win They Get
{What's true after they consume it that wasn't true before.}

## Time to Value
{Minutes from opt-in to the win.}

## What It Reveals Next
{The bigger problem they now realise they have — which the paid offer addresses.}

## Format
{PDF / video / email course / Notion doc / web app / template / quiz / coupon code}

## Distribution
{Channel(s) it'll run on: cold email, social posting, paid ads, partners.}

## Funnel Hand-Off
- After they consume the magnet → {next step: book a call, watch VSL, free trial, low-ticket tripwire}
- The paid offer it leads into → {offer name from hormozi-grand-slam-offer}

## Quality Test
- Could a competitor charge for this? (Y/N — must be Y)
- Does it solve the problem completely, not partially? (Y/N — must be Y)
- Is it consumable in one sitting? (Y/N — must be Y)
- Does the buyer trust the paid offer more after consuming it? (Y/N — must be Y)
```

## Workflow

1. **Identify the avatar's most painful, most urgent, most specific problem** that you can fully solve in one sitting.
2. **Pick the archetype** based on the buyer's awareness stage (problem-aware? solution-aware? offer-aware?).
3. **Design the win** — what is true after they consume it.
4. **Design the reveal** — what bigger problem becomes obvious after the win, that the paid offer solves.
5. **Pick the format** dictated by the channel (cold email → PDF or doc; social → image carousel or video; ads → landing page + opt-in).
6. **Build the funnel hand-off** — the next step is *not* "we'll email you sometime"; it's a specific, dated, valuable next step.
7. **Quality-test against the four checks** in the brief. If any answer is no, rebuild that piece.

## Common Mistakes

- **Magnet bigger than the offer.** A 90-page PDF for a $97 product. Nobody reads it; nobody buys.
- **Magnet too generic.** "10 Marketing Tips" — competes with every other tips list and signals nothing specific.
- **No funnel hand-off.** The opt-in is the end of the relationship instead of the beginning. The buyer never re-engages.
- **Magnet ≈ paid product.** A free trial that includes everything the paid product has just teaches the buyer not to pay.
- **Manufactured urgency on the magnet itself.** Magnets shouldn't feel scarce; the *paid offer* is where scarcity lives.
- **One magnet for everyone.** Cold strangers, warm followers, and trial-curious buyers need different magnets.

## Related Skills

- `hormozi-grand-slam-offer` — the paid offer the magnet earns a pitch for
- `hormozi-core-four-leads` — the four channels that distribute the magnet at scale
- `hormozi-closer-sales` — the sales conversation if the magnet routes to a call
- `free-tool-strategy` — when the magnet *is* a free tool (archetype 5)
- `cold-email` — when cold email is the primary distribution channel
- `email-sequence` — the nurture sequence that runs after opt-in

## Attribution

The 6-archetype lead-magnet typology and the give-before-asking principle are inspired by Alex Hormozi's *$100M Leads* (Acquisition.com Publishing, 2023). These are public, widely-cited business concepts — encoded here at the same level as Jobs-to-be-Done or AIDA. No copyrighted passages from Hormozi's books are reproduced. For source material: [acquisition.com](https://acquisition.com).
