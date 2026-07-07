# Launch Plan

One coordinated launch **week** (calendar weeks 3–4 of the 90-day plan), staggered so each platform gets a native post, not a cross-post.

## Sequence

| Day | Platform | Why this order |
|---|---|---|
| Mon | r/selfhosted | Friendliest audience, feedback hardens the pitch before bigger stages |
| Tue | Hacker News — Show HN | Biggest single-day spike; Tue–Thu mornings (8–10am ET) perform best |
| Wed | r/docker + r/homelab | Ride HN momentum, different framing per sub |
| Thu | Product Hunt | Needs a full free day for hunter engagement (12:01am PT start) |
| Fri | Indie Hackers + Lobsters + X/Mastodon recap | Long-tail + "what we learned" content |

## Pre-launch checklist (complete by end of week 2)

- [ ] Funnel instrumented: signup, first backup, first restore drill, upgrade events firing (doc 11)
- [ ] Onboarding email sequence live (doc 08) — launch traffic must not land in silence
- [ ] Pricing page, FAQ, security page reviewed — HN *will* read the security model; link `docs/security-model.en.md` content prominently
- [ ] Status/roadmap answer prepared for "what if you shut down?" → repos are plain restic; restore works with restic CLI alone
- [ ] Demo path: fresh signup → detected compose project → first backup → restore drill in <10 minutes; record a 60–90s screen capture (no music, terminal + dashboard)
- [ ] Reddit accounts have ≥2 weeks of genuine comment history in target subs (doc 05) — a zero-karma account posting a launch = removed
- [ ] Product Hunt: teaser page up ~1 week early, 5–10 friends primed to try it (real comments, not "Congrats! 🚀")
- [ ] Server capacity: expect 5–20× normal traffic on HN day
- [ ] Founder calendar cleared on HN + PH days — reply speed determines outcome

## Drafted posts

Adjust facts to reality before posting — never post a claim you can't back.

### Hacker News — Show HN

**Title:** `Show HN: Dockstash – Docker-aware backups with scheduled restore drills`

**Body:**

> Hi HN, I built Dockstash after realizing my own "backups" were cron jobs copying live Postgres data directories — files that would never have restored.
>
> Dockstash is an orchestrator around restic. What it adds over a plain restic UI:
>
> - It's Docker-aware: it scans your compose project and dumps databases from the running container (pg_dump, mysqldump --single-transaction, mongodump --oplog) instead of copying live data files. That's the failure mode of most homemade Docker backup scripts.
> - It detects the rest of the project too: volumes, compose file, .env, Traefik/nginx config — and proposes the full backup plan.
> - Restore drills: on a schedule it actually restores the backup to scratch and verifies it. A backup isn't real until it's been restored.
> - Repos are plain restic, encrypted with your key, on your storage (SFTP/SSH). If Dockstash disappears tomorrow, `restic restore` still works.
>
> Free for one project (daily, 7-day retention). Paid tiers add more projects, continuous backups, PITR, and multi-VPS fleet management.
>
> Things I'd love feedback on: the restore-drill design, the adapter approach for database dumps, and what would make you trust (or refuse to trust) a hosted orchestrator with SSH access to your storage.

**HN rules of engagement:** reply to every comment for the first 6–8 hours; concede valid criticism immediately; never ask for upvotes (voting-ring detection kills posts); if it doesn't take off, one repost weeks later with a different angle is acceptable.

### Product Hunt

- **Name:** Dockstash
- **Tagline (≤60 chars):** `Docker backups that prove they restore`
- **Description:** `Dockstash detects your Docker project — databases, volumes, compose config — dumps databases correctly from running containers, backs everything up with restic encryption, and runs scheduled restore drills so you know it actually restores. Free for one project.`
- **First comment (maker):**

> Hey Product Hunt 👋
>
> Every Docker backup horror story is the same: the cron job ran for a year, the restore failed in five minutes. Usually because it copied live database files instead of dumping them.
>
> Dockstash fixes both halves:
> 1. **Correct backups** — it understands Docker. Postgres/MySQL/Mongo get dumped from the running container; volumes, compose files, .env, and proxy config get captured alongside.
> 2. **Proven restores** — scheduled restore drills re-create your project from the backup and verify it. You get proof, not hope.
>
> Under the hood it's restic — encrypted, deduplicated, incremental — on your own storage. Free for one project, $9/mo for ten, $29/mo for unlimited + multi-server fleet.
>
> I'll be here all day — ask me anything, especially the hard questions about trust and security.

- **Gallery:** 5 images — dashboard, detected-project plan, restore-drill report, fleet view, pricing. Plus the 60–90s video.

### r/selfhosted (Monday)

**Title:** `I built a Docker-aware backup tool because my own backups turned out to be unrestorable — free tier for one project`

**Body:**

> Long-time lurker, first product post — mods, hope this is within the rules (happy to delete if not).
>
> Last year I tried restoring a "backed up" compose project and discovered my script had been copying the live MySQL data dir the whole time. Corrupt, unrestorable, a year of cron logs saying "success".
>
> So I built Dockstash. It scans a Docker project and builds the *correct* backup plan: dump each database from inside the running container, capture volumes, compose file, .env, and reverse-proxy config, then ship it all to your own storage via restic (encrypted with your key, plain restic repo — restorable without my tool). The part I'm proudest of: scheduled restore drills that actually restore to scratch and verify, so you find out your backup is broken *before* you need it.
>
> Honest disclosure of alternatives since this sub cares: if you want fully free/self-hosted, Backrest is an excellent restic UI — it's just not Docker-aware (it backs up paths, so live DB files get copied, and there are no restore drills). That gap is why I built this.
>
> Free tier: 1 project, daily backups, 7-day retention, no card. Would genuinely love this community's feedback — especially what would make you trust or not trust it.

### r/docker (Wednesday)

**Title:** `The most common Docker backup mistake (and the tool I built around avoiding it)`

**Body:** lead with 3–4 paragraphs of *pure education*: why copying a live database volume produces corrupt backups, the correct per-engine dump commands (`pg_dumpall`, `mysqldump --single-transaction --routines --triggers`, `mongodump --oplog`), and why restore testing matters. Then one short paragraph: "I built Dockstash to automate exactly this — detection, correct dumps, restic, scheduled restore drills. Free for one project. Link in comments if allowed." Check current sub rules for self-promo before posting; if links are banned, keep it educational and let people find you via profile.

### r/homelab (Wednesday)

Angle: protecting the homelab you spent years building. Shorter, more personal than r/selfhosted; mention Nextcloud/Vaultwarden/Gitea by name (the site has per-app guides for all three — link the relevant guide, not the homepage).

### Indie Hackers (Friday)

**Title:** `Launched a $9/mo dev-tool SaaS this week — numbers and what worked`
Transparent launch-week retro: traffic, signups, conversion, what each platform delivered. IH rewards numbers; this also seeds the build-in-public loop for doc 07.

### Lobsters (Friday)

Only if you have (or can get) an invite. Tag `show`. Same technical body as HN but shorter; Lobsters is even less tolerant of marketing tone.

## Launch-day operations (HN + PH days)

- Hour 0: post → verify link/images → drop link in your own X/Mastodon with "launching today" note.
- Hours 0–8: reply to every comment within ~15 min. Concessions > deflections.
- Log every objection verbatim — objections become FAQ entries, doc 01 answers, and content ideas.
- Watch funnel live (GA4 realtime + signup events) — if traffic converts <1%, the landing hero is wrong; fix same-day.
- Do NOT ship risky deploys on launch days.

## Post-launch (the week after)

- Write "launch retro" post (IH + own blog) with real numbers → this is itself content.
- Personal thank-you email to every launch-week signup (founder, plain-text) asking one question: "what almost stopped you from signing up?"
- Feed objection log into: FAQ page, ad negative-keyword list (06), email sequence tweaks (08).
- Add "featured on" mentions only where legitimately true.
