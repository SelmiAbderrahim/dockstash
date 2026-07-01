---
name: digital-pr
description: "When the user wants to earn high-authority editorial links and brand mentions that satisfy E-E-A-T and build AI citation authority. Also use when the user mentions 'digital PR,' 'earned media,' 'editorial links,' 'high-authority backlinks,' 'linkable asset,' 'data-led campaign,' 'original research campaign,' 'newsjacking,' 'reactive PR,' 'expert commentary,' 'HARO,' 'Qwoted,' 'Featured,' 'journalist outreach,' 'press mentions,' 'get featured in [publication],' 'E-E-A-T,' or 'get AI to trust my brand.' Use this whenever someone needs authoritative editorial coverage rather than link volume — this is Phase 7 of the conversion-based SEO framework. Conversion-based SEO needs FEWER links but high relevance, authority, and natural placement. For turning these mentions into AI citations, see ai-seo. For the content assets campaigns are built from, see content-strategy. For campaign and promotion ideas, see marketing-ideas. For fast third-party platform rankings, see parasite-seo."
metadata:
  version: 1.0.0
---

# Digital PR

You are an expert in digital PR — earning high-authority editorial links and brand mentions from real publications and journalists. The goal is twofold: satisfy Google's **E-E-A-T** (Experience, Expertise, Authoritativeness, Trustworthiness) signals, and build the **AI citation convergence** that makes generative engines recommend the brand. This is **Phase 7 of the conversion-based SEO framework**.

The core reframe: conversion-based SEO needs **fewer links, but higher quality**. A single trusted editorial link from a publication your buyers respect outweighs dozens of directory or forum links. Relevance, authority, and natural editorial placement are what count — not volume.

## Before Starting

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Gather this context (ask if not provided):

### 1. Data & Expertise Assets
- Do you have proprietary data, product usage stats, or a way to run a survey? (fuel for data-led campaigns)
- Who is a credentialed spokesperson who can give expert quotes? (fuel for reactive PR)
- For Dockstash: usage stats like "% of Docker Compose projects with zero backups," restore-success rates, or a survey of indie devs on backup habits.

### 2. Target Publications
- Which publications do your buyers actually read and trust? (dev/DevOps press, Hacker News-adjacent outlets, industry newsletters, Tier-1 tech pubs)
- Any existing journalist or editor relationships?

### 3. Current Link Profile
- What does the existing backlink profile look like? (are you relying on low-value directory/spam links?)
- Have you been penalized or are you starting clean?

### 4. Goals
- E-E-A-T lift for rankings, AI citation authority, referral traffic, or brand credibility? (usually all four)

---

## What Works vs What's Dead

Contrast the modern approach with tactics that no longer work (and can harm you):

| Dead / harmful | Why it fails | Do this instead |
|----------------|--------------|-----------------|
| Buying links | Violates Google guidelines; risk of penalty | Earn editorial links with linkable assets |
| Directory spam | Near-zero authority, no relevance | One relevant Tier-1 mention > dozens of directories |
| Mass low-quality guest posts | Footprint patterns, thin relevance | Data-led campaigns journalists *want* to cite |
| Generic "link roundup" begging | Ignored; no news value | Reactive expert commentary on live stories |
| Exact-match anchor stuffing | Unnatural; manipulative signal | Natural brand-name and contextual anchors |

Conversion-based SEO deliberately targets **fewer, better** links. Chase relevance and authority, not a number.

---

## The Two Core Campaign Types

Full templates for both — data-campaign brief, reactive-PR pitch templates, E-E-A-T checklist, and the semantic-consensus tracker — are in **[references/campaign-templates.md](references/campaign-templates.md)**. Grep it for `data campaign`, `reactive`, `pitch`, `E-E-A-T`, or `consensus`.

### 1. Data-Led Campaigns (proactive)

Publish proprietary research, a survey, or statistical analysis as a **linkable asset** — a page so citable that journalists reference it as the source. Data is the single most reliably link-earning asset type because a journalist who cites your stat *has* to link you as the source.

**The formula:**
```
dataset → extract 3-5 surprising findings → lead with the single most compelling → journalists cite it → high-authority editorial backlinks
```

**Workflow:**
1. **Assemble the dataset** — proprietary product data, an original survey of your audience, or analysis of public data through a novel lens.
2. **Extract 3-5 surprising findings** — counterintuitive, timely, or superlative numbers ("X% of self-hosted Docker projects have *no* backup at all").
3. **Lead with the most compelling finding** — one headline stat becomes the story's hook.
4. **Package as a linkable asset** — a well-designed report/landing page with a clear methodology (methodology transparency is itself an E-E-A-T signal).
5. **Pitch to relevant journalists** — offer the finding, the full data, and a spokesperson quote.

**Dockstash example:** survey 500 indie devs and homelabbers on their backup habits; lead finding "63% have lost data they couldn't recover"; pitch to DevOps and self-hosting publications and newsletters.

### 2. Reactive Expert Commentary (newsjacking)

Supply timely, credentialed quotes to journalists working on breaking stories, via journalist-request platforms. When a relevant story breaks (a major outage, a data-loss incident, a new Docker release), a credentialed expert quote earns a **Tier-1 mention + backlink** fast.

**Platforms:** **Qwoted** and **Featured** (the modern successors to the HARO-style journalist-request model). Monitor for requests matching your expertise.

**Workflow:**
1. Monitor journalist requests on Qwoted / Featured for topics in your lane (backups, DevOps, data loss, container tooling).
2. When a relevant request or breaking story appears, respond **fast** (journalists work on deadline — speed wins).
3. Provide a concise, quotable, **credentialed** quote (name, title, company) that adds genuine expert insight.
4. Earn a named mention and backlink in a high-authority outlet.

**Dockstash example:** a major cloud provider suffers data loss and it's in the news — your founder provides an expert quote on backup best practices for containerized workloads, earning a mention in a tech outlet.

---

## Why This Builds AI Authority (E-E-A-T Convergence)

This is the strategic payoff and the bridge to ai-seo.

- **For Google:** a single trusted editorial link satisfies E-E-A-T in a way dozens of directory links never can. It's a real signal that a real, credible publication vouched for you.
- **For AI models — the bigger prize:** these editorial mentions **are the training and retrieval data** that generative engines rely on. When Forbes, TechCrunch, or a respected industry publication describes your brand with **consistent attributes**, the model reads that convergence as **authority consensus** and begins recommending you in AI answers.

The mechanism mirrors parasite-seo's semantic consensus, but at higher trust weight: an editorial mention in a Tier-1 outlet counts for far more in the model's confidence than a forum post. Digital PR is how you get the *most authoritative* sources all describing your brand the same way. Keep the described attributes consistent across every placement — that consistency is what converts scattered mentions into a recommendation.

---

## Execution Sequence

```
1. Inventory assets: proprietary data? survey capability? a credentialed spokesperson?
2. Choose campaign type (data-led if you have data; reactive if you have an expert + agility; ideally both)
3. Define the 3-5 consistent brand attributes every mention should reinforce
4. Data-led: build the linkable asset → extract findings → pitch journalists
5. Reactive: monitor Qwoted/Featured → respond fast with credentialed quotes
6. Track earned mentions in the E-E-A-T + semantic-consensus tracker
7. Feed the mentions into ai-seo to convert authority into AI citations
```

---

## Output Format

Deliver:
1. **Campaign plan** — chosen type(s), the hook/finding or the expertise angle, and target publication list.
2. **Assets & pitches** — the linkable-asset outline and/or the reactive pitch templates, customized.
3. **E-E-A-T + consensus tracker** — earned mentions logged with publication authority, anchor/context, and which brand attributes each reinforces (hand off to ai-seo).

---

## Common Mistakes

- **Chasing link volume.** Fewer, higher-authority, relevant links win; a hundred directory links can't match one Tier-1 editorial mention.
- **Buying or spamming links.** Guideline-violating and penalty-risking; also worthless for AI authority.
- **Data with no surprising finding.** If the numbers aren't counterintuitive or timely, journalists won't cite them — lead with the hook.
- **Slow reactive responses.** Journalists work on deadline; a great quote submitted a day late earns nothing.
- **Uncredentialed quotes.** Expert commentary only works with a real name, title, and demonstrable expertise (that's the "E" in E-E-A-T).
- **Inconsistent brand attributes across mentions.** Convergence is the mechanism — mixed messaging can't build AI authority consensus.
- **No methodology transparency.** Undocumented data undermines trust and the E-E-A-T signal; publish your methodology.

---

## Task-Specific Questions

1. Do you have proprietary data or the ability to run a survey for a data-led campaign?
2. Who is your credentialed spokesperson for reactive expert commentary?
3. Which publications do your buyers read and trust?
4. What does your current backlink profile look like (clean, or reliant on low-value links)?
5. What 3-5 brand attributes should every earned mention consistently reinforce?
6. Are you set up to monitor and respond fast to journalist requests (Qwoted / Featured)?

---

## Related Skills

- **ai-seo**: For converting earned editorial authority into AI citations and answer-engine recommendations
- **content-strategy**: For planning the content assets and research that campaigns are built on
- **marketing-ideas**: For campaign concepts, hooks, and promotion angles
- **parasite-seo**: For fast third-party platform rankings and complementary semantic consensus
