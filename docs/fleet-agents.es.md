# Fleet agents

> **Locale note.** This page ships in English in all seven locale files
> (`fleet-agents.{en,ar,fr,de,es,ru,zh}.md`) until the translation pass lands —
> matching the `running-with-docker.md` precedent.

A **fleet agent** is a small daemon you run on another VPS so Dockstash can
back up the containers on *that* host, not just the primary. The control plane
(the Dockstash server) never connects out to your VPS — the agent **phones
home** over HTTPS, so no inbound ports are opened on the machine you're adding.
Multi-VPS fleet is a **Business**-tier feature.

```
Your VPS                                   Dockstash server
┌───────────────────────────┐   HTTPS      ┌─────────────────────────────┐
│ selmiabderrahim/agent     │ ───────────▶ │ POST /api/agent/heartbeat   │
│  poll (10s) + heartbeat   │  Authorization│      /jobs/claim            │
│  restic + docker exec via │  Bearer dsa_… │      /jobs/:id/logs         │
│  a local socket-proxy     │              │      /jobs/:id/result       │
└───────────────────────────┘              └─────────────────────────────┘
        restic ──sftp──▶ your storage VPS (same repo layout as local backups)
```

## Registration and the one-time token

Register an agent at `/fleet` (**Register agent** → name + host). Registration
mints a composite **token** shaped `dsa_<agentId>.<secret>` and shows it
**once** — it is stored only as a keyed HMAC on the server and can never be
retrieved again. Copy it immediately. If you lose it, use **Rotate key** on the
agent's row: the old token stops working the moment a new one is minted.

## Installing the agent

The register dialog shows a copy-paste block. Run it on the target VPS:

```bash
cat > docker-compose.agent.yml <<'EOF'
services:
  docker-socket-proxy:
    image: tecnativa/docker-socket-proxy:0.3.0
    restart: unless-stopped
    environment: { CONTAINERS: 1, EXEC: 1, POST: 1, INFO: 1 }
    volumes: [/var/run/docker.sock:/var/run/docker.sock:ro]
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
  agent:
    image: selmiabderrahim/agent:latest
    restart: unless-stopped
    depends_on: [docker-socket-proxy]
    environment:
      DOCKSTASH_URL: https://dockstash.com
      DOCKSTASH_AGENT_TOKEN: dsa_<agentId>.<secret>
      DOCKER_HOST: tcp://docker-socket-proxy:2375
    volumes: [/var/www:/var/www:ro]
    tmpfs: [/tmp]
    security_opt: [no-new-privileges:true]
    cap_drop: [ALL]
EOF
docker compose -f docker-compose.agent.yml up -d
```

- `DOCKSTASH_URL` — your Dockstash origin.
- `DOCKSTASH_AGENT_TOKEN` — the one-time token from registration.
- The bundled **docker-socket-proxy** grants the agent exactly
  `CONTAINERS + EXEC` on the host Docker — the same least-privilege posture as
  the primary stack. The agent never touches the raw socket.
- `/var/www:ro` is the backup-path root (matches the server's `/var/www/*`
  allowlist). Mount read-only.

## How remote jobs run

1. Assign a project to the agent in **Project → Plan → Runs on** (or leave it on
   *This server (local)*). Assignment is the only routing switch.
2. When a scheduled or on-demand backup fires for an assigned project, the
   server persists an **agent job** instead of running it locally.
3. The agent **claims** the job on its next poll. The claim response carries the
   plan, the restic repo URL, and the decrypted repo password + SSH key —
   delivered only in that TLS response, never stored on the job record.
4. The agent runs the same dump-then-restic pipeline the primary uses, streaming
   log lines back (visible in live logs) and posting a final result. The server
   then stamps the project's status, snapshot count, and repo size.

Restore drills are not yet supported on remote agents (they still run on the
primary); backup, verify (`check`), prune, and restore are.

## Heartbeat and offline detection

The agent heartbeats every ~30s. An agent is shown **online** only while its
last heartbeat is fresh (default: within 90s); a 5-minute server sweep flips
stale agents to **offline**. A job whose lease expires (the agent died
mid-run, default 15 min, renewed by log posts) is failed and an alert is sent —
it is never silently retried.

## Security model

- The token secret is stored as a **keyed HMAC-SHA256**, never in the clear — a
  database dump alone cannot yield a usable credential.
- The agent authenticates every request with `Authorization: Bearer <token>`;
  the machine surface (`/api/agent/*`) takes no cookies and no CSRF.
- Connectivity is **outbound-only** — the server never dials the agent.
- Job secrets (repo password, SSH key) exist only in-memory on the agent and, for
  the SSH key, briefly on tmpfs (`0600`, removed after the run) — identical to
  the primary's posture.
- **Rotate** immediately invalidates the old token; **Remove** unassigns the
  agent's projects (they fall back to local) and cancels its queued jobs.

## Troubleshooting

- **Agent shows offline** — confirm the container is running
  (`docker compose -f docker-compose.agent.yml ps`), that `DOCKSTASH_URL` is
  reachable from the VPS, and that the token is intact. Check `/healthz` on the
  agent's local health port.
- **401 after rotate** — the running container still holds the old token.
  Update `DOCKSTASH_AGENT_TOKEN` and recreate: `docker compose -f
  docker-compose.agent.yml up -d`.
- **Reinstall / move** — remove the agent in the UI, register a fresh one, and
  bring up the compose file with the new token.

### Troubleshooting empty folders

The Add-Project picker (Fleet target → Folders/Docker tabs) reads a **cached
snapshot** the agent last pushed on heartbeat — never live filesystem/Docker
access, since the server can't reach the agent (outbound-only). An empty
picker has three distinct causes, and the UI now tells you which:

1. **Agent has never reported** — the picker shows "Agent hasn't reported
   yet" with a link to this Fleet page. Check the agent is online (see
   "Agent shows offline" above).
2. **`/var/www` unreadable or not mounted** — the picker shows a discovery-
   error banner ("`/var/www` is not readable from the agent container…").
   SSH into the agent VPS and check the mount:
   ```bash
   docker compose -f docker-compose.agent.yml exec agent ls -la /var/www
   ```
   An empty or missing listing means the `- /var/www:/var/www:ro` volume in
   `docker-compose.agent.yml` isn't mounted (or the host path is empty).
3. **Docker socket unreachable** — the Docker tab shows a discovery-error
   banner instead of "Docker is not available." SSH in and check the proxy:
   ```bash
   docker compose -f docker-compose.agent.yml ps          # both containers UP?
   docker compose -f docker-compose.agent.yml exec agent \
     wget -qO- http://docker-socket-proxy:2375/containers/json | head -c 200
   ```
   A 403 or connection error means `CONTAINERS: 1` isn't set on the proxy, or
   the proxy container is down.

Once fixed, use the **Refresh now** button next to the target picker instead
of waiting for the next ~2-minute discovery interval — it flags the agent for
an immediate re-scan on its very next heartbeat.
