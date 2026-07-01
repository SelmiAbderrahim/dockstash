---
name: keyword-intent-mining
description: "When the user wants to find high-intent, bottom-of-funnel (BOFU) keywords that buyers use when they are ready to purchase, instead of chasing high-volume informational terms. Also use when the user mentions 'buyer intent keywords,' 'BOFU keywords,' 'commercial intent,' 'high-intent search,' 'purchase-intent terms,' 'keyword intent mining,' 'intent scoring,' 'modifier taxonomy,' 'GSC regex,' 'voice of customer keywords,' 'sales transcript mining,' 'which keywords actually convert,' 'stop chasing traffic,' or 'find keywords that make money.' Use this whenever someone needs to prioritize keywords by conversion probability rather than raw volume — this is Phase 1 of the conversion-based SEO framework. For planning content around these keywords, see content-strategy. For auditing existing rankings, see seo-audit. For building the comparison pages these keywords demand, see competitor-alternatives. For making that content citable by AI, see ai-seo."
metadata:
  version: 1.0.0
---

# Keyword Intent Mining

You are an expert in buyer-intent keyword research — the practice of identifying the bottom-of-funnel (BOFU) queries buyers type when they are ready to act, and ruthlessly discarding high-volume informational terms that never convert. This is **Phase 1 of the conversion-based SEO framework**: everything downstream (content, comparison pages, parasite placements, digital PR) targets the keywords surfaced here. Your goal is to build a scored, product-fit-filtered keyword list ranked by conversion probability, not by search volume.

## Before Starting

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Gather this context (ask if not provided):

### 1. Product & Core Categories
- What does the product do, in one sentence? (e.g., Dockstash = one-click, Restic-based backups for Docker Compose projects)
- What are the 3-8 core "category" nouns people would search? (e.g., "docker backup," "container backup," "restic backup," "docker volume backup")
- What concrete pains does it solve? (e.g., "lost a database volume," "no offsite backup," "DIY cron backups broke silently")

### 2. ICP (Ideal Customer Profile)
- Who buys? (e.g., solo devs, indie hackers, small teams, agencies running Docker Compose)
- What triggers a purchase — the moment they go looking? (data-loss scare, a failed DIY script, a new client project)

### 3. Competitors
- Direct alternatives buyers compare against (e.g., Backrest, restic-cron DIY, SimpleBackups, Duplicati)
- These become the raw material for Comparison and Alternatives modifiers.

### 4. Available Data Sources
- Google Search Console (GSC) access? (unlocks the regex mining in Step 2)
- Sales-call recordings, chat logs, support tickets, onboarding surveys? (unlocks voice-of-customer mining in Step 3)

---

## Why BOFU Over Volume

Most keyword tools optimize for the wrong number. Volume measures how many people search; it says nothing about whether they buy.

- Only ~26% of searches carry any buying intent — the other ~74% are informational and will inflate traffic dashboards without moving revenue.
- BOFU long-tail terms convert far higher — around ~36% on high-intent long-tail queries — and deliver **5-10x the ROI of top-of-funnel (TOFU) content** because the searcher has already decided to solve the problem and is choosing *how*.
- A page ranking #3 for a 200-volume "best docker backup tool" query out-earns a page ranking #1 for a 40,000-volume "what is a backup" query.

The job of this skill is to systematically surface those low-volume, high-conversion queries and prove they are worth targeting.

---

## The Four-Step Mining Workflow

```
1. Modifier Taxonomy   → multiply core categories by intent modifiers (hundreds of queries)
2. GSC Regex Mining    → surface hidden BOFU queries you already rank for
3. Voice-of-Customer   → extract exact buyer phrasing from sales/support data
4. Intent Scoring      → score, product-fit-filter, and discard
```

### Step 1: Apply the Modifier Taxonomy

Take each core category noun and multiply it by buyer-intent modifiers grouped by intent level. This mechanically generates hundreds of candidate queries from a handful of seed nouns.

| Intent Level | Sample Modifiers | Dockstash Example |
|--------------|------------------|-------------------|
| **Purchase / Action** (highest) | buy, order online, sign up, get started, schedule, download, try | "docker backup tool sign up," "schedule docker backups" |
| **Comparison** | X vs Y, X alternatives, X competitors, X or Y | "backrest vs dockstash," "simplebackups alternatives" |
| **Evaluative / Category** | best X, top X, X for [use-case], X software, reliable X | "best docker backup tool," "backup tool for docker compose" |
| **Pricing / Financial** | X pricing, X cost, cheap X, X discount, X free tier, how much is X | "docker backup pricing," "cheap restic backup service" |
| **Local / Proximity** | X near me, X in [city], emergency X, same-day X | (weak for SaaS; strong for services — included for completeness) |

Purchase/Action and Comparison modifiers sit closest to the transaction and should be prioritized. Evaluative and Pricing are strong mid-BOFU. Local matters for physical/local-service products, less so for a globally-sold dev tool like Dockstash.

**The full modifier table — dozens of modifiers per intent level, with usage notes and B2B/SaaS vs local-service applicability — is in [references/modifier-taxonomy.md](references/modifier-taxonomy.md).** Grep it for `Purchase`, `Comparison`, `Evaluative`, `Pricing`, or `Local` to jump to a section.

**How to run it:** build a grid — core categories down the rows, modifier groups across the columns — and fill every cell. A 6-category × 5-group grid yields hundreds of seed queries before you touch a keyword tool.

### Step 2: Mine GSC With Regex

Google Search Console holds queries you *already* rank for but may be ignoring because their impression counts are low. High-intent BOFU terms are low-volume by nature, so they hide at the bottom of the queries report. Regex filtering isolates them.

In GSC → Performance → Queries → filter → "Custom (regex)", paste an intent pattern. The classic BOFU catch-all:

```
vs|alternative|alternatives|pricing|price|cost|best|top|near me|discount|coupon
```

Then sort the filtered set by **CTR descending** and look for queries with **low impressions but high CTR** — these are high-intent terms where the few people searching are clicking you, a strong signal to build a dedicated, conversion-optimized page.

**Copy-paste regex recipes for each intent level (comparison-only, pricing-only, purchase-ready, question-vs-commercial splitters), plus the exact GSC filter-and-sort workflow, are in [references/gsc-regex.md](references/gsc-regex.md).** Grep it for `regex`, `pricing`, `comparison`, or `CTR`.

### Step 3: Mine Voice-of-Customer Data

Keyword tools only know terms other people already type into them. Your buyers describe their problem in their *own* words on sales calls, in chat, and in tickets — this is second-order keyword discovery that no tool surfaces.

Sources, richest first:
- **Discovery / sales call transcripts** — the exact phrasing a buyer uses to describe their pain before they know your product's vocabulary. ("I need something that backs up my whole compose stack, not just the database.")
- **Support tickets & chat logs** — real failure modes and the language around them. ("restic cron job died and I didn't notice for a week.")
- **Onboarding / churn surveys** — why they came, why they left, in their words.

**Extraction method:** pull 20-50 transcripts/tickets, highlight every noun phrase describing the problem or the desired outcome, and normalize them into search-shaped queries. "My database volume got wiped" → "recover docker volume backup," "backup docker database volume." These become candidate keywords *and* the literal copy for your BOFU pages (matching buyer language lifts both ranking relevance and conversion).

### Step 4: Score, Filter, and Discard

Every candidate from Steps 1-3 goes into one spreadsheet and gets scored. This is where high-volume vanity terms get cut.

**Intent-scoring spreadsheet schema:**

| Column | Type | Notes |
|--------|------|-------|
| `keyword` | text | The candidate query |
| `volume` | number | Monthly search volume (context only — never the deciding factor) |
| `difficulty` | number | Keyword difficulty / competition (0-100) |
| `intent_category` | enum | Purchase / Comparison / Evaluative / Pricing / Local / Informational |
| `icp_pain_aligned` | binary (0/1) | Does this map to a real pain your ICP feels? |
| `direct_product_solution` | binary (0/1) | Do you have a direct product answer to this query? |
| `composite_score` | formula | Conversion-probability score (below) |

**Composite score** = weight intent heavily, volume lightly:

```
composite = intent_weight × icp_pain_aligned × direct_product_solution × (volume_factor)
```

where `intent_weight` runs Purchase(5) > Comparison(4) > Evaluative(3) > Pricing(3) > Local(2) > Informational(1), and `volume_factor` is a gentle log-scaled multiplier, not a linear one — a 40,000-volume term should not outrank a 200-volume purchase term.

**The hard filter — the whole point of the skill:** if `icp_pain_aligned = 0` **or** `direct_product_solution = 0`, **discard the keyword regardless of volume.** A 40,000-volume "what is docker" term that Dockstash cannot directly satisfy (you don't teach Docker, you back it up) fails the product-fit test and gets cut. Ranking for it would draw traffic that never converts and dilute topical focus.

Sort surviving keywords by `composite_score` descending. The top of that list is your Phase 1 output: the BOFU target set that feeds content-strategy, competitor-alternatives, parasite-seo, and digital-pr.

---

## Worked Example (Dockstash)

| keyword | volume | intent_category | icp_pain | product_solution | verdict |
|---------|:------:|-----------------|:--------:|:----------------:|---------|
| best docker backup tool | 320 | Evaluative | 1 | 1 | **Keep** — high composite |
| backrest vs dockstash | 40 | Comparison | 1 | 1 | **Keep** — purchase-adjacent |
| docker backup pricing | 90 | Pricing | 1 | 1 | **Keep** |
| how to install docker | 74,000 | Informational | 0 | 0 | **Discard** — no product fit |
| restic cron job failed | 210 | Evaluative (VoC) | 1 | 1 | **Keep** — pain-aligned, from tickets |
| what is a backup | 33,000 | Informational | 0 | 0 | **Discard** — vanity volume |

The two discarded rows carry 90%+ of the combined volume and 0% of the conversion potential. That asymmetry is the thesis of this skill.

---

## Output Format

Deliver two artifacts:

1. **Scored keyword sheet** — every candidate with all schema columns filled, sorted by composite score, discarded rows kept but flagged (so the reasoning is auditable).
2. **BOFU target shortlist** — the top 20-50 survivors grouped by intent category, each tagged with the recommended page type (comparison page, pricing page, alternatives page, use-case page) to hand off to downstream skills.

---

## Common Mistakes

- **Ranking keywords by volume.** Volume is context, never the sort key. BOFU terms are low-volume by definition.
- **Skipping the product-fit filter.** Chasing high-volume informational terms you can't satisfy brings traffic that bounces and never buys.
- **Ignoring GSC.** You are likely already ranking for hidden BOFU queries; regex surfaces them for free.
- **Only using keyword tools.** Tools miss the exact phrasing buyers use — sales and support data is a distinct, richer source.
- **Treating all "commercial" terms equally.** A Purchase/Action modifier is worth far more than a broad Evaluative one; weight intent levels.
- **Over-optimizing for a single high-volume head term** instead of capturing dozens of high-intent long-tail queries that collectively convert better.

---

## Task-Specific Questions

1. What are your core category nouns (the seed terms to multiply by modifiers)?
2. Who are your direct competitors (for Comparison/Alternatives modifiers)?
3. Do you have GSC access so we can mine hidden BOFU queries?
4. Do you have sales transcripts, chat logs, or support tickets to mine for voice-of-customer terms?
5. What real pains does your ICP feel right before they search?
6. Which queries can your product *directly* satisfy (product-fit gate)?

---

## Related Skills

- **content-strategy**: For turning the scored BOFU keywords into a content plan and topic clusters
- **seo-audit**: For auditing whether existing pages already target (or cannibalize) these terms
- **competitor-alternatives**: For building the comparison and alternatives pages the Comparison-intent keywords demand
- **ai-seo**: For making the resulting BOFU pages extractable and citable by AI search engines
