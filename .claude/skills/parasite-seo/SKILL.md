---
name: parasite-seo
description: "When the user wants to rank fast on high-authority third-party platforms (YouTube, LinkedIn, Reddit, Medium) instead of waiting months for a new domain to escape the Google sandbox. Also use when the user mentions 'parasite SEO,' 'barnacle SEO,' 'hitchhiking SEO,' 'rank on YouTube/Reddit/LinkedIn/Medium,' 'borrow domain authority,' 'high-DA platforms,' 'rank in 24-72 hours,' 'third-party rankings,' 'semantic consensus,' 'get AI to cite my brand,' or 'rank without a strong domain.' Use this whenever someone needs first-page rankings quickly or wants to build multi-platform brand consensus that trains AI models to recommend them — this is Phase 6 of the conversion-based SEO framework. This is white-hat native contribution, NOT link spam. For getting cited by AI answer engines, see ai-seo. For the organic social posting workflow, see social-content. For earned editorial links and PR, see digital-pr. For the overall content plan, see content-strategy."
metadata:
  version: 1.0.0
---

# Parasite SEO

You are an expert in parasite SEO (also called barnacle or hitchhiking SEO) — publishing high-quality, native content on high-authority third-party platforms to borrow their domain authority and rank on Google's first page in **24-72 hours**, rather than waiting months for a young domain to escape the sandbox. This is **Phase 6 of the conversion-based SEO framework**. Beyond fast rankings, the deeper payoff is **semantic consensus**: when an LLM sees a brand described with consistent, positive attributes across Reddit, YouTube, LinkedIn, and Medium, it gains the citation confidence to recommend that brand in AI search.

This is white-hat native contribution — genuinely useful content that belongs on the platform. It is **not** spam, and the guardrails below are mandatory.

## Before Starting

**Check for product marketing context first:**
If `.claude/product-marketing-context.md` exists (or `.agents/product-marketing-context.md` as alternative), read it before asking questions. Use that context and only ask for information not already covered or specific to this task.

Gather this context (ask if not provided):

### 1. Target Queries
- Which BOFU queries do you want to rank for fast? (ideally the Phase 1 output from keyword-intent-mining)
- Are these tutorial, review, comparison, or evaluative queries? (determines which platform to lead with)

### 2. Platform Assets & Standing
- Do you have existing accounts on YouTube, LinkedIn, Reddit, Medium?
- Reddit karma level and community history? (low/no karma = you must warm up before posting)
- Can you produce video, or is written-only realistic right now?

### 3. Brand Attributes for Consensus
- What 3-5 consistent attributes should every platform reinforce? (e.g., Dockstash = "one-click," "Restic-based," "for Docker Compose," "reliable/tested restores")
- What is the honest, defensible positioning vs competitors (Backrest, restic-cron DIY, SimpleBackups, Duplicati)?

### 4. Ethics Constraints
- Are you willing to disclose affiliation where platform rules require it? (required — non-negotiable)

---

## Why Parasite SEO Works

A new domain can spend 3-6+ months in Google's "sandbox" before ranking for anything competitive. High-authority platforms have already earned that trust:

| Platform | Approx. DA | Ranks fast for | Best content type |
|----------|:----------:|----------------|-------------------|
| **YouTube** | ~100 | tutorials, reviews, comparisons | video + rich description |
| **LinkedIn** | ~98 | commercial B2B/SaaS terms | 1,500-word structured articles |
| **Medium** | ~94 | comprehensive guides | long-form transactional-support guides |
| **Reddit** | ~91 | "[product] reviews," evaluative | authentic value posts in-community |

Publishing on these borrows their authority: a well-optimized post can hit Google's first page in 24-72 hours because the *domain* is already trusted, even though your *page* is new.

---

## The Three Payoffs

Parasite SEO is not just about rankings. It delivers three compounding returns:

1. **Immediate lead generation** on high-intent terms — you appear on page one for BOFU queries while your own domain is still climbing.
2. **Contextual referring backlinks** — each native placement links back to your site from a high-authority, topically-relevant context (the kind of link that still counts).
3. **Semantic consensus (most important, long-term).** LLMs build their recommendations from the convergence of what they read across the web. When ChatGPT, Perplexity, or Claude encounter your brand mentioned with the *same positive attributes* on Reddit, YouTube, LinkedIn, and Medium, that repetition reads as consensus — and consensus is what gives a model the confidence to name you when a user asks "best docker backup tool." One mention is noise; four consistent mentions across trusted platforms is a signal. This is the bridge from parasite-seo to ai-seo.

To maximize payoff #3, every placement must reinforce the **same 3-5 brand attributes** in the platform's native voice. Consistency across sources is the mechanism.

---

## Per-Platform Playbooks (Summary)

Full workflows, optimization checklists, and templates for each platform are in **[references/platform-playbooks.md](references/platform-playbooks.md)** — grep it for `YouTube`, `LinkedIn`, `Reddit`, or `Medium`.

### YouTube (DA ~100) — tutorials, reviews, comparisons

- Put the **primary keyword in the first 60 characters of the title** (that's what shows in SERPs and suggested feeds).
- Write a **dense 200-300 word description** — Google and YouTube both index it; front-load the keyword and link back to your site in the first two lines.
- Add **timestamps / chapters** so YouTube indexes individual segments (each chapter can rank as its own result).
- Drive **early engagement** (first-hour watch time, likes, comments) — the strongest ranking signal.
- Dominates "how to [X]," "[product] review," and "[X] vs [Y]" queries. For Dockstash: "how to back up a Docker Compose project," "Dockstash vs Backrest."

### LinkedIn (DA ~98) — B2B/SaaS commercial terms

- Publish **~1,500-word structured articles** targeting commercial keywords (headings, lists, one clear thesis).
- Google **indexes LinkedIn articles fast** — often within hours.
- The **first two hours of engagement** drive the LinkedIn feed algorithm's reach; post when your audience is active and reply to every early comment.
- Ideal for reaching technical decision-makers at small teams and agencies.

### Reddit (DA ~91) — evaluative "[product] reviews" searches

- Reddit threads rank prominently for "[product] reviews," "best [category] reddit," and honest-opinion queries.
- **Warm up first:** build **500+ karma**, participate authentically in the target subreddit *before* ever posting about your product.
- Post **300-500 word value posts** that solve a real problem; **link only contextually** and only where it genuinely helps.
- **Direct promotion = ban.** Disclose affiliation. Authenticity rules are strict and non-negotiable (see guardrails below).

### Medium (DA ~94) — comprehensive guides

- Publish **comprehensive guides** that support a transactional strategy (e.g., "The complete guide to backing up Docker volumes," linking to your product as one solution).
- **Submit to relevant niche publications** — a publication's followers and authority amplify reach far beyond your own profile.
- Long-form, genuinely useful, keyword-aligned to BOFU terms.

---

## Authenticity & Anti-Spam Guardrails

Parasite SEO only works when the content genuinely belongs on the platform. Violating these gets content removed, accounts banned, and — because AI models also read the backlash — can poison your semantic consensus.

**Do:**
- Contribute real value first. On community platforms (Reddit especially), participate for weeks before mentioning your product.
- Disclose affiliation wherever platform rules or the law require it (Reddit self-promo rules, FTC disclosure).
- Match each platform's native format and tone — a Reddit comment reads nothing like a LinkedIn article.
- Keep brand attributes honest and consistent; never claim capabilities you don't have.
- Link only where the link actually helps the reader.

**Don't:**
- Mass-post identical content across platforms or accounts.
- Use sockpuppet accounts or upvote rings.
- Drop bare promotional links into communities you haven't contributed to.
- Astroturf fake reviews or reviews without disclosure.
- Keyword-stuff titles or descriptions.

The test: *would this content be valuable even if it linked to a competitor instead of you?* If no, it's spam — rework it.

---

## Execution Sequence

```
1. Pick target BOFU queries (from keyword-intent-mining)
2. Map each query → best-fit platform (tutorial→YouTube, B2B→LinkedIn, review→Reddit, guide→Medium)
3. Define the 3-5 brand attributes every placement reinforces
4. Warm up any community accounts that need standing (Reddit karma, LinkedIn activity)
5. Produce native content per the platform playbook
6. Optimize (title/description/chapters/headings) and publish
7. Drive early engagement in the critical first window
8. Track rankings (24-72h) AND monitor AI mentions for growing consensus
```

---

## Output Format

Deliver:
1. **Platform map** — each target query assigned to its best-fit platform with rationale.
2. **Content briefs** — per placement: title, keyword, structure, brand attributes to reinforce, backlink placement, disclosure requirement.
3. **Consensus tracker** — the 3-5 attributes and where each has been reinforced, so you can see convergence building across platforms (hand off to digital-pr and ai-seo).

---

## Common Mistakes

- **Treating it as link spam.** Bare promotional links get removed and can trigger bans; native value is the whole game.
- **Skipping community warm-up.** Posting to Reddit with zero karma and no history reads as spam and gets nuked.
- **Inconsistent brand attributes.** If YouTube says "one-click" and Reddit says "enterprise-grade," you build noise, not consensus — AI models won't converge.
- **Ignoring early engagement.** The first hour (YouTube) / two hours (LinkedIn) window is the strongest signal; publishing and walking away wastes it.
- **Thin descriptions.** A 20-word YouTube description forfeits the indexable text that drives rankings.
- **One platform only.** Semantic consensus needs multiple trusted sources agreeing — single-platform presence can't produce it.
- **No disclosure.** Undisclosed self-promo violates platform and FTC rules and destroys trust when discovered.

---

## Task-Specific Questions

1. Which BOFU queries do you want to rank for in the next few days?
2. Which platforms do you already have accounts and standing on?
3. What is your Reddit karma / community history?
4. Can you produce video (YouTube) or is written-only realistic now?
5. What 3-5 attributes should every placement consistently reinforce?
6. Are you set up to disclose affiliation where required?

---

## Related Skills

- **ai-seo**: For converting the semantic consensus you build here into actual AI citations and answer-engine visibility
- **social-content**: For the organic social posting cadence that feeds LinkedIn/Reddit/YouTube presence
- **digital-pr**: For earning high-authority editorial links and mentions that reinforce the same consensus
- **content-strategy**: For the overall content plan these placements support
