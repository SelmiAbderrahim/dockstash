# Partnerships, Sponsorships, Directories & Referrals

## 1. Directory & listing sweep (weeks 4–5, free, ~4 hrs one-off)

| Listing | Notes |
|---|---|
| **awesome-selfhosted** (GitHub) | Read contribution rules first — typically requires free tier/self-host component; PR with neutral one-line description |
| **alternativeto.net** | Create listing; set "alternative to" Backrest, Duplicati, SimpleBackups; ask 3–5 real users for reviews |
| **SaaSHub, StackShare, LibHunt** | Standard listings |
| **Product Hunt** | Post-launch: keep page updated, gather reviews |
| **G2 / Capterra** | Dev-tools/backup categories; matters for Dana/Marco procurement searches; ask happy paid users (never incentivize dishonestly) |
| **Docker Hub** | The `selmiabderrahim/agent` image description = free ad read by exactly the right people: full description, links, correct category tags |
| **selfh.st apps index / r/selfhosted wiki** | Submit where criteria allow |

These listings are also AI-citation substrate (doc 04) — keep descriptions consistent: *Docker-aware DB dumps · restore drills · plain restic repos on your storage*.

## 2. YouTube creator sponsorships (the big swing at this budget)

Self-host YouTube (channels in the Awesome-Open-Source / homelab / self-host niche, 20k–200k subs) is where Sam and Ines actually discover tools. Mid-tier channels charge roughly $200–800 per dedicated/integrated video — one/quarter fits the budget if ads are dialed down that month (README budget note).

**Selection:** channel covers Docker/self-hosting; audience comments are technical; creator does honest reviews (their credibility is what you're buying). Ask for: audience geography + CTR on past sponsor links.

**Outreach email:**
> Subject: `sponsor slot — Docker backup tool (restic-based)`
>
> Hi {Name} — I run Dockstash (dockstash.com): Docker-aware backups. It detects a compose project, dumps databases from the *running container* (instead of copying live DB files — the classic homemade-backup failure), ships everything via restic to the user's own storage, then runs scheduled restore drills to prove restores work.
>
> I'd like to sponsor an integrated segment or dedicated video. Honest-review format welcome — including what the free/self-hosted alternatives (Backrest etc.) do well; the product holds up to fair comparison, and your audience trusts you *because* you do that.
>
> Free tier exists so viewers can try without paying. What are your sponsorship rates and formats?

**Brief for the creator (attach):** the 3 claims + demo path (signup → detection → backup → drill in 10 min) + asked-for phrasing "Docker-aware backup with restore drills" in the description + UTM/ref link + discount code (e.g. `channel name → 20% off first year`) for attribution.

**Earned (free) track:** offer early access + founder Q&A to smaller channels (5k–20k) that do "I tried X" videos — no payment, no editorial control, just access. Two or three of these often outperform one paid slot.

## 3. Newsletter sponsorships (from doc 06 budget: $100–150/mo)

Targets in ascending price: **selfh.st** (self-host weekly), niche homelab newsletters, **Console.dev** (devtools, pricier — try month 3+ or when budget at $1k), TLDR DevOps-class if ever scaled. One at a time, dedicated UTM, judge on signups within 2 weeks, rebook only winners.

**Ad copy (short-slot format):**
> **Dockstash — Docker backups that prove they restore.** Detects your compose project, dumps Postgres/MySQL/Mongo correctly from running containers, backs up via restic to your storage, and runs scheduled restore drills. Free for one project.

## 4. Referral program (build month 2–3, simple version)

Ponytail rule applies: no referral platform purchase at this scale — a `?ref=` code + manual monthly credit is enough to start.

- **Offer (double-sided, credits not cash):** referrer gets 1 month of their current paid plan free per converted paid referral (cap 12/yr); referee gets 20% off first year. Credits avoid payout tax/fraud complexity and Polar handles discount codes.
- **Mechanics v1:** unique `?ref={userId-slug}` link on dashboard settings page; landing sets cookie (30d); on paid conversion, both sides credited — manual review monthly until volume demands automation.
- **Surface it:** in the monthly digest email (doc 08), post-drill-success screen ("backup verified — know someone whose isn't?"), and churned-user win-back.
- **Anti-abuse:** credit only on *paid* conversion after first invoice settles; same-card/same-IP self-referral rejected.

**Agency variant (doc 09 synergy):** agencies referring other agencies get 2 months of Business per conversion — agencies know agencies.

## 5. Integration/content partnerships (opportunistic, months 3+)

- **App vendors:** the 16+ use-case guides (WordPress, n8n, Supabase, Nextcloud…) are co-marketing bait — tweet at / email the vendor's DevRel when a guide ships ("we wrote the definitive backup guide for X") — they often share, which is a high-authority backlink + AI-consensus signal.
- **VPS providers / panels:** later play — a "backups" recommendation in a provider's docs or marketplace is a durable channel; approach after there's traction proof (month 4+).
- **restic ecosystem:** contribute meaningfully (docs, issues) — being a good citizen in the upstream community is noticed by exactly the buyers who ask "is this a leech or a contributor?".

## KPI

Signups per listing/sponsor/ref-code UTM (doc 11); referral share of new paid; a sponsorship pays back when attributable first-year revenue ≥ 2× its cost.
