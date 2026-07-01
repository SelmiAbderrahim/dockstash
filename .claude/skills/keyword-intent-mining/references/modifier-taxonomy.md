# Buyer-Intent Modifier Taxonomy

The full modifier reference for Phase 1 keyword intent mining. Multiply each core category noun by these modifiers to generate hundreds of candidate BOFU queries. Modifiers are grouped by intent level, ordered from closest-to-transaction (Purchase/Action) to context-only (Local).

Examples use Dockstash (one-click Restic-based Docker backup; ICP = solo devs, indie hackers, small teams, agencies on Docker Compose; competitors = Backrest, restic-cron DIY, SimpleBackups, Duplicati). Core category seeds: `docker backup`, `container backup`, `restic backup`, `docker volume backup`, `docker compose backup`, `database backup`.

---

## Contents
- Purchase / Action (highest intent)
- Comparison
- Evaluative / Category
- Pricing / Financial
- Local / Proximity
- How to build the modifier grid
- SaaS vs local-service applicability

---

## Purchase / Action (highest intent)

The searcher has decided to act and is looking for the mechanism. Prioritize these — they sit closest to the transaction.

| Modifier | Pattern | Dockstash example |
|----------|---------|-------------------|
| buy | "buy [X]" | "buy docker backup tool" |
| order online | "order [X] online" | (weak for SaaS) |
| sign up | "[X] sign up" | "docker backup tool sign up" |
| get started | "get started with [X]" | "get started with restic backups" |
| download | "download [X]" | "download docker backup tool" |
| try / free trial | "try [X]", "[X] free trial" | "try dockstash free" |
| schedule | "schedule [X]" | "schedule docker backups" |
| set up / setup | "set up [X]" | "set up automated docker backups" |
| install | "install [X]" | "install docker backup tool" |
| start | "start [X]ing" | "start backing up docker volumes" |
| automate | "automate [X]" | "automate docker compose backups" |

Notes: `install` and `setup` straddle Purchase and Evaluative — a searcher installing your tool has already chosen it, but "how to set up backups" can be informational. Score by whether the product name or a category-buy is implied.

---

## Comparison

The searcher is choosing between named options — extremely high intent because they are actively evaluating a purchase. Every competitor name is a modifier.

| Modifier | Pattern | Dockstash example |
|----------|---------|-------------------|
| X vs Y | "[X] vs [Y]" | "dockstash vs backrest" |
| alternatives | "[X] alternatives", "[competitor] alternatives" | "simplebackups alternatives" |
| competitors | "[X] competitors" | "duplicati competitors" |
| X or Y | "[X] or [Y]" | "restic or duplicati for docker" |
| compared to | "[X] compared to [Y]" | "dockstash compared to restic-cron" |
| like X | "tools like [X]", "apps like [X]" | "tools like backrest" |
| replace / switch from | "replace [competitor]", "switch from [competitor]" | "replace restic cron script" |
| better than | "better than [competitor]" | "better than manual restic" |

Notes: seed the Comparison group with (a) your product vs each competitor, (b) each competitor's "alternatives" (buyers searching a competitor's weakness), and (c) competitor-vs-competitor pairs where you can insert yourself as the third option. See the competitor-alternatives skill for page formats.

---

## Evaluative / Category

The searcher wants the best option in a category but hasn't committed to a name yet — strong mid-BOFU.

| Modifier | Pattern | Dockstash example |
|----------|---------|-------------------|
| best | "best [X]" | "best docker backup tool" |
| top | "top [X]", "top 5 [X]" | "top docker backup solutions" |
| X software / tool / app / service / platform | "[X] software" | "container backup software" |
| X for [use-case] | "[X] for [audience/use-case]" | "backup tool for docker compose", "docker backup for agencies" |
| reliable / secure / automated X | "[adjective] [X]" | "automated docker backup", "secure restic backup" |
| easy / simple X | "easy [X]", "simple [X]" | "simple docker backup tool" |
| self-hosted / managed X | "self-hosted [X]", "managed [X]" | "self-hosted docker backup" |
| open source X | "open source [X]" | "open source docker backup" |
| recommended X | "recommended [X]", "[X] reddit" | "best docker backup reddit" |

Notes: `[X] for [use-case]` is a keyword multiplier on its own — cross every category noun with every ICP segment and use-case (solo dev, agency, homelab, production, self-hosted, offsite). `[X] reddit` and `[X] reviews` route to parasite-seo placements.

---

## Pricing / Financial

The searcher is validating affordability — they are close to buying and checking the number. Strong BOFU.

| Modifier | Pattern | Dockstash example |
|----------|---------|-------------------|
| pricing | "[X] pricing" | "docker backup tool pricing" |
| cost / how much | "[X] cost", "how much is [X]" | "how much does dockstash cost" |
| cheap / affordable / budget | "cheap [X]", "affordable [X]" | "cheap docker backup service" |
| free / free tier | "free [X]", "[X] free tier" | "free docker backup tool" |
| discount / coupon / promo | "[X] discount", "[X] coupon code" | "dockstash discount" |
| worth it | "is [X] worth it" | "is dockstash worth it" |
| plans | "[X] plans" | "docker backup pricing plans" |

Notes: "free [X]" is dual-intent — some searchers want free forever (poor fit for paid SaaS), others want a free trial before buying (good fit). Score with the product-fit gate. Pricing pages should surface visible numbers; AI search and buyers both reward transparency (see ai-seo).

---

## Local / Proximity

Only relevant for physical products or local services. Included for completeness; weak for a globally-sold dev tool like Dockstash.

| Modifier | Pattern | Example (local service) |
|----------|---------|-------------------------|
| near me | "[X] near me" | "data recovery near me" |
| in [city] | "[X] in [city]" | "managed backups in austin" |
| emergency / same-day | "emergency [X]", "same-day [X]" | "emergency data recovery" |
| local | "local [X]" | "local IT backup service" |

Notes: for SaaS, skip Local unless you sell a regional/onsite service tier. If Dockstash later offered "agency onsite migration," Local would activate.

---

## How to build the modifier grid

1. List core category nouns down the rows.
2. List the five intent groups across the columns.
3. Fill every cell with the applicable modifiers for that noun.
4. Expand each cell into concrete queries.
5. Dedupe and pass the full list to the intent-scoring sheet (SKILL.md Step 4).

A 6-noun × 5-group grid, expanded, routinely produces 200-400 seed queries before any keyword tool is opened.

---

## SaaS vs local-service applicability

| Intent group | B2B SaaS / dev tool | Local service |
|--------------|:-------------------:|:-------------:|
| Purchase / Action | High | High |
| Comparison | Very high | Medium |
| Evaluative / Category | High | High |
| Pricing / Financial | High | Medium |
| Local / Proximity | Low (skip) | Very high |

For Dockstash, prioritize Comparison, Purchase/Action, Evaluative, and Pricing; deprioritize Local.
