# Community Marketing

The highest-ROI channel for this ICP and this budget. Slow, compounding, free. Goal: become a recognized, helpful presence in Docker/self-host communities so that when backups come up, someone *else* mentions Dockstash.

## Operating principles

1. **90/10 rule** — 9 pure-value contributions for every 1 that mentions the product. Track it.
2. **Always disclose.** "I build Dockstash, so I'm biased, but…" Disclosure converts *better* than stealth because it adds credibility to the technical content around it.
3. **Answer the question first.** Even when Dockstash is the answer, give the manual solution too ("here's the pg_dump one-liner; if you want it automated + restore-tested, that's what I built").
4. **Warm accounts before you need them.** 2+ weeks of genuine history before any promotional post (launch prerequisite, doc 02).
5. **Never post the same text twice.** Communities cross-read; duplicate posts read as spam.

## Community map

| Community | Size/nature | Self-promo rules (verify before posting) | Cadence |
|---|---|---|---|
| r/selfhosted | Core audience; weekly "What are you self-hosting?" threads | Allows dev posts w/ disclosure; limits frequency | 3–4 comments/wk, 1 post/mo max |
| r/docker | Technical Q&A | Strict; educational posts OK, drive-by links removed | 2–3 comments/wk |
| r/homelab | Hardware-lean but backup-anxious | Similar to selfhosted | 2 comments/wk |
| r/devops, r/sysadmin | Ines/Dana personas | Very anti-vendor; comments only, essentially never posts | 1–2 comments/wk |
| r/webhosting | Marco persona | Vendor-wary | Comments only |
| Hacker News | Threads on backups, data-loss postmortems, restic/Kopia releases | Comments always fine w/ disclosure | As threads appear (set alerts) |
| LowEndTalk | VPS-obsessed, agency-adjacent; providers hang out here | Has explicit provider/vendor sections | 1–2/wk |
| Lobsters | Small, technical | `show` tag once; comments otherwise | Occasional |
| Discords: Self-Hosted, Docker community, homelab servers | Real-time help | Per-server rules | Opportunistic |
| Stack Overflow / Server Fault | Evergreen SEO value | Links only when directly answering; disclosure mandatory | 1–2 answers/wk on docker-backup questions |

**Alert setup (do week 1):** F5Bot (free) for keywords `docker backup`, `restic`, `backrest`, `duplicati`, `lost my data`, `dockstash` across Reddit + HN. This turns community work from browsing into responding — 30 min/day, high precision.

## Comment playbook — drafted templates

Personalize every time; these are skeletons, not scripts.

**T1 — "How do I back up my Docker containers?" (the bread-and-butter thread)**

> The main thing to get right: don't back up live database files. If Postgres/MySQL is running, copying the volume gives you a file that may never restore. Dump from the running container instead:
>
> `docker exec <db> pg_dumpall -U postgres > backup.sql`
> (MySQL: `mysqldump --all-databases --single-transaction`; Mongo: `mongodump --oplog`)
>
> Then back up: the dump, your named volumes (app data), docker-compose.yml + .env. Restic is excellent for the transport/storage layer — encrypted, deduplicated, incremental.
>
> And test a restore at least once. A backup you've never restored is a hypothesis.
>
> (Disclosure: I built a tool, Dockstash, that automates exactly this — detection, correct dumps, restic, scheduled restore tests. Free for one project. But the manual route above works fine.)

**T2 — Data-loss postmortem thread (HN or Reddit)**

Empathy first, zero pitch. Share the general lesson (untested backups, live DB copies). Only mention the product if someone asks "what should I use?". These threads are read for years — the restraint is the marketing.

**T3 — "Backrest vs Duplicati vs ...?" comparison thread**

> Used both. Backrest is the better restic frontend — clean UI, solid retention/prune handling, single binary. Duplicati's UI is friendlier for non-restic backends but it has a long history of database-corruption issues worth reading up on before trusting it.
>
> One thing neither does: they back up *paths*, not Docker projects. If a live database is running in a container, both will happily copy the raw data dir. Either add your own pre-backup dump hooks, or use something Docker-aware. (I built Dockstash for exactly that gap — biased, obviously.)

**T4 — "Are VPS provider snapshots enough?"**

> They're better than nothing but they're not backups: same provider (account compromise/billing failure takes both), whole-disk only (can't restore one project or one database), and almost nobody has ever test-restored one. Keep snapshots, but add per-project, off-provider, restore-tested backups for anything you can't lose.

**T5 — restic release/discussion thread**

Pure technical participation — restic tips, repo maintenance, `restic check` vs actual restore testing. Product mention only if directly relevant. Builds the flair/recognition that makes T1–T3 land.

**T6 — Stack Overflow: "how to backup postgres in docker"**

Full correct answer with commands and cron example. Final line: "If you'd rather automate this (plus restore verification), tools exist — including one I built (Dockstash) — but the above is all you strictly need." SO tolerates this format with disclosure.

## Monthly value-post ideas (1/mo per major sub, rotate)

1. "I analyzed the 5 most common Docker backup mistakes from threads in this sub" (link nothing; goldmine of trust)
2. "Restore-drill your backups: a 15-minute monthly ritual" (generic how-to, tool-agnostic)
3. Per-app guide teasers: "The right way to back up Nextcloud/Vaultwarden/Gitea in Docker" — condensed from the site's use-case guides, full guide linked at the end
4. "What I learned running scheduled restore tests for N months" (original data — also feeds doc 04 AI-citation strategy)
5. AMA-style launch retro (numbers, stack, lessons) in r/selfhosted or IH

## Weekly rhythm (~3 hrs/wk)

- **Daily 20 min:** F5Bot alerts → answer 1–2 threads with T1–T5.
- **Weekly 30 min:** r/selfhosted weekly thread + one LowEndTalk or Discord touch.
- **Monthly 60 min:** one value post from the list above.
- **Log everything** in a spreadsheet: date, link, template used, disclosure y/n, upvotes, referral signups (UTM/ref landing). Prune what doesn't convert after 8 weeks.

## Red lines

- No sockpuppets, no vote manipulation, no fake "happy user" accounts — one exposure ends the channel permanently.
- No DM-spamming people who mention backup problems.
- If a mod removes a post: apologize, ask the rule, never repost.
- Don't argue with competitor fans. Concede and move on — audiences remember graciousness.
