# Positioning & ICP

## Product truth (the raw material)

Dockstash is a one-click backup orchestrator for Docker projects. It wraps restic (dedup, encryption, compression, incremental snapshots) and adds what restic alone doesn't do:

1. **Docker-awareness** — auto-detects Postgres/MySQL/MariaDB/Mongo (plus Redis, ClickHouse, Elasticsearch, and more via adapters) and dumps them from the *running container* (`pg_dump`, `mysqldump --single-transaction`, `mongodump --oplog`). It never copies live database files from disk — the #1 way homemade Docker backups silently fail.
2. **Project detection** — scans `docker-compose.yml`, `.env`, volumes, and Traefik/nginx config, and proposes a complete backup plan per project.
3. **Restore drills** — scheduled restore-to-scratch + verification, so a backup is *proven* restorable, not assumed.
4. **Fleet agents** — one dashboard for backups across many VPS hosts (Business tier).
5. **Scheduling, retention, PITR, mirroring, email alerts** — plan-gated.

## Pricing (source: `server/src/modules/billing/plans.ts`)

| | Free | Pro — $9/mo | Business — $29/mo |
|---|---|---|---|
| Projects | 1 | 10 | Unlimited |
| Backup frequency | Daily | Continuous | Any cron |
| Retention | 7 days | 30 days | 90 days |
| Schedules / email alerts / restore drills / PITR | — | ✓ | ✓ |
| Multi-VPS fleet / mirror | — | — | ✓ |

Yearly = 10× monthly ("2 months free"). Free tier is the acquisition engine — it delivers real value (one project, daily, off-site) and creates the upgrade path the moment someone adds a second project.

## The core insight every message hangs on

> **People think they have backups. They have copies of files that won't restore.**

A live Postgres data directory copied mid-write is corrupt. Cron + tar "works" until the day you need it. Fear of *silent* backup failure is the emotional driver; restore drills are the rational proof. Every headline, ad, and post is a variation of this.

## One-liners (pick per context)

- **Default:** "One-click backups for any Docker project — databases dumped correctly, restores proven by scheduled drills."
- **Technical (HN/Reddit):** "Docker-aware restic orchestrator: detects your compose project, dumps Postgres/MySQL/Mongo from the running container, and runs scheduled restore drills to prove backups actually restore."
- **Fear-forward (ads, social):** "Your Docker backup probably won't restore. Dockstash dumps databases the right way and proves it with restore drills."
- **Agency (cold email):** "Back up every client's Docker stack from one dashboard — correct database dumps, restore proof you can show clients, $29/mo for unlimited projects."

## Elevator pitch (30s)

"Everyone running Docker on a VPS has a backup script — and most of them are quietly broken, because they copy live database files instead of dumping them. Dockstash detects what's in your Docker project — databases, volumes, compose config, reverse-proxy config — builds the correct backup plan, runs it on restic with encryption and dedup, and then actually *restores* it on a schedule to prove it works. Free for one project; $9/month for ten."

## ICP personas

### 1. Self-hoster / homelabber ("Sam")
- **Runs:** Nextcloud, Vaultwarden, Gitea, *arr stack, Home Assistant on 1–2 boxes.
- **Watering holes:** r/selfhosted, r/homelab, selfh.st newsletter, awesome-selfhosted, Mastodon/fediverse, YouTube (self-host channels).
- **Pain:** knows they *should* back up; current state is a half-finished script or nothing. Data is irreplaceable (family photos in Nextcloud, password vault).
- **Objections:** "Why pay when Backrest/Duplicati is free?" · "Is my data private?" · "What if the SaaS dies?"
- **Answers:** Free tier covers one project forever. Restic repos are encrypted with *your* key on *your* storage — Dockstash orchestrates, it doesn't hold your data. Repos are standard restic — restorable with plain restic CLI even without Dockstash. Backrest is a fine restic UI but isn't Docker-aware: it copies your live Postgres files.
- **Plan fit:** Free → Pro.

### 2. Indie dev / solo SaaS founder ("Ines")
- **Runs:** 2–6 side projects / small SaaS on Hetzner/DO droplets, docker-compose everywhere.
- **Watering holes:** HN, Indie Hackers, X/Twitter build-in-public, r/devops, r/docker.
- **Pain:** paying customers on a single droplet with no tested backup. A restore failure = business over. No time to babysit backup infra.
- **Objections:** "I'll just write a script" · "I use my host's VPS snapshots."
- **Answers:** The script never gets the DB dump + verification right, and VPS snapshots are whole-disk, same-provider, rarely tested, and useless for restoring *one* project or migrating hosts. PITR on Pro means a bad deploy or fat-fingered DELETE is recoverable to the minute.
- **Plan fit:** Pro ($9 is a no-brainer against revenue risk).

### 3. Agency / freelancer hosting client sites ("Marco")
- **Runs:** 10–50 client sites (WordPress, Ghost, custom) across several VPSes.
- **Watering holes:** LowEndTalk, r/webhosting, r/sysadmin, WordPress/hosting Facebook groups, LinkedIn.
- **Pain:** backups are a liability and an SLA line-item; per-site backup SaaS pricing eats margin; no unified view across servers.
- **Objections:** "I have WHM/plugin backups" · "Another dashboard to manage."
- **Answers:** Plugin backups don't cover the whole compose stack (DB + volumes + config + proxy), and don't prove restorability. Business tier: unlimited projects, fleet view across all VPSes, mirror to second storage, 90-day retention — $29 flat, not per-site. Restore-drill reports become a client-facing deliverable ("your backup was restore-tested on the 1st").
- **Plan fit:** Business. Primary cold-outreach target (doc 09).

### 4. Small DevOps team ("Dana")
- **Runs:** staging + internal tooling + a few production services on VMs with compose (too small for k8s/Velero).
- **Watering holes:** r/devops, r/sysadmin, HN, Console.dev newsletter, LinkedIn.
- **Pain:** compliance/audit needs backup evidence; nobody owns the backup script; Velero-class tooling is overkill for compose.
- **Objections:** "We'd self-host the tool" · "Security review needed."
- **Answers:** Security model is documented and public (encrypted-at-rest secrets, SSH host-key pinning, argv-only exec, existing `docs/security-model.en.md` — link it). Audit trail + drill reports = audit evidence.
- **Plan fit:** Business.

## Messaging hierarchy

1. **Category:** Docker backup (not "backup software" — own the niche).
2. **Primary differentiator:** correct database dumps from running containers (competitors back up *paths*).
3. **Proof differentiator:** scheduled restore drills — "a backup isn't real until it's restored."
4. **Trust base:** built on restic (battle-tested, open engine; your repo stays plain restic), encrypted, your storage.
5. **Commercial:** free for one project; $9 for ten; $29 for unlimited + fleet.

Use in this order everywhere: niche → correctness → proof → trust → price.

## Competitor positioning angles (keep honest — matches `competitors.ts`)

| Competitor | Concede | Win on |
|---|---|---|
| **Backrest** (free restic UI) | Genuinely free, open-source, great generic restic frontend | Not Docker-aware — backs up paths, copies live DB files; no adapters, no restore drills, no fleet |
| **Duplicati** (free backup app) | Free, huge backend list, mature UI | Same path-based blindness to Docker; long-standing database-corruption reputation; no drills |
| **SimpleBackups** (SaaS) | Polished SaaS, broad integrations | Price (per-server/per-DB pricing vs $29 unlimited), Docker-project awareness, restore drills |
| **DIY cron + script** | Free, full control | The script is the product: dump correctness, retention, encryption, alerting, drills — all the parts people skip |
| **VPS provider snapshots** | Zero effort | Whole-disk, same-provider blast radius, no per-project restore, never tested |

Rule: name competitor strengths first, then the gap. One-sided comparisons read as ads and get discounted by both humans and AI answer engines.

## Words to use / avoid

- **Use:** restore drill, proven restorable, dumped from the running container, compose-aware, your storage / your keys, plain restic repo, PITR.
- **Avoid:** "military-grade", "blazing fast", "never lose data again" (absolute claims), "set and forget" (we *test* — that's the point), any uncited stat.
