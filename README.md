<h1 align="center">Dockstash</h1>

<p align="center">
  <strong>Backup orchestration for Docker — run it yourself, or let us run it.</strong><br>
  Encrypted restic snapshots on storage you own, a pull-based agent fleet,
  schedules, restore drills, health monitoring and alerting.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: AGPL-3.0" src="https://img.shields.io/badge/license-AGPL--3.0-blue.svg"></a>
  <img alt="Self-hostable" src="https://img.shields.io/badge/deploy-self--hosted%20or%20cloud-111113">
  <img alt="No telemetry" src="https://img.shields.io/badge/telemetry-none-111113">
</p>

---

Dockstash is the piece most Docker setups are missing: something that actually
backs the stack up, on a schedule, and then **proves the backup restores**.

Self-host it and it runs on your hardware, writes to storage you control, and
never talks to anyone else's server. Or skip the ops and use
**[Dockstash Cloud](https://dockstash.com)** — same product, managed.

## What it backs up

Point it at a project and it detects and captures four layers:

- **Files** — volumes, bind mounts, anything on disk under an allowed root.
- **Databases** — Postgres, MySQL/MariaDB, MongoDB, Redis/Valkey, SQLite,
  ClickHouse, Elasticsearch, RabbitMQ, MinIO, InfluxDB, Neo4j. Dumped through
  the engine's own tooling, streamed straight into restic — never staged on the
  container's disk.
- **Proxy configuration** — the nginx/Caddy config that makes the stack
  reachable, which is exactly what nobody remembers to save.
- **Compose metadata** — the `docker-compose.yml` and env shape needed to stand
  the project back up.

## What it does with them

| | |
|---|---|
| **Encrypted restic repositories** | Deduplicated, incremental, on your own storage target over SSH. |
| **Schedules** | Any cron cadence, per project, with retention policies you set. |
| **Restore drills** | Automated verification that restores a snapshot into scratch space and diffs it, so "the backup ran" and "the backup works" stop being the same claim. |
| **Point-in-time restore** | Resolve the newest snapshot at or before a timestamp, then restore it. |
| **Fleet agents** | A daemon on each remote VPS, pulling work outbound-only. The control plane never opens a connection to your servers. |
| **Health + alerting** | Per-project health rollups, heartbeat detection for backups that quietly stopped, email and webhook channels. |
| **Live job logs** | Streamed over Socket.IO while a job runs. |
| **Self-backup** | Dockstash backs up its own database, so the recovery tool is itself recoverable. |

## Screenshots

<!-- TODO: dashboard.png — project list + health rollup -->
<!-- TODO: project-detail.png — plan editor with detected layers -->
<!-- TODO: snapshots.png — snapshot browser + restore dialog -->
<!-- TODO: fleet.png — agent fleet view -->

## Quick start

```bash
git clone <this-repo> dockstash && cd dockstash
cp .env.example .env
for v in MASTER_ENCRYPTION_KEY JWT_SECRET SESSION_SECRET; do
  echo "$v=$(openssl rand -hex 32)"
done   # paste each into .env
docker compose up -d --build
```

Then open `http://127.0.0.1:3000` and register. There is no seeder and no
bootstrap password — the first account is just an account.

**Full walkthrough, reverse proxy config, and troubleshooting:
[docs/self-hosting.md](docs/self-hosting.md).**

> **Back up `MASTER_ENCRYPTION_KEY` somewhere outside this install.** It wraps
> every secret Dockstash stores, including the passwords to the restic
> repositories holding your backups. Lose it and none of it is recoverable.

## Cloud

Self-hosting is free and complete — this repository is the whole product, not a
crippled edition with the good parts held back. Every feature listed above works
in the version you just cloned.

**[Dockstash Cloud](https://dockstash.com)** runs the same codebase for you if
you would rather not operate it: managed upgrades, monitored control plane,
backups of the backup orchestrator, and support. It is the same software with
the ops handed over.

If your organization cannot use AGPL-licensed software for policy reasons, a
commercial license is available — **support@dockstash.com**.

## Architecture

Three independent npm packages — no monorepo tooling, no workspace magic.

```
client/   React 18 · Vite · Redux Toolkit · Tailwind v4 · shadcn/ui
server/   Express 4 · Mongoose 8 · Passport · Socket.IO · zod
agent/    The VPS daemon — pull-based worker, outbound-only
```

The control plane runs as a compose stack: `api`, `web`, `mongo`, `redis`, and
a least-privilege `docker-socket-proxy`. The api reaches Docker only through
that proxy; it never bind-mounts the raw socket. Every persisted secret is an
AES-256-GCM envelope. Seven UI locales (`en, ar, fr, de, es, ru, zh`) with RTL.

## Documentation

- **[Docs index](docs/README.md)** — every topic, with the locale convention
- [Self-hosting](docs/self-hosting.md) · [Fleet agents](docs/fleet-agents.en.md)
  · [Using the dashboard](docs/using-the-dashboard.en.md)
- [Security model](docs/security-model.en.md) ·
  [Data rights](docs/data-rights.en.md) · [CI gates](docs/ci-gates.en.md)
- [Contributing](CONTRIBUTING.md) · [Security policy](SECURITY.md) ·
  [Code of conduct](CODE_OF_CONDUCT.md) · [Changelog](CHANGELOG.md)

## What's not in this repository

- **No billing code.** No payment provider, no subscription models, no
  entitlement checks. Metering for Dockstash Cloud lives outside this codebase.
- **No usage caps.** Projects, agents, cron cadence and retention are unlimited
  by construction — there is no gate to unlock.
- **No telemetry, no phone-home, no analytics.** A self-hosted install makes
  exactly the network calls you configure and no others.
- **No platform-operator role.** Nobody — including whoever installed it — has a
  console above your account. The role ladder tops out at `Admin`.
- **Not a hosted storage provider.** You bring the restic target.

## License

**[AGPL-3.0-only](LICENSE).** Self-host it, modify it, fork it. If you run a
modified version as a network service, §13 requires you to offer your users the
modified source.

A separate commercial license is available for organizations that cannot use
AGPL software — **support@dockstash.com**.

Contributions are welcome and require a one-line
[CLA](.github/CLA.md) so the dual-licensing above stays possible. It is a
license grant, not a copyright assignment: you keep your work.
