# Paid Ads

Paid is an **accelerant, not the engine** at this budget and for this ad-averse ICP. Start week 5 (post-launch, funnel instrumented), only on high-intent search. Hard rule: **any channel whose CAC exceeds 3× the monthly plan price after $150 spent gets paused.** (Pro $9 → pause above ~$27 CAC unless annual/Business mix justifies more; blended target ≤ $30.)

## Budget split at $500/mo

| Channel | $/mo | Role |
|---|---|---|
| Google Search | 250–300 | High-intent capture — people already searching for the solution |
| Reddit ads | 100 | Audience match test (months 2–3, kill fast) |
| Newsletter sponsorships | 100–150 | Trust-borrowing; see doc 10 for outlets |

Skip entirely at this budget: LinkedIn (CPCs $8–15, wrong stage), Meta (wrong audience), X ads (poor B2B-dev performance), display/retargeting (traffic too small to matter yet).

## Google Search

### Campaign structure

| Campaign | Ad groups | Daily budget |
|---|---|---|
| 1. Core intent | "docker backup", "restic ui" | $5–6 |
| 2. Competitor | "backrest", "duplicati", "simplebackups" | $2–3 |
| 3. Problem/long-tail (phrase) | "backup postgres docker" etc. | $2 |

Settings: exact + phrase match only (no broad), search network only (no partners/display), start manual CPC or Max Clicks w/ $2 cap, geo: US/CA/UK/EU/AU or wherever billing works, conversion = `sign_up` event (import from GA4, doc 11).

### Keywords

**Core:** `[docker backup]`, `[docker backup tool]`, `"docker compose backup"`, `"docker volume backup"`, `[restic ui]`, `[restic gui]`, `"restic web interface"`, `"self hosted backup"` (watch intent), `"vps backup solution"`

**Competitor:** `[backrest alternative]`, `"backrest docker"`, `[duplicati alternative]`, `"duplicati docker"`, `[simplebackups alternative]` — competitor-brand clicks are cheap and high-converting; the honest vs pages are the perfect landing.

**Problem:** `"backup postgres docker"`, `"backup mysql docker"`, `"mongodb backup docker"`, `"backup nextcloud docker"` → land on matching guide page, not homepage.

**Negatives (seed list, grow weekly from search-terms report):** `free download`, `crack`, `tutorial pdf`, `windows`, `synology`, `nas` (unless supported), `iphone`, `android`, `photo`, `whatsapp`, `job`, `salary`, `course`, `udemy`, `aws backup` (AWS-native intent), `kubernetes velero` (wrong stack), `veeam` alone (enterprise Windows intent — keep `veeam docker` only if it converts).

### RSA asset set (15 headlines ≤30 chars, 4 descriptions ≤90 chars)

Headlines:
1. `Docker Backups Done Right`
2. `Backups That Prove Restore`
3. `Back Up Any Docker Project`
4. `DB Dumps, Not Corrupt Copies`
5. `Restic Power, One-Click UI`
6. `Scheduled Restore Drills`
7. `Free For Your First Project`
8. `Postgres & MySQL Dumped Right`
9. `Your Storage, Your Keys`
10. `Compose-Aware Backup Plans`
11. `From $9/mo — 10 Projects`
12. `Stop Trusting Untested Backups`
13. `Multi-VPS Backup Dashboard`
14. `Encrypted, Deduped, Verified`
15. `Set Up In Under 10 Minutes`

Descriptions:
1. `Dockstash detects your compose project, dumps databases from running containers, and verifies restores.`
2. `Most Docker backups copy live DB files that won't restore. Ours dump correctly — and prove it with drills.`
3. `Built on restic: encrypted, deduplicated, incremental. Plain restic repos on your own storage. Free tier.`
4. `One project free forever. 10 projects $9/mo. Unlimited + multi-VPS fleet $29/mo. No card to start.`

Pin nothing initially; let Google optimize. Sitelinks: Pricing, vs Backrest, Security, How Restore Drills Work. Callouts: `Free tier` · `No card required` · `Plain restic repos` · `Encrypted`.

Landing pages: core → homepage; competitor → matching `/vs/:slug`; problem → matching `/backup/:entry` or `/guides/:entry`. Always with UTM (doc 11).

## Reddit Ads ($100/mo test, months 2–3)

- Targeting: subreddit list — r/selfhosted, r/docker, r/homelab, r/devops (interest targeting is too loose; community targeting only).
- Format: promoted text/link post. **Write like a post, not an ad** — Reddit users punish ad-speak with comments (keep comments ON; turning them off is itself a red flag, and good replies convert).

**Variant A (fear/education):**
> Title: `Your Docker backup script is probably copying live database files. That backup won't restore.`
> Body: `Dockstash detects your compose project, dumps Postgres/MySQL/Mongo from the running container, backs everything up with restic to your own storage, then runs scheduled restore drills to prove it works. Free for one project — no card.`

**Variant B (category/honest):**
> Title: `Backrest is a great restic UI. It just isn't Docker-aware.`
> Body: `If your containers run databases, path-based backup tools copy live data files. Dockstash dumps them correctly from the running container and restore-tests the result on a schedule. Free tier: one project, daily, 7-day retention.`

Kill criteria: <0.3% CTR after $50, or zero signups after $100.

## Newsletter sponsorships ($100–150/mo, one at a time)

See doc 10 for outlet list and outreach template. Measure with dedicated UTM + optional `?ref=` code; judge on 2-week window (newsletters have long tails).

## Weekly ops (30 min)

1. Search-terms report → add negatives, harvest converting terms into exact match.
2. Check CAC per campaign vs the 3× rule → pause losers.
3. Shift budget toward whatever produced signups (not clicks).
4. Monthly: swap the 2 worst RSA headlines for new variants (rotate fear/proof/price angles).

## Scaling triggers

- Blended paid CAC < $20 for 2 consecutive months → raise Google budget 50%.
- A guide page converts paid traffic > 3% → build more ad groups on that cluster.
- Business-tier signups from ads → consider LinkedIn retargeting *later* (month 6+, needs pixel traffic volume).
