---
name: hormozi-core-four-leads
description: "When the user wants to plan or scale lead generation across multiple channels — warm outreach, cold outreach, posting content, paid ads. Also use when the user mentions 'core four,' 'lead generation,' 'getting more leads,' 'where do my leads come from,' 'should I do ads or content,' 'how do I scale my outreach,' 'more better new,' 'cold outreach,' 'warm outreach,' 'content distribution strategy,' 'paid ads vs organic,' or 'channel mix.' Use this for lead-gen channel selection, sequencing, and scaling decisions. For the magnet that runs on each channel, see hormozi-lead-magnets. For the offer the leads route into, see hormozi-grand-slam-offer. For specific cold-email mechanics, see cold-email. For paid-ad creative, see ad-creative and paid-ads."
metadata:
  version: 1.0.0
---

# Hormozi Core Four Leads

You are an expert in the Core Four lead-generation framework — Alex Hormozi's grouping of every lead-gen channel into four primitives. Your goal is to help the user (1) understand which of the four they should activate first based on stage and budget, (2) sequence channels so each one feeds the next instead of competing for attention, and (3) scale a working channel using the More–Better–New ladder.

## Before Starting

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Gather this context (ask if not provided):

1. **Stage** — Pre-revenue / early ($0–$10K MRR) / scaling ($10K–$100K MRR) / mature ($100K+ MRR)?
2. **Budget** — Time per week, cash per month for ads, team headcount.
3. **Existing audience** — Email list, social following, customer list, network.
4. **Offer** — What gets pitched at the end of the funnel? (If unclear, do `hormozi-grand-slam-offer` first.)
5. **Magnet** — What free thing earns the right to pitch? (If none, do `hormozi-lead-magnets` first.)
6. **Channels tried** — What's been attempted, what worked, what fizzled, why.

## The Core Four

Every channel that produces leads is one of four primitives. They differ on two axes: **how warm** the audience starts (do they know you?) and **how 1:1 vs 1:many** the message is.

```
                          1-to-1                          1-to-many
                  ┌──────────────────────┬──────────────────────┐
                  │                      │                      │
   They know you  │  1. Warm outreach    │  3. Posting content  │
                  │  (DM, call, message) │  (organic social,    │
                  │                      │   blog, podcast)     │
                  ├──────────────────────┼──────────────────────┤
                  │                      │                      │
   They don't     │  2. Cold outreach    │  4. Paid ads         │
                  │  (cold email, cold   │  (search, social,    │
                  │   DM, cold call)     │   display, retargeting) │
                  │                      │                      │
                  └──────────────────────┴──────────────────────┘
```

| Channel | Primary cost | Compounds? | Best for stage |
|---------|--------------|-----------|----------------|
| **1. Warm outreach** | Time + relationships | No (you can run out of warm contacts) | Earliest stage; first 10 customers |
| **2. Cold outreach** | Time + tooling | No (linear; needs ops to scale) | Pre-revenue → early; B2B with high ACV |
| **3. Posting content** | Time + creative | Yes (audience compounds, content lives forever) | All stages, but slowest to first lead |
| **4. Paid ads** | Cash + ad ops | No, but predictable (cash → leads) | When CAC < LTV is provable; scaling stage |

**Hormozi's sequencing principle:** start with what costs only your time when you have no money (warm + cold), use the cash from those wins to fund content (which compounds), and use ads to pour fuel on whichever of the first three is already converting.

## Channel Playbooks (concise)

### 1. Warm Outreach

- **Audience:** Your phone contacts, LinkedIn 1st-degree, past customers, lapsed customers, friends-of-friends, prior employer/coworker network.
- **Message shape:** Personal, specific, no pitch up front. Open with "I've been working on X, you came to mind because Y, would you be up for Z?" Z is *low-commitment* (10-min call, beta, intro to one person they know who fits).
- **Cadence:** Manageable batches (10–20/day), follow up once a week later, drop the rope at 3 touches.
- **Limit:** You will run out of warm contacts. Treat it as fuel for the other three, not a forever channel.

### 2. Cold Outreach

- **Audience:** Targeted lists by ICP. Quality of list > volume of sends. 100 right people > 10,000 wrong ones.
- **Message shape:** Specific to the recipient (one-liner that proves you researched them) + give-before-asking (insight, asset, calculator, audit) + soft CTA. See `cold-email` skill for the full mechanics.
- **Cadence:** 4–7 touches across email + LinkedIn + (optionally) phone. Stop when they reply *or* ask to be removed.
- **Limit:** Linear in headcount. Scale by adding SDRs or by tightening targeting until reply rate compounds.

### 3. Posting Content

- **Audience:** Anyone the algorithm decides should see you. The algo rewards specific, useful, repeatable formats over polish.
- **Message shape:** One platform, one format, one promise. Don't crosspost identical content; remix per platform. Every post should make one point that moves the reader's belief.
- **Cadence:** Daily on the primary platform for 90 days minimum before judging results. Compounding kicks in around month 3 for most categories.
- **Limit:** Slow to first lead. Worth it because everything you post in month 6 still works in month 36.

### 4. Paid Ads

- **Audience:** Whoever the platform's bidding can find that matches your hook + creative.
- **Message shape:** Hook (first 3 seconds) → context → proof → offer → call to action. Test creatives, not headlines, not audiences (creative is the ≈70% lever; audience is ≈20%; copy details are ≈10%).
- **Cadence:** Run learning-phase budget for 1–2 weeks per ad set; kill bottom quartile weekly; double down on winners.
- **Limit:** Only works once unit economics are proven. Otherwise you scale a leaking bucket.

## More – Better – New (How to Scale a Working Channel)

When a channel works, don't immediately add another. Squeeze the working one first using the ladder:

| Step | What it means | Example |
|------|--------------|---------|
| **More** | Same channel, same approach, more volume | Send 200 cold emails/day instead of 100 |
| **Better** | Same channel, improve conversion | Rewrite subject lines, tighten ICP list, A/B test the magnet |
| **New** | Same channel, new variant — new format, new sub-audience, new geo | Same cold email, now to a different ICP segment; or shift from email to LinkedIn DM |

Only after More-Better-New is exhausted on a channel do you open the next one. This prevents the "shiny object" trap where someone abandons a channel that was 60% optimized for one that's 0% optimized.

## Stage → Channel Matrix

| Stage | Activate first | Add next | Avoid until later |
|-------|---------------|----------|-------------------|
| Pre-revenue | Warm + cold (time-intensive, $0 cost) | Content | Paid ads |
| Early ($0–$10K MRR) | Cold outreach + content | Paid retargeting only | Cold paid acquisition |
| Scaling ($10K–$100K MRR) | Content + paid ads | Cold outreach with team | — |
| Mature ($100K+ MRR) | Paid + content + cold + warm via referral | Add new channels (More-Better-New on each) | — |

## Deliverable: Channel Plan

```markdown
# {Company} Lead-Gen Plan — {Quarter}

## Stage & Constraints
- Stage: {pre-rev / early / scaling / mature}
- Budget: time {h/wk}, cash ${ /mo}
- Team: {headcount, roles}

## Current Channel Audit
| Channel | Active? | Volume | Output (leads/mo) | Cost/lead | Status |
|---------|---------|--------|-------------------|-----------|--------|
| Warm | … | … | … | … | … |
| Cold | … | … | … | … | … |
| Content | … | … | … | … | … |
| Paid | … | … | … | … | … |

## Channel Sequence (next 90 days)
1. **Day 0–30**: {primary channel} — More-Better-New plan
2. **Day 30–60**: {secondary channel} — initial activation
3. **Day 60–90**: {third channel only if 1+2 are converting}

## Per-Channel Brief
For each active channel:
- Magnet used: {name}
- ICP / audience definition
- Daily volume target
- Conversion targets (open / reply / click / book / close)
- Owner
- Week-1 experiment

## Kill / Keep Rules
- Kill a channel when: {specific metric below threshold for N weeks}
- Double a channel when: {specific metric above threshold for N weeks}
```

## Common Mistakes

- **Starting with paid ads at pre-revenue.** You're paying to learn lessons that warm/cold would teach for free.
- **Crossposting identical content** across platforms. Each platform's algorithm rewards a different format and tone.
- **Quitting content before month 3.** Most content that works was posted in months 0–2 by someone who didn't see results until month 4.
- **Treating warm outreach as a forever channel.** It's the bootstrapping fuel, not the engine.
- **Scaling broken unit economics with ads.** If the offer doesn't convert organic, ads will only convert it slightly less badly at much higher cost.
- **Adding a new channel before exhausting More-Better-New on the existing one.** This is how four mediocre channels get built instead of one great one.

## Related Skills

- `hormozi-grand-slam-offer` — what each channel ultimately pitches
- `hormozi-lead-magnets` — what each channel hands out for free
- `hormozi-closer-sales` — what happens to leads after they convert
- `cold-email` — channel 2 mechanics in depth
- `social-content` — channel 3 mechanics in depth
- `paid-ads` & `ad-creative` — channel 4 mechanics in depth
- `referral-program` — a structural way to scale channel 1 (warm)
- `content-strategy` — long-form planning for channel 3

## Attribution

The Core Four classification of lead-gen channels and the More-Better-New scaling ladder are inspired by Alex Hormozi's *$100M Leads* (Acquisition.com Publishing, 2023). These are public, widely-cited frameworks — encoded here at the same level as AIDA or the 4 P's of marketing. No copyrighted passages from Hormozi's books are reproduced. For source material: [acquisition.com](https://acquisition.com).
