# Phase 04 — SEO & AI-Search Discoverability — Design-Upgrade Prompt

> **Get cited — by Google AND by AI answer engines.** Dockstash sells to developers who
> search and ask AI assistants; its own surfaces must be exemplary. Fix everything the
> Phase-1 `seo-audit` flagged, ship valid structured data, per-locale hreflang + OG on
> every SSR route, and AEO/GEO-shaped content — all without a Core Web Vitals
> regression. Extend `server/src/modules/seo/` and `client/src/shared/seo/`, never fork
> them.

---

## Agent

`react-specialist` (primary — `client/src/shared/seo/`) + a backend-capable agent for
`server/src/modules/seo/`. **Depends on Phase 01** (the SEO baseline) and **Phase 03**
(landing HTML is the flagship SSR surface). Read the Phase-1 `seo-audit` findings from
the ledger first.

## Preflight (blocking)

Run `GATE-MACHINERY.md` **§f verbatim** — STOP on any FAIL. Phase-specific extras:

- Phases 00–03 `_done`-renamed; G-20 `done` in the matrix and
  `(cd client && npx playwright test --project=cwv)` green **before** any change (the
  regression yardstick this phase must hold).
- The Phase-1 audit artifact's **SEO baseline** section
  (`.claude/plans/design-upgrade-audit.md` §4) is this phase's work order — read it
  first; do not re-derive.

## Scope fence — NOT this phase

| Deferred work | Owner |
|---|---|
| Visual restyling of any component (this phase edits meta/markup/structure only) | Phases 2/3 (done) / 5 |
| New landing sections or copy rewrites beyond heading/answer shaping | Phase 3 (done) |
| CSP / `server/src/shared/middleware/` | Phase 6 |
| Playwright suite changes beyond re-running it | Phase 3 (done) / 5 |

Allowed edit surface: `server/src/modules/seo/**`, `client/src/shared/seo/**`,
per-route meta usage in `client/src/features/marketing/**` (head/meta/heading-level
edits only), locale namespace files for new meta strings.

## Coverage contract (100% v8 — non-negotiable)

- Every `server/src/modules/seo/**` change ships its test in the same edit — extend
  the module's existing `*.test.ts` files: sitemap generation (all four sub-sitemaps +
  index), hreflang emission (7 locales + `x-default`), robots.txt, llms.txt handler,
  schema builders in `client/src/shared/seo/schema.ts` (client-side tests for JSON-LD
  shape: required `@type` keys per document type).
- After each module edit: that package's `npx vitest run --coverage` before the next.
  The server run includes the `seo.parity` suite — localized meta strings need all 7
  locales the moment they exist.
- Diagnose <100% per `GATE-MACHINERY.md` §g. Exclusions/threshold edits FORBIDDEN.

## Skill gates (MANDATORY — load before touching the surface)

| Skill | Load it for | Satisfies |
|---|---|---|
| `seo-audit` | fixing titles/meta/headings/canonical/sitemaps/robots flagged in Phase 1 | G-01, G-10 |
| `ai-seo` | AEO/GEO — structure content so AI Overviews / ChatGPT / Perplexity / Claude can cite it | G-01, G-10 |
| `schema-markup` | JSON-LD (Organization, SoftwareApplication/Product, FAQ, BreadcrumbList) that parses valid | G-01, G-10 |
| `site-architecture` | internal-linking + information architecture across the marketing surface | G-01 |

## Mission

1. **Fix everything the Phase-1 audit flagged:** titles, meta descriptions, heading
   hierarchy, canonical, sitemaps/robots, internal linking (`site-architecture`). The
   SEO infrastructure lives in `server/src/modules/seo/` (robots.txt, sitemap index +
   `sitemap-core/alternatives/guides/usecases.xml`, llms.txt) and
   `client/src/shared/seo/` (`Seo.tsx`, `meta.ts`, `schema.ts`) — **extend these, do not
   fork.**
2. **Structured data via `schema-markup`:** JSON-LD (Organization,
   SoftwareApplication/Product, FAQ, BreadcrumbList as applicable) that parses as valid
   JSON with the required `@type` keys. **Use the SEC-02 safe pattern** —
   `<script type="application/ld+json">{JSON.stringify(doc)}</script>` via Helmet, schema
   built in `client/src/shared/seo/schema.ts`. Google Rich Results is a post-ship manual
   check — record as a ledger §5 follow-up, not a claim.
3. **Per-locale `hreflang` + OG/Twitter cards on every SSR marketing route** — all seven
   locales, all routes including the programmatic sets (`alternatives/:slug`, `vs/:slug`,
   `guides/:entry`, `backup/:entry`).
4. **Apply `ai-seo` (AEO/GEO):** clear question-shaped headings, extractable answers (the
   `<details>` FAQ pattern already serves this), entity clarity ("Dockstash", "Docker
   backup", "restic", "fleet agent"), and a current llms.txt.
5. **Core Web Vitals are a design constraint, not an afterthought** — LCP, CLS, INP stay
   in budget (verified by `cwv.spec.ts` from Phase 3).

## Operating Constraints

| Rule | Detail |
|---|---|
| Extend, don't fork | All work lands in existing `server/src/modules/seo/` + `client/src/shared/seo/`. No parallel SEO layer. |
| JSON-LD safe pattern | `JSON.stringify` as children via Helmet only (SEC-02). Never `dangerouslySetInnerHTML` (SEC-01/BAN-09). |
| i18n×7 | hreflang + localized meta on all 7 locales, every SSR route incl. programmatic. |
| SSR-visible | Meta/JSON-LD/FAQ answers must be in server-rendered HTML — verified by curl, not a headless render. |
| No CWV regression | Meta/schema additions must not add render-blocking cost. |
| No external scripts | SSR pages ship zero third-party script tags (SEC-09). |

## Execute → Validate → Test

**Execute**
1. Load the four skills; read the Phase-1 baseline from the ledger.
2. Fix meta/headings/canonical/sitemaps in `seo/` modules; add JSON-LD via `schema.ts`;
   add hreflang + OG per locale; refresh llms.txt; apply AEO heading/answer structure.
3. Boot the stack; run the curl gates against `$WEB`, repeating the HTML checks **for
   every SSR marketing route** (not just `/`).

**Validate — Phase-4 curl gates (run against the live stack)**

Global one-time checks:

```bash
curl -fsS "$WEB/robots.txt"
curl -fsS "$WEB/sitemap.xml" | head -5
curl -fsSI "$WEB/llms.txt" | grep -i 'content-type: text/plain'
# llms.txt freshness — it must mention the live route sets:
for s in pricing alternatives guides fleet-agents; do
  curl -fsS "$WEB/llms.txt" | grep -q "$s" && echo "PASS llms $s" || echo "FAIL llms $s"; done
```

Per-route loop — the **full static SSR route list** (from
`client/src/features/marketing/routes.tsx`) **plus one representative per programmatic
set** (pick live slugs from the sitemaps; do not invent slugs). Run the whole loop, not
a sample; every FAIL line is a STOP:

```bash
ROUTES="/ /pricing /alternatives /vs/<live-slug> /alternatives/<live-slug> \
/compare/self-hosted-backup-vs-cloud-backup /guides /guides/<live-entry> \
/backup/<live-entry> /fleet-agents /security /faq /privacy /terms"
for r in $ROUTES; do
  html=$(curl -fsS "$WEB$r") || { echo "FAIL fetch $r"; continue; }
  echo "$html" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const m=[...s.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];if(!m.length){console.error("FAIL JSON-LD");process.exit(1)}m.forEach(x=>JSON.parse(x[1]));console.log("PASS JSON-LD x"+m.length)})' \
    && echo "  route $r" || echo "FAIL JSON-LD $r"
  for l in en ar fr de es ru zh x-default; do
    echo "$html" | grep -qi "hreflang=\"$l\"" && echo "PASS hreflang $l $r" || echo "FAIL hreflang $l $r"; done
  echo "$html" | grep -q 'rel="canonical"' && echo "PASS canonical $r" || echo "FAIL canonical $r"
  echo "$html" | grep -qi 'property="og:title"' && echo "PASS og $r" || echo "FAIL og $r"
done
```

Log the loop's full output tail in §3. The 404 route is checked separately: it returns
HTTP 404 (not 200) with a designed page.

**Test**
```bash
# GATE-CORE (GATE-MACHINERY.md §b) — includes server seo.parity suite:
#   ...typecheck / lint / vitest --coverage ×3...
# CWV regression check (from Phase 3):
export PLAYWRIGHT_BASE_URL="$WEB"; (cd client && npx playwright test --project=cwv)
```
- Server `seo/` changes need unit tests (100% v8, per the Coverage contract above):
  sitemap generation, hreflang + `x-default` emission, robots/llms handlers, schema
  builders. **STOP-and-fix** on any red curl gate, failed parity suite, or CWV
  regression; re-run the full block before advancing (fixes per `GATE-MACHINERY.md` §g).

## Gate out (Phase 4 → 5) — every box has a check command; all must PASS

- [ ] **G-10** — the per-route loop above ran over the **full** route list; §3 holds
      the output; `grep -c '^FAIL' <§3 output>` = 0 (JSON-LD valid, 8 hreflang values
      incl. `x-default`, canonical, OG — every route).
- [ ] Global checks PASS — robots.txt 200, sitemap index 200, llms.txt `text/plain` +
      all four freshness greps PASS (§3).
- [ ] Structured data validity logged in §3; Google Rich Results manual check queued —
      `grep -qi 'rich results' .claude/plans/design-upgrade-ledger.md && echo PASS`
      (§5 row with owner).
- [ ] GATE-CORE green — 9 commands exit 0 (server run includes `seo.parity` + i18n
      parity), §3.
- [ ] No CWV regression —
      `export PLAYWRIGHT_BASE_URL="$WEB"; (cd client && npx playwright test --project=cwv)` green (§3).
- [ ] Scope fence held — `git diff --name-only "$BASE_COMMIT" -- server/src` touches
      only `server/src/modules/seo/` (any other server path = violation → §5 + revert).

On full green: rename this file with the `_done` suffix (`prompts/RENAME-PROMPT-FILE.md`).
