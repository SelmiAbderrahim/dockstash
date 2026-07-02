# Running Dockstash with Docker

> **Locale note.** The `01-*` i18n foundation prompt owns user-facing translation
> (en, ar, fr, de, es, ru, zh) plus RTL / autodetect. This page is stubbed in
> English only until `01-*` lands; the follow-up will fan the same content out
> to the other six locales.

Dockstash ships as a container stack orchestrated by `docker-compose.yml` at the
repo root. This prompt (`00-dockerize-stack-and-strip-demo-*.md`) supersedes the
old CLAUDE.md §9 "No Docker" rule.

## The five services

| Service | Image | Purpose | Healthcheck |
|---------|-------|---------|-------------|
| `mongo` | `mongo:7` | Primary datastore (Mongoose) | `db.adminCommand('ping')` |
| `redis` | `redis:7-alpine` | BullMQ host (later phase) | `redis-cli ping` |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:0.3.0` | Least-privilege gateway to `/var/run/docker.sock` (`CONTAINERS=1`, `EXEC=1`, `INFO=1`, all else `0`) | `GET /_ping` |
| `api` | built from `server/Dockerfile` | Express + Socket.IO + baked `restic` / `pg_dump` / `mysqldump` / `mongodump` | `GET /api/health` |
| `web` | built from `client/Dockerfile` (nginx) | Vite static build + SPA fallback | `GET /healthz` |

All services declare `restart: unless-stopped`. Named volumes `mongo-data` and
`redis-data` persist data across restarts. A single `dockstash` bridge network
connects them.

## Socket topology

The `api` container reaches Docker **only** through the socket proxy:

```
api ──DOCKER_HOST=tcp://docker-socket-proxy:2375──▶ docker-socket-proxy ──/var/run/docker.sock:ro──▶ host
```

The api never bind-mounts the raw socket. `/var/www` is mounted read-only for
backup scans.

## Secrets

Secrets are **never baked into images** and never live in `.env`. Populate the
files listed under `secrets:` in `docker-compose.yml`:

```
./secrets/master_encryption_key
./secrets/polar_access_token
./secrets/polar_webhook_secret
./secrets/resend_api_key
```

Compose mounts them into the api container as Docker secrets at
`/run/secrets/<name>`.

## Bring the stack up

```bash
cp .env.example .env
# fill in JWT_SECRET, SESSION_SECRET, MONGODB_URI, REDIS_URL, CLIENT_URL,
# SERVER_URL, VITE_API_BASE_URL, VITE_SOCKET_URL — plus the ./secrets/ files.

docker compose up -d --build
docker compose ps           # all five services should report `healthy`
```

Point a browser at `http://localhost:${WEB_PORT:-3000}`.

## Where env vars come from

Root `.env` is the single source of truth (see `.claude/rules/environment-variables.md`).
Compose reads it at compose time and forwards the values to the `api` runtime
environment and to `web`'s Vite build args. No subdirectory `.env` files.

## The agent container (remote VPSes)

Fleet agents are **not** part of this stack. Each runs standalone on a separate
VPS via its own `agent/docker-compose.agent.yml` (image `dockstash/agent`, built
from `agent/Dockerfile`), reaching that host's Docker through its own bundled
`docker-socket-proxy`. It phones home to `/api/agent/*` with a per-agent Bearer
token; the main stack never connects out to it.

Its runtime env lives on the remote VPS, not in root `.env`:

| Variable | Purpose |
|----------|---------|
| `DOCKSTASH_URL` | This Dockstash server's origin |
| `DOCKSTASH_AGENT_TOKEN` | One-time `dsa_<agentId>.<secret>` from registration |
| `DOCKER_HOST` | `tcp://docker-socket-proxy:2375` (bundled proxy) |

Upgrade an agent with `docker compose -f docker-compose.agent.yml pull &&
docker compose -f docker-compose.agent.yml up -d`. Full setup and security model:
`docs/fleet-agents.en.md`.
