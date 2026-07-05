# Gate Machinery — shared appendix (referenced by every phase)

> **This is a reference file, not a runnable prompt.** Every phase file
> (`00…06-…-opus-4.7.md`) calls the blocks here **by name** in its
> `## Execute → Validate → Test` section instead of re-inlining the shell.
> The executor skips this file (no `-opus-4.7` suffix).
>
> **Do not weaken, delete, or paraphrase any command in this file.** A gate that
> is loosened to make it pass is a failed run (Execution Contract rules 7–8:
> STOP-and-fix, Anti-skip). Blocks are copied verbatim from the source
> `prompts/MASTER-DESIGN.md` "Gate machinery" section.

All commands run **from the repo root**. Derive URLs from the root `.env` —
**never hardcode host ports** (they differ between this host and CI; see
`.claude/rules/site-url-env-pattern.md`):

```bash
WEB_PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
WEB="http://127.0.0.1:${WEB_PORT}"          # SSR web surface; proxies /api/* to the api service
export PLAYWRIGHT_BASE_URL="$WEB"
```

> **Local-stack caveat (known, documented):** the client bundle bakes `VITE_*`
> origins at build time, so a locally-composed stack may carry the production
> origin in the bundle. If browser API calls fail on the local stack for this
> reason, use a Playwright-level origin rewrite/proxy in the E2E fixtures rather
> than editing `.env` mid-run — and record the fixture in the ledger. (See also
> memory: local E2E on `127.0.0.1`, use a Playwright origin proxy.)

---

## §a Evidence ledger (create at Phase 0, maintain forever)

Path: `.claude/plans/design-upgrade-ledger.md`; binary evidence (screenshots) in
`.claude/plans/design-upgrade-evidence/`. **Never delete; append across sessions.**

The traceability matrix is seeded with **exactly 62 ID rows** — G-01…G-20 (20),
BAN-01…BAN-12 (12), SEC-01…SEC-13 (13), SPEC-01…SPEC-12 (12), SPEC-A1…SPEC-A5 (5).
Verify the seed (and re-verify on every preflight, §f):

```bash
rows=$(grep -cE '^\| *(G|BAN|SEC|SPEC)-' .claude/plans/design-upgrade-ledger.md || true)
[ "$rows" -eq 62 ] && echo "PASS ledger seed ($rows rows)" || echo "FAIL ledger seed ($rows != 62)"
```

```markdown
# Design Upgrade Ledger — run artifact. Append-only.
BASE_COMMIT: <git rev-parse HEAD at Phase 0>
STARTED: <ISO timestamp>    RESUMED: <one timestamp per session>

## 1. Traceability matrix (the ONLY source of truth for "done")
| ID | Requirement (short) | Phase | Status | Evidence |
Statuses: todo / in-progress / blocked(<reason>) / done.
RULE: "done" REQUIRES a non-empty Evidence cell pointing at a §3 gate-run entry or a §4 file.

## 2. Accepted exceptions (allowlist for BAN gates)
| Gate | file:line | Justification | Added |

## 3. Gate runs (append-only: timestamp, phase, exact command, exit code, output tail)

## 4. Visual evidence index
| Surface | Breakpoint | Theme/Dir | File |

## 5. Deviations & follow-ups (explicitly out of this pass, each with a named owner-decision)
```

**Resume rule** (matches the `prompts/dockstash-build` executor pattern): on every
session start, read the ledger, re-run **GATE-CORE + the BAN block**; any regression
flips the affected IDs back to `in-progress`; resume at the first non-done ID in
phase order. **Never trust transcript memory over the ledger.**

**Concurrent-session rule:** other Claude sessions may edit this tree at the same
time. Before declaring any gate red, check `git status` for changes you did not make;
isolate vitest coverage output (`--coverage.reportsDirectory`) per session if
collisions appear. A gate failure caused by a concurrent session's in-flight work
goes to ledger §5, not into a "fix". (See memory: concurrent-sessions coverage
collisions.)

---

## §b GATE-CORE (run at the end of every phase from Phase 2 on)

Mirrors `.github/workflows/ci.yml` (see `docs/ci-gates.en.md`) — all three packages,
**no allow-list**:

```bash
npm --prefix client run typecheck
npm --prefix server run typecheck
npm --prefix agent  run typecheck
npm --prefix client run lint
npm --prefix server run lint
npm --prefix agent  run lint
(cd client && npx vitest run --coverage)   # 100% v8; includes client i18n parity suite
(cd server && npx vitest run --coverage)   # 100% v8; includes server i18n parity + seo.parity suites
(cd agent  && npx vitest run --coverage)   # 100% v8
```

Every command must **exit 0**. Paste each command's final status line into ledger §3.
(The `agent/` package is UI-free; it is in the gate because shared types and vendored
adapters must not drift while you refactor client/server.)

> **Coverage-quirk note (memory):** vitest 2.1.9 coverage-v8 ignores `exclude` for
> all-scan stubs + sourcemapped deps. Prefer `include: ['src/**']` scoping over
> exclusions when adjusting any `vitest.config.ts`. Isolate `reportsDirectory` per
> session to avoid concurrent-session collisions.

---

## §c GATE-E2E (phases 3, 5, 6, and the adversarial pass)

```bash
docker compose up -d --build
docker compose ps    # EVIDENCE: paste into ledger — api, web, mongo, redis, docker-socket-proxy all healthy
(cd client && npx playwright test)   # ALL projects: smoke, a11y (axe wcag2a/2aa/21a/21aa, light+dark+RTL), locale-ar, cwv
```

`PLAYWRIGHT_BASE_URL` must be exported from the `.env`-derived `$WEB` above.
**The suite does not exist yet** — creating it is an Ordered task of **Phase 3 (G-20)**.
From Phase 3 onward this gate runs in full; in Phase 2 substitute the manual browser
verification + §e screenshots and note "suite pending (G-20)" in the ledger.

**Flake policy** (config ships `retries: 1`, `trace: 'on-first-retry'` — see the
Phase-3 config skeleton): a spec that fails then passes on retry is a **flake** — the
gate still counts as green, but the flake is logged in ledger §5 with the trace path.
A spec that fails twice is a **regression** — STOP-and-fix per §g; never bump
`retries` to bury it.

---

## §d Static bans — paste-and-run block

Any `FAIL` line = phase not done, **unless** that exact `file:line` is in the ledger §2
exceptions table (seeded at the Phase 0 baseline; later additions need written
justification). **Never weaken a pattern to silence a hit.**

```bash
g(){ grep -rn --include='*.ts' --include='*.tsx' --include='*.css' -E "$1" "${@:3}" && echo "FAIL $2" || echo "PASS $2"; }
g 'transition-all|transition: *all'                          BAN-01 client/src --exclude-dir=ui
g 'backdrop-blur'                                            BAN-02 client/src --exclude-dir=ui
g 'hover:scale|hover:-translate|hover:shadow-(md|lg|xl)'     BAN-03 client/src
g 'bg-clip-text|bg-gradient-to'                              BAN-04 client/src --exclude-dir=ui
g '\[#[0-9a-fA-F]{3,8}\]'                                    BAN-05 client/src/features client/src/shared/components --exclude='*.test.*'
g '[" ](ml|mr|pl|pr)-[0-9]|[" ]text-(left|right)[" ]'        BAN-06 client/src/shared/components client/src/features --exclude='*.test.*' --exclude-dir=ui
g 'export default'                                           BAN-07 client/src server/src --exclude='*.config.*'
g 'http://localhost|127\.0\.0\.1'                            BAN-08 client/src server/src --exclude='*.test.*' --exclude='*.spec.*'
g 'dangerouslySetInnerHTML'                                  BAN-09 client/src server/src
b10=0; for f in $(grep -rl 'target="_blank"' client/src --include='*.tsx'); do grep -q noopener "$f" || { echo "FAIL BAN-10 $f"; b10=1; }; done; [ "$b10" -eq 0 ] && echo 'PASS BAN-10'
g 'fonts\.googleapis|fonts\.gstatic|use\.typekit|cdn\.jsdelivr|unpkg\.com|cdnjs\.' BAN-11 client/src client/index.html server/src
g '(bg|text|border|from|to|ring|fill|stroke)-(red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-[0-9]' BAN-12 client/src --exclude-dir=ui --exclude='*.test.*'
```

**Notes (do not argue with these at run time):**

- BAN-01/02/04/12 exclude `client/src/shared/ui/**` (vendored shadcn,
  coverage-excluded); the bans target feature code per
  `.claude/rules/dockstash-design-system.md`.
- **BAN-12 is the monochrome gate** — the design system is achromatic; zero Tailwind
  palette-hue classes (including gray-family: `slate/gray/zinc/neutral/stone`) outside
  vendored `ui/`. Emphasis is contrast + weight, never hue.
- BAN-09's target is **zero hits repo-wide** — the repo is already clean; SEC-01 keeps
  it that way. It never enters the exceptions table.
- BAN-10 is a **file-level** sweep (Prettier puts JSX attributes on separate lines, so
  a same-line grep false-fails). Every file containing `target="_blank"` must also
  contain `noopener`; the per-instance check — each anchor carries
  `rel="noopener noreferrer"` — is the SEC-03 logged review.
- BAN-06 enforces the RTL logical-property rule (dockstash-design-system §7):
  `ps-`/`pe-`/`ms-`/`me-`/`text-start` only, outside vendored `ui/`.
- BAN-07/08: run **once** at the Phase 0 baseline; genuine pre-existing hits go into
  ledger §2 with `file:line` — the patterns are never loosened. (Likely baseline
  candidates: zod URL defaults in `server/src/config/env.ts` and any client origin
  fallbacks — verify at run time, seed §2, do not silently ignore.)
- Emoji-as-icons is a **visual review item** (unreliable to grep) — checked in the
  Phase 5 sweep. lucide-react only.

---

## §e Visual-evidence protocol

For every touched surface: capture **320/768/1024/1440/1920, light AND dark, plus `ar`
RTL**; index every file in ledger §4.

```bash
mkdir -p .claude/plans/design-upgrade-evidence
for w in 320 768 1024 1440 1920; do
  (cd client && npx playwright screenshot --viewport-size="${w},900" \
    "$WEB/" "../.claude/plans/design-upgrade-evidence/home-${w}-light.png")
done
(cd client && npx playwright screenshot --viewport-size="768,900" \
  "$WEB/ar" "../.claude/plans/design-upgrade-evidence/home-ar-rtl.png")
```

**Filename convention (mandatory — §4 rows must be greppable):**
`<surface>-<width>-<theme>[-rtl].png` — e.g. `home-320-light.png`,
`dashboard-1440-dark.png`, `fleet-768-light-rtl.png`. One §4 row per file.

**Dark theme (concrete mechanism):** the theme is **class-based, not media-query** —
`ThemeProvider` (`client/src/shared/theme/ThemeProvider.tsx`) reads
`localStorage.getItem('theme')` and toggles `.dark` on `document.documentElement`;
the inline no-flash script in `client/index.html` does the same before paint.
`page.emulateMedia({ colorScheme: 'dark' })` therefore does **not** flip it reliably
(an explicit stored choice wins). Capture dark via an init script that runs before
any app code:

```ts
// client/e2e/helpers/screenshots.spec.ts — evidence capture, not a test gate.
// Storage key 'theme' mirrors ThemeProvider + the index.html no-flash script.
import { test } from '@playwright/test';

const SURFACES = [{ name: 'home', path: '/' }]; // extend per touched surface
const WIDTHS = [320, 768, 1024, 1440, 1920];
const OUT = '../.claude/plans/design-upgrade-evidence';

for (const s of SURFACES)
  for (const w of WIDTHS)
    for (const theme of ['light', 'dark'] as const) {
      test(`${s.name}-${w}-${theme}`, async ({ page }) => {
        await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
        await page.setViewportSize({ width: w, height: 900 });
        await page.goto(s.path);
        await page.screenshot({ path: `${OUT}/${s.name}-${w}-${theme}.png`, fullPage: true });
      });
    }
// RTL: same loop with page.goto(`/ar${s.path}`) → `${s.name}-<w>-<theme>-rtl.png`.
```

**Authenticated surfaces:** use the Phase-3 auth fixture — mint a JWT from the root
`.env` `JWT_SECRET` (see memory: mint owner JWT from `.env`) and set it as the `token`
cookie in the browser context before navigation. **Never commit credentials or
tokens**; the fixture reads `.env` at runtime. **Playwright only, no new tooling**
(no lighthouse).

---

## §f PREFLIGHT — run verbatim at the start of EVERY phase (01–06)

A phase started without a green preflight is **invalid** — its results do not count,
whatever the transcript says. Run from the repo root; STOP at the first `FAIL`.

```bash
# 1. Ledger exists (Phase 00 creates it). Missing → STOP: run Phase 00 first.
test -f .claude/plans/design-upgrade-ledger.md && echo 'PASS ledger exists' || echo 'FAIL ledger missing'
# 2. Ledger fully seeded (§a): 62 ID rows.
rows=$(grep -cE '^\| *(G|BAN|SEC|SPEC)-' .claude/plans/design-upgrade-ledger.md || true)
[ "$rows" -eq 62 ] && echo "PASS ledger seed ($rows)" || echo "FAIL ledger seed ($rows != 62)"
# 3. Foreign-change snapshot (concurrent-session rule — record it, never revert it):
git status --porcelain
# 4. Derive $WEB — fail hard when WEB_PORT is unset; never guess a port (BAN-08):
WEB_PORT=$(grep -E '^WEB_PORT=' .env | cut -d= -f2)
[ -n "$WEB_PORT" ] && echo "PASS WEB_PORT=$WEB_PORT" || echo 'FAIL WEB_PORT unset'
WEB="http://127.0.0.1:${WEB_PORT}"; export PLAYWRIGHT_BASE_URL="$WEB"
# 4b. BASE_COMMIT from the ledger header (used by every diff-review gate):
BASE_COMMIT=$(grep -E '^BASE_COMMIT: ' .claude/plans/design-upgrade-ledger.md | awk '{print $2}')
[ -n "$BASE_COMMIT" ] && echo "PASS BASE_COMMIT=$BASE_COMMIT" || echo 'FAIL BASE_COMMIT unset'
# 5. Stack healthy + API reachable:
docker compose up -d --build
docker compose ps        # api, web, mongo, redis, docker-socket-proxy — ALL healthy
curl -fsS "$WEB/api/health" >/dev/null && echo 'PASS health' || echo 'FAIL health'
```

Then the judgment steps — each recorded in ledger §3:

6. **Dependency check.** Every ID the previous phase's `Gate out` owns must be `done`
   with a non-empty Evidence cell in the matrix. Any non-done ID → resume **there**
   (under the owning phase file), not here. Additionally: the previous phase's file
   must carry the `_done` rename (`prompts/RENAME-PROMPT-FILE.md`) — an un-renamed
   predecessor means its gate-out was never finished.
7. **Regression re-run (resume rule).** Re-run GATE-CORE (§b) + the BAN block (§d).
   Any regression vs the ledger flips the affected IDs back to `in-progress` — fix
   under the owning phase before continuing. From Phase 3 on, a red `smoke` project is
   also a regression trigger. **Never trust transcript memory over the ledger.**
8. Append `RESUMED: <ISO timestamp>` to the ledger header (one per session).
9. **Skill gates loaded** (G-01) — load this phase's skills now; the Skill-tool calls
   are the §3 evidence.

---

## §g FAILURE PLAYBOOK — sanctioned fixes only

STOP-and-fix (Execution Contract rule 7) means: fix the **root cause** with a
sanctioned fix from this table, then re-run the phase's **entire** gate block. It
never means weaken, exclude, skip, or retry-until-green.

| Symptom | Diagnose | Sanctioned fix | FORBIDDEN |
|---|---|---|---|
| `typecheck` non-zero | Read the first error; open the file:line | Fix the type at the source; adjust the consumer, not the contract | `any`, `@ts-ignore`, `@ts-expect-error`, loosening `tsconfig` |
| `lint` non-zero | `npm --prefix <pkg> run lint` output | Fix the code to satisfy the rule | `eslint-disable`, editing lint config |
| Coverage < 100% | Read the vitest text summary — it lists every uncovered `file:line`; open `coverage/index.html` when unclear | Write the missing test **for that line/branch** in the module's `*.test.ts(x)` next to it | Adding `exclude` entries, lowering thresholds, deleting the code path untested, `/* v8 ignore */` |
| i18n parity suite red | Failure names the missing key + locale | Add the key to **all 7** locale dirs — client `client/src/shared/i18n/locales/{en,ar,fr,de,es,ru,zh}/<ns>.json`, server `server/src/shared/i18n/dictionaries/` — with real translations, not copied English | Deleting the key from `en`, skipping the suite |
| BAN grep hit | Is it code this run wrote? | Yours → fix the code to comply. Genuinely pre-existing → ledger §2 with `file:line` + justification | Rewriting the grep pattern, adding `--exclude` dirs |
| `docker compose ps` unhealthy | `docker compose logs <service> --tail=100` | Fix the cause; `docker compose up -d --build <service>` | **`docker compose down -v` — NEVER (volumes hold real backup state)**; restart-loops without reading logs |
| Playwright spec red | Re-run the one spec: `npx playwright test <file> --trace on`; read the trace | Failed once, passed on retry → flake: log §5 with trace path, gate stays green. Failed twice → regression: fix the app or the selector drift | Raising `retries`, widening timeouts to bury it, deleting the spec |
| Browser API calls fail on local stack | Bundle baked prod `VITE_*` origin (header caveat) | The Phase-3 origin-proxy fixture (`page.route` prod-origin → `$WEB`); record in ledger | Editing `.env` mid-run, rebuilding with hacked env |
| CSP console violation (Phase 6) | Console names the blocked directive + source | Hash/nonce the inline script; add the **specific** origin to the **specific** directive, logged in §2 | `unsafe-inline` for `script-src`, wildcard origins, dropping the directive |
| `npm audit` high/critical | `npm audit` names the package + path | Upgrade/override to the fixed version; if dev-only + no fix exists, ledger §5 with advisory ID | `--force` installs, ignoring silently |
| Port already in use | `ss -ltnp \| grep <port>` | Another session/stack owns it — coordinate; never kill a process you didn't start | Hardcoding a different port (BAN-08) |
| Vitest coverage collides across sessions | Foreign `git status` changes + trashed `coverage/` | Isolate per session: `--coverage.reportsDirectory=coverage-<session>` (memory) | Calling the gate red without checking `git status` |

**Retry budget — thrashing is a failure mode.** Three failed fix attempts on the same
gate (three fix→re-run cycles, still red) → STOP: set that ID to `blocked(<reason>)`
in the matrix, write a §5 entry (what was tried, exact error tails), and surface to
the user. Do **not** keep mutating code hoping the gate flips.

---

## Requirement-ID ownership map (cross-file index)

Every ID lives in exactly one **owning** phase file; this table is the master index so
no ID is orphaned when the batch is split. (`comm -23` of master-vs-batch IDs must be
empty — see README verification.)

| ID range | Owner file |
|---|---|
| G-01…G-20 (exit criteria) | defined in `00`, each closed by its phase (see per-phase Gate out) |
| BAN-01…BAN-12 | this file (§d); baseline in `00`, enforced every phase from `02` |
| SEC-01…SEC-13 | `06-security-gate` |
| SPEC-01…SPEC-12, SPEC-A1…A5 | `REFERENCE-UI-SPEC.md`; applied in `02`/`03`/`05` |
