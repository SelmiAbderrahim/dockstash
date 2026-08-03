# Self-hosting Dockstash

Dockstash ships as a container stack orchestrated by `docker-compose.yml` at the
repo root. Everything runs on one host, there is no account to create anywhere
else, and nothing phones home.

Self-hosting is free and complete — this is the whole product, not a reduced
edition. If you would rather not operate it, [Dockstash
Cloud](https://dockstash.com) runs the same codebase as a managed service; the
rest of this guide is for running it yourself.

---

## 1. What you need

- **Docker Engine 24+ with the Compose plugin** (`docker compose version`).
- **A host** to run the control plane on. It needs enough disk for the restic
  cache, not for the backups themselves.
- **A storage target for restic** — an SSH-reachable box, or any path restic can
  write to. Backups live there, not on the control-plane host.
- Optionally, **remote VPS hosts** you want to back up. Those run the fleet
  agent, not this stack — see [fleet-agents.en.md](fleet-agents.en.md).

Ports: `api` and `web` bind **loopback only** (`127.0.0.1`), so a reverse proxy
is required for anything beyond local access. See §4.

---

## 2. Quick start

```bash
git clone <your-fork-or-this-repo> dockstash
cd dockstash

cp .env.example .env

# Generate the three required secrets:
for v in MASTER_ENCRYPTION_KEY JWT_SECRET SESSION_SECRET; do
  echo "$v=$(openssl rand -hex 32)"
done
# …then paste each into .env, replacing the `replace-me-…` placeholders.

docker compose up -d --build
docker compose ps          # every service should report `healthy`
```

Then open `http://127.0.0.1:${WEB_PORT:-3000}`.

Set `CLIENT_URL`, `SERVER_URL`, `VITE_API_BASE_URL` and `VITE_SOCKET_URL` to the
origins a **browser** will use. The two `VITE_*` values are baked into the
browser bundle at image build time, so changing them means rebuilding `web`.

### The services

| Service | Image | Purpose | Healthcheck |
|---|---|---|---|
| `mongo` | `mongo:7` | Primary datastore (Mongoose) | `db.adminCommand('ping')` |
| `redis` | `redis:7-alpine` | Rate-limit store / queue host | `redis-cli ping` |
| `docker-socket-proxy` | `tecnativa/docker-socket-proxy:0.3.0` | Least-privilege gateway to `/var/run/docker.sock` (`CONTAINERS=1`, `EXEC=1`, `INFO=1`, all else `0`) | `GET /_ping` |
| `api` | built from `server/Dockerfile` | Express + Socket.IO, with `restic` / `pg_dump` / `mysqldump` / `mongodump` baked in | `GET /api/health` |
| `web` | built from `client/Dockerfile` | Node static server for the built SPA | `GET /healthz` |

All declare `restart: unless-stopped`. Named volumes `mongo-data` and
`redis-data` survive restarts. One `dockstash` bridge network connects them.

The `api` container reaches Docker **only** through the socket proxy:

```
api ──DOCKER_HOST=tcp://docker-socket-proxy:2375──▶ docker-socket-proxy ──/var/run/docker.sock:ro──▶ host
```

It never bind-mounts the raw socket. `/var/www` is mounted read-only for backup
scans.

---

## 3. The `make` targets

A `Makefile` at the repo root wraps the common compose calls. `make help` lists
them all; the ones you will actually use:

| Target | What it does |
|---|---|
| `make build-up` | `docker compose up -d --build`, then blocks until every container is healthy |
| `make wait-healthy` | Blocks until all containers report healthy; fails fast on unhealthy/exited (timeout `HEALTH_TIMEOUT`, default 300s) |
| `make ps` | Container status |
| `make health` | One-shot health table |
| `make logs` | Follow logs from all services (last 100 lines) |
| `make sh-api` | Shell inside the running `api` container |
| `make config` | Validate the compose file + `.env` interpolation |
| `make down` | Stop and remove containers — **volumes are preserved** |

---

## 4. Reverse proxy and TLS

`api` publishes `127.0.0.1:${API_PORT:-8080}` and `web` publishes
`127.0.0.1:${WEB_PORT:-3000}`. Neither is reachable from outside the host, so a
reverse proxy terminating TLS is mandatory for real use.

**Caddy** (gets a certificate automatically):

```caddyfile
dockstash.example.com {
    handle /api/* {
        reverse_proxy 127.0.0.1:8080
    }
    handle /socket.io/* {
        reverse_proxy 127.0.0.1:8080
    }
    handle {
        reverse_proxy 127.0.0.1:3000
    }
}
```

**nginx**:

```nginx
server {
    listen 443 ssl http2;
    server_name dockstash.example.com;

    ssl_certificate     /etc/letsencrypt/live/dockstash.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/dockstash.example.com/privkey.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host              $host;
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Live job logs ride Socket.IO — the upgrade headers are required.
    location /socket.io/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade    $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host       $host;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

With a proxy in front, set in `.env` and rebuild `web`:

```env
CLIENT_URL=https://dockstash.example.com
SERVER_URL=https://dockstash.example.com
VITE_API_BASE_URL=https://dockstash.example.com/api
VITE_SOCKET_URL=https://dockstash.example.com
```

CORS is locked to `CLIENT_URL` exactly — no wildcard, no reflected origin.

---

## 5. Creating the first account

There is **no seeder and no bootstrap password**. Register through the UI like
any other user:

1. Open the app; `/` redirects you to `/login`.
2. Follow the "Create an account" link and register.
3. Verify your email. If `RESEND_API_KEY` is unset, no email is sent — flip the
   flag directly in Mongo instead:

   ```bash
   docker compose exec mongo mongosh dockstash --eval \
     'db.users.updateOne({email:"you@example.com"},{$set:{emailVerified:true}})'
   ```

### Promoting yourself to Admin

`POST/GET /api/recovery/self-backup` — the install-wide self-backup surface — is
gated on the `Admin` role. Everything else works at the default `Member` role.
Roles are `Member` < `Client` < `Owner` < `Admin`; there is no tier above Admin.

```bash
docker compose exec mongo mongosh dockstash --eval \
  'db.users.updateOne({email:"you@example.com"},{$set:{role:"Admin"}})'
```

Sign out and back in so the new role lands in your session.

---

## 6. Connecting a fleet agent

Remote hosts you want to back up run the pull-based agent daemon, which
authenticates to `/api/agent/*` with a per-agent bearer token. It is a separate
compose file on the remote host, not part of this stack.

Full walkthrough and security model: **[fleet-agents.en.md](fleet-agents.en.md)**.

---

## 7. Self-backup and restore drills

Two runbooks cover protecting Dockstash itself and proving your backups restore:

- **[self-backup.en.md](self-backup.en.md)** — backing up the orchestrator's own
  Mongo (projects, schedules, encrypted secrets, history) into a reserved restic
  repo.
- **[bootstrap-recovery.en.md](bootstrap-recovery.en.md)** — rebuilding a
  Dockstash install from that self-backup.
- **[backup-verification.en.md](backup-verification.en.md)** — automated restore
  drills.

---

## 8. ⚠️ Back up `MASTER_ENCRYPTION_KEY` out of band

> **This is the one mistake you cannot recover from.**
>
> `MASTER_ENCRYPTION_KEY` is the AES-256-GCM key wrapping every secret Dockstash
> stores: restic repository passwords, storage SSH private keys, agent API
> secrets. Lose it and **every ciphertext in Mongo becomes permanently
> unreadable** — including the passwords to the restic repositories holding your
> backups. No support channel, no recovery path, no exceptions.
>
> Store a copy somewhere that does **not** depend on this install: a password
> manager, a printed sheet in a safe, an offline drive. A copy that only exists
> inside the backups Dockstash produces is not a copy.
>
> Rotation runbook: `server/src/shared/crypto/README.md`.

The same applies, less catastrophically, to `JWT_SECRET` and `SESSION_SECRET` —
rotating those just logs everyone out.

---

## 9. Upgrading

```bash
git pull
docker compose up -d --build
make wait-healthy
```

Data lives in the `mongo-data` / `redis-data` named volumes and survives
rebuilds. Read `CHANGELOG.md` before a major bump — breaking changes list the
env vars you need to add or remove.

---

## 10. Troubleshooting

**A container never reports healthy.**
`make health` shows per-service state; `docker compose logs api --tail=100`
usually names the cause. The most common one is a missing or too-short
`MASTER_ENCRYPTION_KEY` — the api fails fast at boot rather than starting with
broken crypto.

**Backups "succeed" but nothing lands in the repository.**
Check `RESTIC_RUNNER`. The default in `.env.example` is `placeholder`, which
logs loudly instead of running restic. Production wants `RESTIC_RUNNER=process`
(the compose file already sets it for the `api` service).

**Database dumps fail with a Docker permission error.**
The api talks to Docker only through `docker-socket-proxy`. Confirm
`DOCKER_HOST=tcp://docker-socket-proxy:2375` on the `api` service and that the
proxy container is healthy. The proxy allows `CONTAINERS`, `EXEC` and `INFO`
only — a dump needing anything else will be refused by design.

**Storage SSH connection rejected.**
`STORAGE_SSH_HOST_KEY_FINGERPRINT` pins the host key. A mismatch is a hard
reject; there is no auto-accept. Re-read the fingerprint from the storage host
(`ssh-keyscan`) and update the value.

**The browser calls the wrong API origin.**
`VITE_API_BASE_URL` / `VITE_SOCKET_URL` are baked in at build time. Changing
them in `.env` requires `docker compose build web` before `up -d`.

**Agent-side issues** (empty folder lists, version mismatches) are covered in
[fleet-agents.en.md](fleet-agents.en.md).

---

## 11. Publishing the agent image

Remote hosts **pull** the agent image, and the install snippet never runs
`docker login`, so the image repository must be public. The `publish-agent` job
in `.github/workflows/ci.yml` builds `agent/` and pushes `:latest` + `:<sha>` on
every push to `master`, using the `DOCKERHUB_USERNAME` / `DOCKERHUB_TOKEN` repo
secrets. Forks have no credentials and the job is master-push-only, so it never
runs on a fork or a pull request.

To publish by hand:

```bash
docker build -t <your-namespace>/agent:latest agent/
docker push <your-namespace>/agent:latest

# arm64 hosts — build multi-arch instead:
docker buildx build --platform linux/amd64,linux/arm64 \
  -t <your-namespace>/agent:latest --push agent/
```

If you publish under your own namespace, update the image reference in
`agent/docker-compose.agent.yml` and in the install snippet the UI renders.
