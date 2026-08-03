# AGENTS.md — Dockstash

The entry point for coding agents. Claude Code reads `CLAUDE.md`; OpenCode reads
this file first, then `CLAUDE.md`. This file is a concise pointer —
**[`CLAUDE.md`](CLAUDE.md) is the comprehensive reference** and should not be
duplicated here.

---

## 1. Project identity

Dockstash is **open-source, self-hosted backup orchestration for Docker**:
encrypted restic snapshots on storage the operator owns, a pull-based agent
fleet, schedules, restore drills, health monitoring and alerting.
Apache-2.0 licensed.

It is **not** a SaaS. There is no hosted tier, no payment integration, no plan
or usage cap, no platform-operator role above the account owner, and no
telemetry. If a task seems to call for any of those, it is out of scope — see
`CLAUDE.md` §9.

---

## 2. Layout

| Path | What |
|---|---|
| `client/` | React 18 · Vite · Redux Toolkit · Tailwind v4 · shadcn/ui — a CSR SPA behind auth |
| `server/` | Express 4 · Mongoose 8 · Passport · Socket.IO · zod |
| `agent/` | The VPS daemon — a pull-based backup worker on remote hosts |
| `docs/` | Operator and contributor docs — start at `docs/README.md` |
| `docker-compose.yml`, `Makefile` | The stack: `api`, `web`, `mongo`, `redis`, `docker-socket-proxy` |

Three independent npm packages. No monorepo tooling.

---

## 3. The rule that catches everyone

**Every build, test, and runtime command runs inside Docker.** Never bare `npm`,
`node`, `npx`, `tsc`, or `vitest` on the host:

```bash
docker run --rm -e CI=1 -v "$PWD/<package>":/app -w /app node:20-bookworm <command>
```

`npm test` is watch mode and hangs in a container — always `npx vitest run`.
Cross-package meta-tests need the repo root mounted
(`-v "$PWD":/repo -w /repo/server`).

Full detail: [`CONTRIBUTING.md`](CONTRIBUTING.md) §1.

---

## 4. Conventions

The load-bearing ones, one line each. Rationale and enforcement live in
[`CONTRIBUTING.md`](CONTRIBUTING.md) §4 and `CLAUDE.md` §5.

- **Feature-module isolation** — cross-feature imports go through `shared/` or
  the other module's `index.ts`, never into its internals.
- **Named exports only** — no `export default` anywhere.
- **Typed Mongoose schemas** — `InferSchemaType`, type exported with the model.
- **Owner-scoped queries at query time** — filter by `owner` in the query;
  foreign-owner requests return 404, not 403.
- **Argv-only spawn** — `shell: false` with a `string[]`; secrets via `env`;
  SSH host keys always pinned.
- **`safeFetch` for server-side fetches on user input** — blocks loopback,
  private, link-local and metadata addresses.
- **Errors are i18n keys** — never `err.stack`, never a raw `err.message`.
- **Root `.env` only** — never a `.env` in a subdirectory.
- **No hardcoded URLs** — derive from `CLIENT_URL` / `SERVER_URL` /
  `VITE_API_BASE_URL` / `VITE_SOCKET_URL`.
- **Tab state in `?tab=`** — never `useState`.
- **i18n parity across seven locales** — `en, ar, fr, de, es, ru, zh`, both sides.
- **100% coverage** — source and tests are added or deleted together.
- **Destructive git commands need explicit per-turn approval** — `git stash`,
  `reset --hard`, `clean -f`, `commit --amend`, `push --force`.

---

## 5. Where to look

| Question | File |
|---|---|
| Full project structure, stack, and patterns | [`CLAUDE.md`](CLAUDE.md) |
| Module-by-module internals | [`ARCHITECTURE.md`](ARCHITECTURE.md) |
| How to set up, run gates, and open a PR | [`CONTRIBUTING.md`](CONTRIBUTING.md) |
| Running the stack, reverse proxy, troubleshooting | [`docs/self-hosting.md`](docs/self-hosting.md) |
| Threat model and controls | [`docs/security-model.en.md`](docs/security-model.en.md) |
| The CI gates | [`docs/ci-gates.en.md`](docs/ci-gates.en.md) |
| Every doc topic | [`docs/README.md`](docs/README.md) |
| Reporting a vulnerability | [`SECURITY.md`](SECURITY.md) |

---

## 6. Quick reference

```bash
# Stack
make build-up          # build + start + wait until healthy
make ps / make logs / make health
make sh-api            # shell inside the api container
make down              # stop; volumes preserved

# Gates (per package: client | server | agent)
P=server
docker run --rm -e CI=1 -v "$PWD/$P":/app -w /app node:20-bookworm npm run typecheck
docker run --rm -e CI=1 -v "$PWD/$P":/app -w /app node:20-bookworm npm run lint
docker run --rm -e CI=1 -v "$PWD":/repo   -w /repo/$P node:20-bookworm npx vitest run --coverage
docker run --rm    -v "$PWD/$P":/app -w /app node:20-bookworm npm audit --audit-level=high
```

Ports are loopback-only: `web` on `127.0.0.1:${WEB_PORT:-3000}`, `api` on
`127.0.0.1:${API_PORT:-8080}`.
