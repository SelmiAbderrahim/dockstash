Run a complete open-source readiness, README, and security validation pass for Pulsy from `/Users/macbook/Desktop/pulsy`. Pulsy is a self-hosted, AGPL-3.0-or-later, single-user uptime monitor. Do not introduce SaaS concepts: no organizations/workspaces, billing, tiers, feature flags, or multi-tenant language. Preserve unrelated worktree changes and do not run destructive git commands.

Act as a release/security QA engineer, not a passive reviewer. The goal is that a new public contributor can clone the repo, understand it, run it, verify it, and report security issues safely. If you find a defect in docs, config, code, or prompts, fix the root cause and rerun the relevant checks before finishing.

Audit the open-source package surface:

- `README.md`, `LICENSE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`, `AGENTS.md`, `CLAUDE.md`, `docs/`, `.env.example`, `.gitignore`, `.dockerignore`, `package.json`, app/package metadata, `docker/docker-compose.yml`, and `Makefile`.
- Confirm the license is consistently `AGPL-3.0-or-later`, the license file is present, package metadata does not contradict it, and npm `private: true` is intentional for a non-published self-hosted monorepo.
- Confirm README claims match the app: HTTP checks, TLS expiry, incidents, notifications, email providers, public status pages, charts, 5 languages with Arabic RTL, quick add, bulk add monitors, bulk selection/delete, and self-hosted Docker operation.
- Verify screenshots and linked files exist, internal links are correct, command snippets are accurate, badges are not misleading, and docs do not mention stale upstream names or proprietary/SaaS-only concepts except when explicitly forbidden.

Validate README and self-hosting instructions:

- Use Docker-first commands through `make`; never run `pnpm dev` on the host for validation. If `.env` is missing, copy `.env.example` and use safe synthetic secrets.
- Check that `.env.example` covers every env var read by the server/web/compose files, contains no real secrets, and documents `ENCRYPTION_KEY`, `BETTER_AUTH_SECRET`, URLs, ports, email, retention, concurrency, and analytics accurately.
- Run the install path far enough to prove it works: `make start`, `make migrate` if needed, `make seed`, login with `demo@pulsy.org` / `pulsy-demo-1234`, and verify the dashboard plus `/status/$userId`. Use [@Browser](plugin://browser@openai-bundled) for the browser smoke test if a browser is needed.
- Confirm container names, ports, same-origin `/api/*` proxying, better-auth URL/cookie assumptions, scheduler startup behavior, and Drizzle schema instructions match the actual Docker setup.

Security and privacy validation:

- Every tRPC data procedure must be `protectedProcedure`, Zod-validated, and scoped by `ctx.user.id`; `public.status` is the only public procedure and must expose only safe public-status data for the requested user.
- Search for and remove forbidden drift: `organizationId`, workspace/org ownership, billing, tiers, feature flags, Stripe/payment language, unvalidated input, raw SQL, or `as any` around request payloads. Investigate docs hits carefully when they only state prohibitions.
- Verify email provider and notification secrets use AES-256-GCM via `ENCRYPTION_KEY`, are encrypted at rest, never logged, never returned unmasked, and are safe in tests, seed data, screenshots, and docs.
- Review auth/session/CORS/CSP-adjacent behavior: same-origin auth through the web proxy, no permissive credentialed CORS for production, no public route leaking private monitor URLs, no secret-bearing query params, and no console/server logs containing credentials.
- Review dependency and supply-chain basics: pinned package manager, lockfile consistency, no unexpected new dependencies, no committed generated caches (`.code-review-graph/`, build output, `.env`), and no private keys/tokens in tracked files.

Run focused checks and record the result:

- `git diff --check -- README.md SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md CHANGELOG.md AGENTS.md CLAUDE.md docs .env.example package.json apps packages docker prompts/codex`
- `rg -n "(organizationId|workspace|billing|tier|feature flag|Stripe|subscription)" README.md SECURITY.md CONTRIBUTING.md CODE_OF_CONDUCT.md CHANGELOG.md AGENTS.md CLAUDE.md docs apps packages prompts`
- `rg -n "(BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY|api[_-]?key|secret|token|password|DATABASE_URL|ENCRYPTION_KEY|BETTER_AUTH_SECRET)" . --glob '!node_modules/**' --glob '!.git/**' --glob '!pnpm-lock.yaml'`
- Docker/container checks for the touched scope, such as `make typecheck`, `make lint`, and `make test`. If checking a runtime container directly, remember `pulsy-web` is an nginx image and intentionally does not contain pnpm; web typecheck/test run during the Docker web build.

Also run a lightweight locale smoke because README advertises 5-language UI: English, Arabic (RTL), French, German, Spanish. Confirm `lang`/`dir`, no missing translation keys on public/login/dashboard/status surfaces, and no open-source/docs links disappear in any locale.

Finish with a concise readiness report: files changed, docs/security issues fixed, commands run with pass/fail, any unresolved blockers, and the exact remaining risk. Do not stop at a report while a fixable readiness or security defect remains.
