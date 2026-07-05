# Docker-Only Commands - Strict Rule

## MANDATORY REQUIREMENT - ZERO TOLERANCE

**Every build/test/runtime command runs inside Docker. NEVER run `npm`, `node`, `npx`,
`vitest`, `tsc`, `vite`, or any package-manager / toolchain binary directly on the
host.** The host provides `git`, `docker`, and read-only file inspection — nothing else.

## Why This Rule Exists

1. **Parity with CI** — CI runs everything in `node:20-bookworm` containers
   (`.github/workflows/ci.yml`). Host-run commands can pass locally and fail in CI
   (different node version, missing system deps, dirty global cache).
2. **Parity with prod** — dockstash.com runs as the compose stack from this tree.
   The only truthful "it works" is the containerized one.
3. **Clean host** — no host `node_modules` drift, no version-manager roulette.

## Canonical Command Forms

### Dev tooling (mirrors CI: `node:20-bookworm`)

```bash
# Template — <side> is client or server, <cmd> is any npm script:
docker run --rm -v "$PWD/<side>":/app -w /app node:20-bookworm <cmd>

# Install deps
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm install
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm install

# Tests (coverage thresholds enforced by vitest config)
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm test
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm test

# Single test file
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm \
  npx vitest run src/modules/auth/auth.test.ts

# Typecheck / lint / build
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run lint
docker run --rm -v "$PWD/client":/app -w /app node:20-bookworm npm run build

# Audit (CI gate: zero high/critical)
docker run --rm -v "$PWD/server":/app -w /app node:20-bookworm npm audit --audit-level=high
```

Notes:
- `mongodb-memory-server` downloads a mongod binary on first test run inside the
  container; re-use the same mounted tree so the cache persists.
- Add `-e CI=1` when a script behaves differently in CI mode.
- Never `-v "$PWD":/app` from the repo root for npm commands — mount the package
  directory (`client/` or `server/`) so root `.env` and sibling packages stay out of
  the container.

### Stack operations (compose)

```bash
docker compose up -d --build      # build + start full stack
docker compose ps                 # health check — all services `healthy`
docker compose logs -f api        # tail a service
docker compose exec api sh        # shell inside a running service
docker compose exec mongo mongosh # DB inspection
docker compose down               # stop (NEVER `down -v` without explicit user approval — deletes volumes)
```

### In-network scripts (crawlers, smoke tests)

```bash
# Run a script against the running stack from inside its network:
docker run --rm --network dockstash -v "$PWD/scripts":/scripts \
  node:20-bookworm node /scripts/crawl.mjs
# (confirm network name with `docker network ls` — compose default is `<project>_dockstash`)
```

## Allowed on Host (Exhaustive)

| Category | Commands |
|----------|----------|
| Version control | `git` (subject to `git-destructive-commands.md`) |
| Docker itself | `docker`, `docker compose` |
| Read-only file ops | `ls`, `cat`, `grep`, `find`, `head`, `tail`, `diff`, `wc`, `sed -n` (print-only) |
| File edits | Editor/agent file writes (source code editing is not command execution) |
| GitHub | `gh` |

## FORBIDDEN on Host

```bash
# WRONG — every one of these must be wrapped in docker run / docker compose exec:
npm install
npm test
npm run dev
npx vitest run ...
node script.js
tsc --noEmit
vite build
```

## Agent Responsibilities

1. **Never** invoke a toolchain binary on the host, even for a "quick check".
2. When a doc/README suggests a bare `npm ...` command, translate it to the docker
   form before running.
3. New scripts (validation, crawlers, codemods) are written to run inside a
   container and documented with their docker invocation.
4. If a command genuinely cannot run in Docker (rare), STOP and ask the user first.

## Validation Checklist

- [ ] No bare `npm`/`node`/`npx`/`tsc`/`vitest`/`vite` invocations on host
- [ ] Dev-tooling commands use `node:20-bookworm` (CI parity)
- [ ] Stack interaction via `docker compose` exec/logs/ps
- [ ] In-network scripts run with `--network` against the compose network
