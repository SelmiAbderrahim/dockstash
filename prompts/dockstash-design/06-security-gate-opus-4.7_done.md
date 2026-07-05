# Phase 06 — Security Gate (100% security) + Completion Protocol — Design-Upgrade Prompt

> **No design win may open — or leave open — a security hole.** Design changes touch the
> highest-exposure surfaces: SSR HTML, head tags, links, fonts, the client bundle. And
> Dockstash holds secrets that must never surface: `MASTER_ENCRYPTION_KEY`, per-agent
> Bearer tokens, restic repository passwords, destination credentials. Every SEC item is
> a gate — fix, verify, record. Then the **completion protocol**: self-audit, an
> adversarial re-run from a clean boot, and the final green matrix.

---

## Agent

`security-auditor` (primary — the adversarial review, `Read/Grep/Glob` only) +
`react-specialist` / a backend agent (fixes) + `dependency-manager` (SEC-05 audit).
**Depends on all prior phases** (it reviews `git diff "$BASE_COMMIT"`). Runs last.

## Preflight (blocking)

Run `GATE-MACHINERY.md` **§f verbatim** — STOP on any FAIL. Phase-specific extras:

- Phases 00–05 `_done`-renamed; every G-ID except G-14/G-15/G-16 already `done` in the
  matrix (this phase closes those three).
- `BASE_COMMIT` read from the ledger header — every diff-review gate below uses it.

## Scope fence — NOT this phase

| Deferred / forbidden work | Why |
|---|---|
| Any visual/design edit not mandated by a SEC finding | design phases are closed; a visual regression found here reopens the owning ID |
| Loosening any middleware, limiter, or auth check | SEC-06 — only the SEC-11 CSP *strengthening* diff is sanctioned |
| `docker-compose.yml` / `agent/` / socket-proxy | SEC-13 — frozen |
| Broad logger-redaction work | named out-of-scope → §5 follow-up with owner |

## Coverage contract (100% v8 — non-negotiable)

The SEC-11 middleware change is server code inside the threshold — its unit test ships
**in the same edit** (file + cases named under SEC-11 below). Any other SEC fix that
touches source ships/updates its co-located test the same way. Diagnose <100% per
`GATE-MACHINERY.md` §g.

## Skill gates (MANDATORY — load before touching the surface)

| Skill / agent | Load it for | Satisfies |
|---|---|---|
| `security-review` skill | branch-mode deep semantic review of the design diff (SEC-10) | G-01, G-14 |
| `security-auditor` agent | the adversarial vulnerability sweep across the touched surfaces | G-01, G-14 |
| `dependency-manager` agent | SEC-05 `npm audit --audit-level=high` across all three packages | G-01 |

> **Do NOT use `prompts/SECURITY.md` as authority** — it targets a different stack; only
> its find→fix→verify ledger discipline carries over.

## Mission — SEC-01…SEC-13 (every item is a gate)

- **SEC-01 — Zero `dangerouslySetInnerHTML`, kept at zero.** Styled fragments, if ever
  wanted, are composed JSX — never HTML strings. *Gate:* BAN-09 PASS repo-wide.
- **SEC-02 — JSON-LD stays `JSON.stringify`-as-children.** Safe pattern is
  `client/src/shared/seo/Seo.tsx` (`<script type="application/ld+json">{JSON.stringify(doc)}</script>`
  via Helmet, schema in `schema.ts`). *Gate:* `grep -rn 'ld+json' client/src server/src`
  hits only that pattern.
- **SEC-03 — every `target="_blank"` carries `rel="noopener noreferrer"`.** *Gate:*
  BAN-10 PASS (file-level) + a logged per-instance review of every hit confirming the
  `rel` on that same element.
- **SEC-04 — No secrets in the client bundle.** Only `VITE_*` may reach the browser.
  *Gate:*
  ```bash
  npm --prefix client run build
  grep -rEn 'sk_live|sk_test|whsec_|polar_(at|oat)|re_[A-Za-z0-9]|AIza|-----BEGIN' client/dist && echo 'FAIL SEC-04a' || echo 'PASS SEC-04a'
  grep -E '^[A-Z_]+=' .env | grep -v '^VITE_' | cut -d= -f2- | while read -r v; do
    [ ${#v} -ge 12 ] && grep -rqlF -- "$v" client/dist && echo "FAIL SEC-04b: server env value leaked"; done; echo 'SEC-04b sweep done'
  ```
  (SEC-04b covers `JWT_SECRET`, `SESSION_SECRET`, `MASTER_ENCRYPTION_KEY`,
  `SUPERADMIN_PASSWORD`, Polar/Resend creds — any ≥12-char non-VITE value.)
- **SEC-05 — Dependency audit.** `(cd client && npm audit --audit-level=high)`,
  `(cd server && …)`, `(cd agent && …)` all exit 0 (zero high/critical — the new
  Playwright devDependency must not introduce an advisory).
- **SEC-06 — No weakening of security middleware.** *Gate:*
  `git diff --name-only "$BASE_COMMIT" -- server/src/shared/middleware/` empty, OR every
  hunk reviewed + justified in §2 — helmet (`security-headers.ts`), CSRF
  (`csrf.ts`, keeps `timingSafeEqual`), rate limiters (`rate-limit.ts`),
  `require-auth.ts`, `require-agent-auth.ts` (fleet machine surface), `require-role.ts`
  never loosened. The SEC-11 CSP change is the one sanctioned (strengthening) diff.
- **SEC-07 — Fonts stay self-hosted.** Inter, JetBrains Mono, Instrument Serif ship via
  `@fontsource` from our origin — preloaded on the LCP path, `font-display: swap`, never
  a CDN. *Gate:* BAN-11 PASS + `curl -fsS "$WEB/" | grep -E 'preload[^>]*font'` shows a
  same-origin href.
- **SEC-08 — i18n values render as text, never HTML.** Locale strings flow only into
  text children/attributes via `t(...)` / server `translate(...)` — never into `__html`,
  `href`/`src` construction, or template-built markup. *Gate:* BAN-09 + a logged review
  of every new `t(` call site.
- **SEC-09 — Zero external scripts on SSR pages.** *Gate:*
  `grep -rnE '<script[^>]*src="https?://' client/index.html client/src server/src` empty.
- **SEC-10 — Adversarial review, zero unresolved findings.** Run the `security-auditor`
  agent AND the `security-review` skill (branch mode) against `git diff "$BASE_COMMIT"`.
  Every finding fixed, or recorded in §5 with an explicit user-visible justification.
  "Unreviewed" is a failing state.
- **SEC-11 — Content-Security-Policy (ordered task — the repo has none today).** Enable
  CSP via helmet (`server/src/shared/middleware/security-headers.ts`, where
  `contentSecurityPolicy: false` — line verified at baseline) for the SSR web surface
  and the API, in two steps:
  1. Ship **report-only** first: helmet's `contentSecurityPolicy` with
     `reportOnly: true` (emits `Content-Security-Policy-Report-Only`), directives from
     the starter policy below as a `directives` object. Drive all Playwright projects +
     a manual click-through; collect violations from the browser console.
  2. Fix every violation, then flip to **enforce** (`reportOnly: false`). Known
     violation to expect: the **inline no-flash theme-bootstrap script in
     `client/index.html`** (verified present, ~lines 19–33). Fix by hash: compute
     `sha256-...` of the exact script body
     (`echo -n '<script body verbatim>' | openssl dgst -sha256 -binary | openssl base64`)
     and add `'sha256-<hash>'` to `script-src`. The hash covers the byte-exact body —
     any later edit to that script must recompute it (leave a comment in the middleware
     pointing at `client/index.html`). Inline JSON-LD needs nothing:
     `type="application/ld+json"` is inert data and never executes.

  **Unit test (same edit, 100% v8):** the existing
  `server/src/shared/middleware/security.test.ts` covers the helmet wiring — extend it
  (or add `security-headers.test.ts` beside it) with cases: header present on a
  supertest response; exact directive set matches the policy (incl. the script hash);
  report-only vs enforce switch covered both ways; API responses carry it too.

  Starter policy:
  ```text
  default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
  img-src 'self' data:; font-src 'self'; connect-src 'self';
  object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
  ```
  (`style-src 'unsafe-inline'` = pragmatic starter for React inline styles; tightening to
  hashes is a §5 follow-up. `font-src 'self'` is coherent because SEC-07 keeps fonts
  self-hosted. `connect-src 'self'` must still admit the Socket.IO endpoint — same origin
  through the web proxy; a third-party `connect-src` (e.g. Polar checkout) adds the
  specific origin — never a wildcard — logged in §2.)

  *Gate:*
  ```bash
  curl -fsSI "$WEB/" | grep -i '^content-security-policy:' && echo 'PASS SEC-11a' || echo 'FAIL SEC-11a'
  curl -fsSI "$WEB/api/health" | grep -i '^content-security-policy:' && echo 'PASS SEC-11b' || echo 'FAIL SEC-11b'
  (cd client && npx playwright test)   # all projects green under the ENFORCED policy — zero CSP console violations
  ```
  The middleware change is server code — it needs a **unit test asserting the header
  value** (100% v8 threshold applies).
- **SEC-12 — Backup-secret surfaces untouched by design work.** No agent Bearer token,
  restic repository password, destination credential, or decrypted secret is ever
  rendered into DOM outside the existing explicit reveal flows (`AgentKeyReveal` —
  one-time reveal semantics preserved), logged to the browser console, or placed in a
  URL/query param. *Gate:* logged review of every touched component handling agent keys
  or destination config + SEC-04 bundle sweep.
- **SEC-13 — Infrastructure trust boundary untouched.**
  `git diff "$BASE_COMMIT" -- docker-compose.yml agent/` contains no changes to the
  `docker-socket-proxy` least-privilege config, agent auth, or volume mounts — or every
  hunk is justified in §2. Design work has no business at this layer.

**Named out-of-scope** (a decision, not an omission): broadening pino logger redaction
across all server modules is observability work, not a design surface — record in §5 as
a follow-up with owner.

## Operating Constraints

| Rule | Detail |
|---|---|
| Every SEC is a gate | Any `FAIL` = the phase is open. Fix, verify, record — no exceptions. |
| Never weaken middleware | SEC-06: helmet/CSRF/rate-limit/auth/role/agent-auth only strengthen (SEC-11 CSP) — never loosen. |
| Secrets never in DOM/bundle/URL | SEC-04/12: only `VITE_*` in the browser; reveal flows unchanged. |
| CSP: report-only → enforce | Two-step; enforce only after zero console violations across all Playwright projects. |
| Trust boundary frozen | SEC-13: no `docker-compose.yml` / `agent/` / socket-proxy changes from design work. |
| CSP header unit test | Server middleware change ships a test asserting the header (100% v8). |

## Execute → Validate → Test

**Execute**
1. Load `security-review` + `security-auditor` + `dependency-manager`.
2. Work SEC-01…SEC-13 in order; SEC-11 is the two-step CSP rollout (report-only →
   fix violations → enforce).
3. Run the adversarial review (SEC-10) against `git diff "$BASE_COMMIT"`; fix or §5-log
   every finding.

**Validate** — run every SEC gate block above; record each PASS/FAIL + evidence in §3.
Every SEC-01…13 must be green in the matrix with evidence (**G-14**).

**Test**
```bash
# GATE-CORE (GATE-MACHINERY.md §b) — incl. the new CSP-header unit test:
#   ...typecheck / lint / vitest --coverage ×3...
# GATE-E2E under the ENFORCED CSP (GATE-MACHINERY.md §c) — zero CSP console violations:
docker compose up -d --build && docker compose ps
export PLAYWRIGHT_BASE_URL="$WEB"; (cd client && npx playwright test)
```
- **STOP-and-fix:** any SEC `FAIL`, any red project under enforced CSP, any GATE-CORE
  failure halts the phase.

## Completion protocol (closes G-15 / G-16)

1. **Self-audit.** Enumerate every touched surface from
   `git diff --name-only "$BASE_COMMIT"` and re-open each against the Exit criteria.
2. **Adversarial pass.**
   `docker compose down && docker compose up -d --build && docker compose ps` (all
   healthy — **never `-v`; volumes hold real backup state**). Then re-run the **Phase 5
   and Phase 6 gate blocks verbatim, from scratch**, treating all prior evidence as
   stale. Record the runs in §3. This is **G-16**.
3. **Final matrix.** Paste the completed traceability matrix — every G/BAN/SEC ID green
   with evidence — plus the change report (what changed, why, which axis: simplicity /
   award bar / conversion / discoverability / security). **Zero non-green IDs, zero empty
   Evidence cells on done rows** (**G-15**), or the run is not finished.
4. **All-green assertion (run verbatim — the machine check for G-15):**

   ```bash
   L=.claude/plans/design-upgrade-ledger.md
   rows=$(grep -cE '^\| *(G|BAN|SEC|SPEC)-' "$L" || true)
   nondone=$(grep -E '^\| *(G|BAN|SEC|SPEC)-' "$L" | grep -vc '| *done *|' || true)
   empty=$(grep -E '^\| *(G|BAN|SEC|SPEC)-' "$L" | grep -c '| *|[ ]*$' || true)
   [ "$rows" -eq 62 ] && [ "$nondone" -eq 0 ] && [ "$empty" -eq 0 ] \
     && echo 'PASS G-15: 62/62 done, evidence complete' \
     || echo "FAIL G-15: rows=$rows nondone=$nondone empty-evidence=$empty"
   ```

   A `FAIL` here is a hard stop: the run is **not** finished, regardless of how
   complete the transcript feels. Fix the open IDs (or their evidence) under their
   owning phases and re-run.

## Gate out (Phase 6 — final) — every box has a check command; all must PASS

- [ ] **G-14** — SEC-01…SEC-13 all `done` with evidence:
      `grep -E '^\| *SEC-' .claude/plans/design-upgrade-ledger.md | grep -vc '| *done *|'` = 0.
- [ ] CSP enforced —
      `curl -fsSI "$WEB/" | grep -i '^content-security-policy:' && curl -fsSI "$WEB/api/health" | grep -i '^content-security-policy:'`
      (the header, NOT `-report-only`); CSP unit test green inside GATE-CORE; all
      Playwright projects green under enforcement (§3).
- [ ] **G-16** — adversarial pass §3 entries: clean re-boot
      (`docker compose down && docker compose up -d --build` — **never `-v`**), then
      the Phase-5 AND Phase-6 gate blocks re-run verbatim, all green, timestamps after
      the reboot.
- [ ] **G-15** — the all-green assertion (completion protocol step 4) prints
      `PASS G-15: 62/62 done, evidence complete`; change report pasted.
- [ ] Scope fence held —
      `git diff --name-only "$BASE_COMMIT" -- docker-compose.yml agent/` empty (SEC-13);
      middleware diff limited to the SEC-11 change (SEC-06 review in §2/§3).

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
The batch is complete.
