# Product Marketing Context

*Last updated: 2026-07-01*

## Product Overview
**One-liner:** Dockstash makes backing up any Docker project one click — automatic detection, encrypted off-site snapshots, and one-click restore.
**What it does:** Dockstash is a self-hostable backup orchestrator that runs on your production VPS. It auto-scans your Docker Compose projects, detects every backup-able layer (volumes/bind mounts, databases, compose + `.env` config, reverse-proxy config), and dumps databases the *correct* way (`pg_dumpall`, `mysqldump --single-transaction`, `mongodump --oplog` inside the running container — never a live file copy) before backing up with **Restic** (encryption, dedup, incremental snapshots) over SSH to a storage VPS. Scheduled backups, one-click restore with typed-confirm safety, automated restore-drill verification, and live-streaming logs. Built on the MERN stack with a Shadcn UI.
**Product category:** Backup & disaster recovery / DevOps tooling / Docker infrastructure
**Product type:** Self-hostable software with a managed freemium tier (open-source Free tier runs without any paid provider; Pro/Business add scale + support)
**Business model:** Freemium, per-project metering, billed via **Polar** (merchant of record — handles VAT/tax):

| Plan | Price | Projects | Retention | Frequency | Extras |
|------|-------|----------|-----------|-----------|--------|
| Free | $0 | 1 | 7 days | daily | community support, self-host default |
| Pro | $X/mo (2 mo free yearly) | 10 | 30 days | hourly | schedules, email alerts |
| Business | $Y/mo | unlimited | 90 days | any cron | priority support, multi-VPS |

## Target Audience
**Target companies:** Solo developers / indie hackers self-hosting on a VPS, small dev teams (2–15) running Docker Compose in prod, digital agencies managing many client projects, self-hosted-software enthusiasts (r/selfhosted).
**Decision-makers:** The developer/founder who owns the server; agency technical leads; small-team platform/DevOps engineers.
**Primary use case:** Get reliable, verified, off-site backups of a Docker Compose production stack without writing restic/cron scripts or risking corrupt database dumps.
**Jobs to be done:**
- "I need real backups of my Dockerized app + database that I can actually restore."
- "I don't want to hand-roll restic + cron + pg_dump scripts and hope they work."
- "I need to know my backups aren't silently failing."
**Use cases:**
- Back up a WordPress/Ghost/n8n/Supabase Docker stack (app files + DB + config) off-site
- Replace a fragile homemade `restic` + `cron` + `pg_dump` script
- Agencies backing up many client Docker projects from one dashboard, per-project
- Prove restorability with automated restore drills before disaster strikes

## Personas

| Persona | Role | Cares about | Challenge | Value we promise |
|---------|------|-------------|-----------|------------------|
| Selfhost Sam | Indie hacker on a Hetzner/DO VPS | Data safety, low cost, no lock-in | Cron+restic scripts are fragile; unsure backups restore | One-click, auto-detected, verified backups on his own storage |
| Team Lead Tariq | Lead dev, 5-person team, Docker Compose in prod | Correct DB dumps, off-site, alerts on failure | Live-file DB backups don't restore; failures go unnoticed | Docker-aware dumps + dead-man's-switch alerting |
| Agency Alex | Technical lead at a dev agency | Many projects, per-client, efficiency | Manual restic setup per client server | One dashboard, per-project billing, multi-VPS agents |
| Cautious Casey | Solo founder burned by data loss | Restore actually works, encrypted secrets | "Is my backup real?" anxiety | Automated restore-drill diff + encrypted-at-rest secrets |

## Problems & Pain Points
**Core problem:** Backing up a Dockerized production stack correctly is hard and easy to get silently wrong — most homemade tools back up live database files that won't restore, and nobody notices until recovery day.
**Why alternatives fall short:**
- **Manual restic + cron scripts (DIY):** Fragile, no UI, easy to misconfigure, no verification, often back up live DB files (torn/unrestorable dumps).
- **Backrest (open-source restic UI):** Great generic restic scheduler/UI, but **not Docker-aware** — no automatic DB-dump adapters, no compose/reverse-proxy detection, no per-project billing or managed alerting.
- **Duplicati:** History of reliability/restore issues; not Docker-native.
- **Cloud backup SaaS (e.g. SimpleBackups):** Recurring cost, your data on their infrastructure, less control/sovereignty than backing up to your own storage VPS.
- **`docker exec` by hand:** No scheduling, no retention, no encryption discipline, no restore safety.
**What it costs them:** Hours building/maintaining backup scripts; the catastrophic tail risk of an unrestorable backup discovered during an outage; silent-stall failures where nothing errors but nothing runs.
**Emotional tension:** The quiet dread of "I *think* I have backups"; fear of the restore that doesn't work; guilt over data loss that was preventable.

## Competitive Landscape
**Direct:** Backrest (open-source restic UI — closest; not Docker-aware), Duplicati (GUI backup — reliability concerns).
**DIY substitute:** hand-written `restic` + `node-cron`/`cron` + `pg_dump` scripts (the real incumbent for most of the ICP).
**Cloud SaaS:** SimpleBackups, SnapShooter, and similar managed backup services (cost + data-sovereignty tradeoff).
**Indirect / do-nothing:** provider volume snapshots (whole-disk, not app/DB-consistent), "I'll set it up later," no backups at all.

## Differentiation
**Key differentiators:**
- **Docker-aware DB adapters** — auto-detects Postgres/MySQL/MariaDB/Mongo and dumps consistently (`pg_dumpall`, `mysqldump --single-transaction`, `mongodump --oplog`) from the running container, then restics the dump. Never a live-file copy.
- **Automatic project scan** — detects volumes, databases, compose/`.env`, and reverse-proxy (Traefik/nginx) config; the user confirms checkboxes instead of authoring a config file.
- **Verified backups** — scheduled `restic check` + automated **restore-drill diff** (restore latest snapshot to scratch, diff vs source). A green drill is the proof.
- **One-click restore with safety** — typed-confirm, restore-to-new-location default, DB staging before overwrite.
- **Own your storage, no lock-in** — backups go to *your* storage VPS via SSH; standard restic repos, encrypted with your key. Free tier fully self-hostable.
- **Loud failure** — Resend email alerts + dead-man's-switch heartbeat catch silent stalls.
- **Encrypted secrets at rest** — AES-256-GCM; restic password + SSH keys never plaintext; recovery-code escrow.
**How we do it differently:** Backrest and DIY treat backup generically; Dockstash understands your *Docker project* — it knows a Postgres container needs a `pg_dumpall`, not a file copy — and proves the backup restores.
**Why that's better:** The single most common backup failure (unrestorable DB dumps) is designed out; you find out backups work *before* you need them.
**Why customers choose us:** "I want backups I can trust and restore in one click, on my own storage, without writing scripts."

## Objections

| Objection | Response |
|-----------|----------|
| "Why not just use Backrest?" | Backrest is a solid generic restic UI — but it doesn't know your database needs a `pg_dumpall`, doesn't detect your compose stack, and won't drill-test restores. Dockstash is Docker-project-aware. |
| "Why not write my own restic + cron script?" | You can — and maintain it, and hope the DB dumps are consistent, and notice when it silently stops. Dockstash is that script, hardened, verified, and one-click. |
| "Is my data safe with you?" | Free/self-host runs entirely on *your* servers to *your* storage VPS. We never hold your backups. Secrets are AES-256-GCM encrypted; restic repos are encrypted with your key. |
| "What if you shut down?" | Repos are standard Restic. Point `restic` at your storage VPS and restore without us. Config export/import included. Zero lock-in. |
| "How do I know backups actually restore?" | Automated restore-drill diffs the restored data against source on a schedule and surfaces per-project drill status. Untested backup = no backup. |

**Anti-persona:** Enterprises with dedicated backup infrastructure and compliance teams; users not on Docker; people who want a fully-managed "we hold your data" cloud service with zero self-host involvement.

## Switching Dynamics
**Push (away from current):** A restore that failed (or the fear of one); a fragile script that broke on a version bump; a backup that was silently stalled; realizing volume snapshots aren't DB-consistent.
**Pull (toward us):** One-click, auto-detected, verified backups on your own storage; alerts when something fails; honest Shadcn UX.
**Habit (keeps them stuck):** "My cron script works" (until it doesn't); inertia of an existing setup; provider snapshots that feel like enough.
**Anxiety (about switching):** Is it secure enough to hold my SSH key + restic password? Will restore really work? Is a new tool worth the setup?

## Customer Language
**How they describe the problem:**
- "I'm not sure my backups would actually restore."
- "I've got a janky cron + restic script backing up my containers."
- "My pg_dump runs but I've never tested a restore."
- "Backrest is nice but it doesn't understand my database."
**How they describe us:**
- "One-click backups for my Docker stack."
- "It just knew my Postgres needed a dump, not a file copy."
- "Finally something that tells me when a backup fails."
**Words to use:** back up, restore, snapshot, one-click, encrypted, off-site, self-hosted, Docker-aware, verified, restore drill, restic
**Words to avoid:** "cloud backup" (implies we hold your data), "enterprise-grade," "set and forget" (we're honest that verification matters), "sync" (backup ≠ sync)
**Glossary:**

| Term | Meaning |
|------|---------|
| Project | A Docker Compose project at `/var/www/<project>` that Dockstash backs up |
| Adapter | Plugin that knows how to dump/restore a service type (postgres, mysql, mongo) |
| Snapshot | A restic restore point for a project |
| Restore drill | Automated test that restores the latest snapshot to scratch and diffs vs source |
| Storage VPS | Your server that holds the encrypted restic repos (reached over SSH) |
| Agent | Dockstash container running on a production VPS, backing up its projects |

## Brand Voice
**Tone:** Technical, honest, reassuring without overpromising. Developer-first. Safety-conscious (this is people's data).
**Style:** Short sentences. Show the exact command. "You," not "users." Never hype; a backup tool earns trust by being precise, not loud.
**Personality:** Competent, careful, no-nonsense, builder-minded, empathetic to the dread of data loss.

## Proof Points
**Metrics / concrete claims:**
- One-click backup of a full Docker project (files + DB + config) — zero config file authored
- Docker-aware adapters for Postgres, MySQL/MariaDB, MongoDB (consistent dumps)
- Restic-backed: dedup, encryption, incremental snapshots, restore-to-any-point
- Automated restore-drill diff proves restorability per project
- Runs on your own VPS → storage VPS; Free tier needs no paid provider
- AES-256-GCM encrypted secrets; SSH host-key pinning
**Customers:** Early self-hosters, small Docker-Compose teams, agencies (gather logos as base grows).
**Testimonials:**
> "It caught that my nightly dump had been failing for a week." — *[gather real testimonials]*
> "Set up in ten minutes and the restore drill actually passed." — *[gather real testimonials]*
**Value themes:**

| Theme | Proof |
|-------|-------|
| Correctness | Docker-aware consistent DB dumps, never live-file copies |
| Trust | Automated restore drills + loud failure alerts |
| Simplicity | Auto-scan → confirm checkboxes → one-click backup/restore |
| Ownership | Your storage VPS, standard restic repos, no lock-in |
| Security | AES-256-GCM secrets, SSH host-key pinning, encrypted repos |

## Goals
**Business goal:** Establish Dockstash as the Docker-aware backup tool of choice for self-hosters and small teams; grow Free installs → Pro conversions.
**Conversion action:** Install/self-host or start Free → connect storage VPS → first successful backup + passing restore drill → upgrade to Pro for scheduling/alerts/more projects.
**Current metrics:** Early stage — establishing baselines.
