# SEO & Content Strategy

The site already has strong SEO infrastructure: SSR marketing pages, sitemap/robots/JSON-LD, hreflang across 7 locales, and three programmatic page families. Strategy: **expand the programmatic families** (cheap, high-intent) + **add an editorial layer** (authority, links, AI citations).

## Existing programmatic surface (build on, don't duplicate)

| Family | Route | Currently has | Expansion target |
|---|---|---|---|
| Competitor pages | `/vs/:slug`, `/alternatives/:slug` | backrest, simplebackups, duplicati | +5–8: Kopia, BorgBackup/Borgmatic, offen/docker-volume-backup, Bacula, UrBackup, Veeam (agent), rsnapshot, provider snapshots (as a "competitor") |
| Per-app use-case guides | `/backup/:entry` | 16 apps (WordPress, Ghost, n8n, Supabase, Nextcloud, Gitea, Plausible, Umami, Directus, Strapi, Appwrite, PocketBase, Matomo, Mattermost, Vaultwarden, Metabase, NocoDB) | +10–15: Immich, Home Assistant, Paperless-ngx, Jellyfin, Bitwarden (official), Uptime Kuma, Grafana, Keycloak, Odoo, Frappe/ERPNext, Penpot, Outline, BookStack, Formbricks, Cal.com |
| Database guides | `/guides/:entry` | 13 engines (postgres, mysql, mariadb, mongodb, redis, valkey, sqlite, clickhouse, elasticsearch, rabbitmq, minio, influxdb, neo4j) | +4–6: CouchDB, Cassandra, TimescaleDB, pgvector-era "postgres with extensions", Meilisearch, Typesense |
| Feature pages | `/continuous-backup`, `/mirror`, `/fleet-agents`, `/backup-monitoring`, `/compare/self-hosted-backup-vs-cloud-backup` | exists | Add: `/restore-drills` (own the term), `/pitr` (point-in-time recovery for Docker) |

Prioritize expansion by search volume × app popularity: **Immich, Home Assistant, Paperless-ngx, Uptime Kuma, Jellyfin** first — they dominate current r/selfhosted mindshare.

## Keyword clusters

### Cluster A — Core commercial (feature pages + homepage)
- `docker backup`, `docker backup tool`, `docker compose backup`, `docker volume backup`, `backup docker containers`
- `restic ui`, `restic gui`, `restic web interface`, `restic docker`
- `vps backup`, `self hosted backup solution`

### Cluster B — Problem/how-to (guides + blog; highest intent-to-education ratio)
- `backup postgres docker`, `backup mysql docker container`, `mongodb backup docker`, `docker backup database`
- `backup nextcloud docker`, `backup [app] docker` — one per use-case page
- `how to test backups`, `verify backup restore`, `restore docker backup`

### Cluster C — Comparison (vs/alternatives pages)
- `backrest alternative`, `duplicati alternative`, `duplicati vs restic`, `backrest vs duplicati`, `kopia vs restic`, `simplebackups alternative`
- `[competitor] docker` variants

### Cluster D — Fear/postmortem (blog; link-magnet + AI-citation bait)
- `docker volume corrupted`, `postgres backup corrupt`, `backup won't restore`, `database backup best practices`

## Title/meta templates

- Use-case: `How to Back Up {App} in Docker (Database + Volumes + Config) — 2026 Guide` / meta: `{App} runs {DB} in Docker — copying the volume corrupts it. The correct dump-first backup plan, with restore verification.`
- Guide: `How to Back Up {Engine} in Docker the Right Way ({Year})`
- Vs: `Dockstash vs {Competitor}: Honest Comparison ({Year})`
- Alternatives: `{Competitor} Alternatives for Docker Backups ({Year})`
- Embed the current year and keep a visible "Last updated" date — refresh quarterly (recency is weighted by both Google and AI engines).

## Editorial layer (blog — 1 post/week, weeks 1–12)

| Wk | Post | Cluster | Notes |
|---|---|---|---|
| 1 | The 5 ways Docker backups silently fail | D | Cornerstone; every other post links to it |
| 2 | Why you must never copy a live database file (with reproduction) | D/B | Show actual corruption in a demo — screenshots/asciinema |
| 3 | Launch retro with real numbers | — | From doc 02; IH/HN-friendly |
| 4 | Restore drills: backups aren't real until restored | A | Supports new `/restore-drills` page |
| 5 | Complete guide: backing up docker-compose projects (tool-agnostic) | B | The "skyscraper" — longest, most linkable |
| 6 | VPS provider snapshots are not backups | D | Community-tested angle (doc 05 T4) |
| 7 | Backrest vs Duplicati vs Kopia vs Dockstash: the honest matrix | C | Balanced = citable |
| 8 | PITR for Docker apps, explained | A | Pro-tier feature marketing |
| 9 | How we back up Dockstash itself (self-backup architecture) | trust | `docs/self-backup.en.md` exists — adapt it |
| 10 | Anatomy of a restore drill report | A | Product-led, screenshots |
| 11 | Backing up a multi-VPS fleet from one dashboard | A | Business-tier; agency angle |
| 12 | Original data post: what N restore drills taught us about backup failure rates | D | Only with real data; the AI-citation flagship (doc 04) |

Every post: named author + bio, "Last updated" date, internal links (post → relevant guide page → pricing), one CTA max.

## Internal linking rules

- Every use-case page → its database guide(s) → `/restore-drills` → pricing. (Use-case pages already compose guide slugs — verify links render.)
- Blog posts link down into programmatic pages, never only to homepage.
- Hub pages: `/guides` and `/alternatives` indexes link every child (crawl depth ≤ 3 from home).

## Link acquisition (modest, white-hat)

1. **Directories (week 4–5, free):** awesome-selfhosted (PR against repo — read contribution rules; free tier likely required), alternativeto.net (create listing; ask early users for reviews), r/selfhosted wiki, Docker Hub description links, SaaSHub, StackShare, ToolsForDevs-class lists.
2. **The skyscraper (week 5 post):** outreach to 10–20 pages currently linking to older docker-backup guides ("we cover the DB-dump problem they miss").
3. **Guest/expert quotes:** respond to HARO/Featured-class requests on backup/data-loss topics — founder quotes with title, links follow.
4. **Original-data post (week 12)** — pitch to newsletters (selfh.st, Console.dev) as a story, not an ad.

## Technical hygiene checklist (once, week 1)

- [ ] `robots.txt` allows GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot (doc 04)
- [ ] GSC + Bing Webmaster verified, sitemaps submitted
- [ ] All programmatic pages in sitemap with correct lastmod
- [ ] hreflang parity spot-checked (7 locales already built)
- [ ] Core Web Vitals pass on marketing routes (SSR should make this easy)
- [ ] JSON-LD validates: Organization, Product+Offer (with real $0/$9/$29 prices), FAQPage, Article on blog, HowTo on guides

## KPIs (doc 11 owns the dashboard)

- Indexed pages, impressions/clicks per family (GSC), signups attributed to organic (GA4), rankings for 10 tracked terms (`docker backup`, `backup postgres docker`, `backrest alternative`, …). Expect meaningful movement at weeks 8–16, not 2.
