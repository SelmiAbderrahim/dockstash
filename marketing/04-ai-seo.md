# AI SEO (AEO/GEO) — Getting Cited by AI Answer Engines

~45% of Google searches now show AI Overviews, and developers disproportionately ask ChatGPT/Claude/Perplexity instead of Googling. When someone asks *"how should I back up a Docker compose project?"* or *"best Backrest alternative?"*, Dockstash must be in the answer. Traditional SEO gets you ranked; this gets you **cited**.

Advantage already in hand: the marketing surface is SSR (full HTML for crawlers), FAQ uses native `<details>` (answers exist in server-rendered HTML), JSON-LD is in place, and the competitor pages are deliberately balanced — one-sided comparisons get discounted by answer engines, honest ones get cited.

## 1. Crawler access (do first, 30 minutes)

`robots.txt` must allow the citation bots (blocking them = invisible to that platform):

```
User-agent: GPTBot          # ChatGPT
User-agent: ChatGPT-User
User-agent: PerplexityBot   # Perplexity
User-agent: ClaudeBot       # Claude
User-agent: anthropic-ai
User-agent: Google-Extended # Gemini / AI Overviews
User-agent: Bingbot         # Copilot
Allow: /
```

Optional middle ground: block training-only crawlers (`CCBot`) while allowing the above. Also add an **`llms.txt`** at the site root: a concise markdown map of the product (what it is, who it's for, pricing, key pages) — emerging convention, cheap to ship via the existing SEO module (`server/src/modules/seo/`).

## 2. Content extractability rules (apply to every page/post from doc 03)

AI systems extract **passages**, not pages. Per page:

- **Lead with a 40–60 word direct answer** under each H2 — the definition/answer first, elaboration after.
- **H2/H3s phrased as the query**: "How do you back up Postgres running in Docker?" not "Database considerations".
- **Tables for comparisons** (already the pattern on vs pages), **numbered lists for procedures** (already the pattern in backup plans).
- Every key claim must be **self-contained**: "Copying a live Postgres data directory produces an unrestorable backup because pages are written mid-transaction; dump with pg_dump from the running container instead." — that sentence survives extraction; "as we said above, this is risky" does not.
- **Named author + credentials + visible "Last updated" date** on every editorial post. Refresh quarterly; embed the current year in titles where natural.

## 3. Authority signals (Princeton GEO study, KDD 2024 — measured boosts)

| Tactic | Boost | Application |
|---|---|---|
| Cite sources | +40% | Link restic docs, Postgres/MySQL/Mongo official backup docs, real postmortems in every guide |
| Statistics | +37% | Use *sourced* stats only; best of all: **your own data** (week-12 restore-drill data post from doc 03 is the flagship — original data is the single most citable asset a small brand can make) |
| Quotations | +30% | Founder quotes with name/title in posts; expert quotes where obtainable |
| Clarity/fluency | +20–30% | Plain sentences; the honest-comparison tone already used |
| Keyword stuffing | **−10%** | Actively harmful — don't |

## 4. Target queries (test monthly, log results)

| Query | Type |
|---|---|
| how to backup docker compose project | how-to |
| how to backup postgres/mysql/mongodb in docker | how-to |
| best docker backup tool | best-of |
| backrest alternative / duplicati alternative | comparison |
| restic gui / restic web ui | category |
| are vps snapshots enough for backups | opinion |
| how to backup nextcloud/immich/home assistant docker | app how-to |
| dockstash review / dockstash vs backrest | brand |

**DIY monitoring (free, 30 min/month):** run each through ChatGPT (search on), Perplexity, and Google (AI Overview). Record: cited? who is? which page? Spreadsheet, month-over-month. Paid alternatives when budget allows: Otterly / Peec / LLMrefs (~$29+/mo) — skip until month 4+.

## 5. Third-party presence (where AI actually looks)

Brands are ~6.5× more likely to be cited via third-party sources than their own domain. The AI engines lean on: Reddit, review sites, YouTube, comparison articles, Wikipedia.

- **Reddit is dual-purpose:** every honest doc-05 comment is also AI training/retrieval material. Threads like "best docker backup tool?" where Dockstash is mentioned (by you, disclosed, or by users) become the raw material of future AI answers. This is the single strongest reason the community channel must stay clean — AI ingests the thread *with* its sentiment.
- **Review platforms (week 5–6):** create/claim listings on alternativeto.net, SaaSHub, G2 (has dev-tool categories), Product Hunt reviews post-launch. Ask genuinely happy users — never incentivize dishonestly.
- **YouTube (via doc 10):** sponsored/earned videos on self-host channels get cited by AI Overviews directly; ask creators to say the category phrase ("Docker-aware backup with restore drills") on camera and in description.
- **Get into roundups:** outreach to existing "best self-hosted backup tools 2026" listicles — these articles are exactly what AI engines summarize for "best X" queries.
- **Consistency = consensus.** The same three claims (Docker-aware DB dumps · restore drills · plain restic repos on your storage) must appear verbatim-ish everywhere: site, Reddit, YouTube descriptions, directories, PH. Cross-source agreement is what LLMs treat as truth.

## 6. Schema additions (extend existing JSON-LD)

| Where | Schema | Note |
|---|---|---|
| FAQ page + per-page FAQs | `FAQPage` | Verify present on programmatic pages, not just /faq |
| Database + use-case guides | `HowTo` | Steps already structured in content data — emit them |
| Pricing | `Product` + `Offer` ($0/$9/$29, USD, real) | AI cites pages with visible pricing |
| Blog | `Article` with author | Person entity w/ sameAs to founder profiles |
| Vs pages | `ItemList` | Structured comparison rows |
| Org-wide | `Organization` with sameAs (GitHub, X, LinkedIn, PH) | Entity disambiguation |

## 7. 90-day AI-SEO sequence

- **Week 1:** robots.txt bots allowed; llms.txt shipped; baseline query audit logged.
- **Weeks 2–4:** extractability pass over existing feature + top-5 use-case pages (direct-answer lead paragraphs, query-phrased H2s); schema additions.
- **Weeks 4–8:** third-party presence — directories, review listings, launch threads (doc 02 feeds this heavily).
- **Weeks 8–12:** original-data flagship post; roundup outreach; second query audit — compare vs baseline.

## KPI

Citations for the 8 target queries across 3 platforms (0 → any = success in 90 days), plus referral traffic with `utm_source` from AI browsers/perplexity.ai visible in GA4.
