# Prompt: Build Pulsy's Perfect Public Landing Page

> **How to use this file:** Paste the entire prompt below into a fresh Claude Code session opened
> at the repo root (`/Users/macbook/Desktop/pulsy`). It is a single, self-contained brief that loads
> the styling, UX, UI, landing-page (CRO), and SEO skills in sequence and builds a best-in-class,
> extremely SEO-friendly landing page for Pulsy. Work top to bottom; do not skip gates.

---

## ROLE & MISSION

You are a **senior product designer + conversion copywriter + SEO engineer** building Pulsy's first
public **landing page**. Pulsy is a self-hosted, open-source (AGPL-3.0) website **uptime & downtime
monitor**: it runs HTTP GET/HEAD/POST checks, tracks up/down/degraded status, watches TLS
certificate expiry, groups failures into incidents, sends notifications (email / webhook / Slack /
Discord / Telegram), and serves public status pages. Tagline today: *"Uptime monitoring made simple."*

Today there is **no landing page** — `/` only redirects, and the sole public page is
`/status/$userId`. You are creating the marketing front door from scratch.

**The success bar — the page must be excellent on all five dimensions at once:**
1. **UX** — clear hierarchy, frictionless path to the primary action, accessible (WCAG 2.1 AA), fast.
2. **UI** — pixel-clean, on-brand, dark-mode + RTL correct, zero "AI-generated template" tells.
3. **Landing / CRO** — PASTOR-ordered persuasion, trust escalation, strong CTAs, micro-commitments.
4. **SEO** — **extremely** search- and AI-crawler-friendly: prerendered/crawlable HTML, full meta,
   JSON-LD, OG/Twitter, sitemap, robots, AEO answer blocks.
5. **Internationalization** — fully translated in all 5 locales (en, ar, fr, de, es) with working RTL.

---

## HARD CONSTRAINTS (read before writing any code)

- **Stack**: `apps/web` = React 18 + Vite + TanStack Router (file-based) + TanStack Query + Tailwind +
  shadcn/ui + Recharts + i18next. This is a **Vite SPA — NOT Next.js.**
- **Do NOT load or use the `nextjs-seo` skill.** No `generateMetadata`, no App Router APIs, no
  `next/*`. Use SPA-appropriate SEO instead (react-helmet-async + static prerender + injected JSON-LD).
- **Obey the project rules verbatim** (read them):
  - `.claude/rules/uncodixify-ui.md` — no `hover:-translate-y-*`, no `hover:shadow-md/lg`, no
    decorative `animate-pulse`, no `transition-all`, no `duration-300+`, no `rounded-full` on
    containers/cards, no `rounded-2xl/3xl`, no gradient backgrounds, no gradient text, no
    glassmorphism/`backdrop-blur`, no `scale-*`/translate on hover. Cards = `rounded-lg`, buttons =
    `rounded-md`, `shadow-sm` max, `transition-colors duration-150`.
  - `.claude/rules/rtl-support-arabic.md` — logical CSS props only (`ms-/me-/ps-/pe-/start-/end-/
    text-start/text-end`), mirror directional icons with `rtl:scale-x-[-1]`, **never**
    `rtl:flex-row-reverse` (the app sets `dir="rtl"` on `<html>`).
  - `.claude/rules/switch-component-styling.md` — never size a Switch with `min-h-/min-w-[44px]`.
  - `.claude/rules/environment-variables.md` — **root `.env` only**, `VITE_` prefix for client vars,
    never create subdirectory `.env` files.
- **Semantic tokens only** — use `bg-background`, `text-foreground`, `bg-primary`,
  `text-muted-foreground`, `bg-card`, `border-border`, etc. **No hardcoded hex/rgb** anywhere. Brand
  primary is blue (`--primary: 221.2 83.2% 53.3%`), tokens live in `apps/web/src/styles/globals.css`
  and `apps/web/tailwind.config.ts`.
- **No billing, no pricing tiers, no feature flags, no multi-tenancy.** Pulsy is single-user and
  every capability is always on. The differentiator is **self-hosted + open-source (AGPL-3.0)**, not a
  paid plan. Skip any pricing-table / plan-calculator patterns the CRO skill suggests.
- **Dev is Docker-first** — containers are `pulsy-*` (`pulsy-web`, `pulsy-server`, `pulsy-postgres`).
  Run build/lint/test via `make` / `docker exec`, not on the host.
- **Conventional commits.** Pinned deps from public npm only.

---

## SKILL-LOADING SEQUENCE (gated — each gate feeds the next)

Run these gates **in order**. Finish and capture each gate's output before starting the next.

### Gate A — Foundation (design system + psychology)
Load and apply: **`ui-ux-pro-max`**, **`ui-ux-pro-max-design-system`**, **`marketing-psychology`**.
- Run the design-system search: a product-type/style/color/typography pass for
  *"uptime monitoring SaaS landing page, developer / devops audience"*.
- Decide the emotional/visual style (must stay compatible with the existing shadcn blue theme and
  Uncodixify constraints — lean clean / Swiss / functional, not decorative).
- Pull 3–5 buyer-psychology angles for the downtime-monitoring buyer (e.g. loss aversion around lost
  revenue/SLA breach, authority via open-source transparency, status-quo cost of "finding out from
  customers"). 
- **Output of Gate A**: confirmed design tokens/typography/spacing scale + chosen style + the
  psychology angles that will drive the copy.

### Gate B — Copy (conversion copywriting + landing CRO)
Load and apply: **`copywriting`**, **`landing-page-optimization`**.
- Apply the **PASTOR** framework section ordering and trust-escalation pattern. **Adapt for Pulsy**:
  no pricing tiers — replace "Offer/pricing" persuasion with the self-hosted + open-source +
  "free, yours, no vendor lock-in" angle, plus a clear "deploy in minutes" path.
- Write every section's copy: hero headline + subhead (give **2–3 headline variants** and **2–3 CTA
  variants** for the primary CTA), body for each section, FAQ Q&A, and the SEO meta title +
  description.
- Voice: clarity over cleverness, benefits over features, specific over vague, no exclamation points.
- **Write all copy as i18n keys** in a new `landing` namespace (see i18n requirement below) — do not
  hardcode English strings in components.
- **Output of Gate B**: complete `landing` copy (all sections) + meta strings + headline/CTA variants.

### Gate C — Build (UI styling + design-system compliance)
Load and apply: **`ui-ux-pro-max-ui-styling`**, **`shadcn-design-system-compliance`**.
- Build the landing route + one component per section (see Page Spec) using shadcn/ui + Tailwind.
- Reuse existing shadcn components in `apps/web/src/components/ui/*`; add new shadcn primitives only
  if missing.
- Requirements: responsive mobile-first; full dark mode via tokens; RTL correct; all interactive
  elements ≥ 44×44px touch target (via parent containers, not by stretching the element); keyboard
  accessible; `Loader2 animate-spin` for any loading state.
- **Output of Gate C**: the rendered, on-brand, accessible landing page wired to the `landing` i18n keys.

### Gate D — SEO (AI search + audit) — make it *extremely* crawlable
Load and apply: **`ai-seo`**, **`seo-audit`**. (Again: **NOT** `nextjs-seo`.)
- **Crawlability (critical)**: this is a Vite SPA, so add **static prerendering / SSG for the landing
  route** (e.g. `vite-plugin-prerender`, `vite-react-ssg`, or `react-snap` — pick one, justify it,
  pin it). After build, `view-source` of `/` MUST contain the real hero/headline/FAQ HTML, not an
  empty `<div id="root">`.
- **Head management**: add `react-helmet-async` (provider at app root). Per-route `<title>`, meta
  description, canonical, `hreflang` for all 5 locales, OG tags (`og:title/description/image/url/
  type`), Twitter card tags.
- **Structured data (JSON-LD)**: inject `SoftwareApplication` (Pulsy, AGPL, self-hosted),
  `Organization`, and `FAQPage` (mirroring the on-page FAQ). Validate against Google Rich Results.
- **AEO / AI-search structure** (from `ai-seo`): lead sections with direct 40–60-word answers,
  include a "What is uptime monitoring?" definition block, a comparison block (self-hosted Pulsy vs
  hosted SaaS monitors), and the FAQ — all as extractable blocks. Add statistics with dates and cite
  sources where claimed.
- **`public/sitemap.xml`** (all locale URLs) + **`public/robots.txt`** that **explicitly allows AI
  crawlers**: GPTBot, PerplexityBot, ClaudeBot, Google-Extended, Bingbot (plus standard bots), and
  points to the sitemap.
- **Output of Gate D**: prerendered crawlable page + full meta/JSON-LD/OG + sitemap + robots.

### Gate E — Analytics (Google Analytics 4 + landing events)
Load and apply: **`analytics-instrumentation`**.
- **Google Analytics 4 via `gtag.js`.** Create a small loader at
  `apps/web/src/lib/analytics/gtag.ts` that reads the measurement ID from
  **`import.meta.env.VITE_GA_MEASUREMENT_ID`**, injects the gtag script once on app mount, and
  **no-ops gracefully when the ID is unset** (dev/CI). **Do NOT** paste a hardcoded `gtag` snippet
  with the literal ID into `index.html`.
- Add **`VITE_GA_MEASUREMENT_ID=G-8ECM3DHQFB`** to the **root `.env`**, and add a placeholder line
  (`VITE_GA_MEASUREMENT_ID=`) to `.env.example`. Root `.env` only — no `apps/web/.env`.
- Instrument the landing page with the skill's event convention **`landing.{section}.{action}`**
  (e.g. `landing.hero.cta_click`), routed through `gtag`. Add scroll-depth (25/50/75/100%),
  section-viewport, and Core Web Vitals tracking. Mandatory props on every event:
  `event_type, section, device_type, session_id, timestamp`. Never fire interactive events on page
  load; debounce rapid events; no PII.
- **Output of Gate E**: GA4 live behind the env var + landing events firing.

### Gate F — Verify
Re-run the **`seo-audit`** checklist against the built page and confirm the Definition of Done below.
Fix anything that fails before declaring complete.

---

## PAGE SPEC (sections, in PASTOR order, adapted for Pulsy)

1. **Hero** — value-prop headline + subhead + primary CTA ("Get started" / "Deploy Pulsy") +
   secondary CTA (View on GitHub / See a live status page). Honest product visual (dashboard or
   status page), no decorative blobs/gradients.
2. **Problem / cost of downtime** — amplify the pain: lost revenue, SLA breaches, finding out from
   customers, missed TLS expiry.
3. **How it works** — 3–4 steps: add a monitor → Pulsy checks on an interval → detects down/degraded
   + TLS expiry → groups into incidents → notifies you → public status page.
4. **Features grid** — HTTP GET/HEAD/POST checks, TLS certificate expiry watch, incident grouping,
   multi-channel notifications (email/webhook/Slack/Discord/Telegram), public status pages,
   response-time + uptime history.
5. **Why self-hosted & open-source** (the differentiator) — your data, no vendor lock-in, AGPL-3.0,
   runs on your infra, free.
6. **Trust / social proof** — open-source signals (GitHub, license), security (encrypted provider
   secrets), and any stats. Escalate trust by scroll depth.
7. **Comparison** — self-hosted Pulsy vs hosted SaaS monitors (structured table; doubles as AEO/SEO).
8. **FAQ** — extractable Q&A that also powers the `FAQPage` JSON-LD.
9. **Final CTA** — restate the offer, low-friction next step.
10. **Footer** — nav, GitHub, license, language picker, status page link.

---

## i18n REQUIREMENT

- Create a new **`landing`** namespace with **complete, human-quality translations in all 5 locales**:
  `apps/web/public/locales/{en,ar,fr,de,es}/landing.json`.
- Register `landing` in the namespace list in `apps/web/src/i18n.ts`.
- Verify Arabic (`ar`) renders **RTL** correctly (the app sets `dir="rtl"` automatically) — check
  layout, icon mirroring, and `hreflang`.
- No hardcoded user-facing strings in components — everything via `t("landing:...")`.

---

## ROUTING REQUIREMENT

- Today `apps/web/src/routes/index.tsx` redirects (`/` → `/login` or `/dashboard`). Replace this so
  **`/` serves the public landing page** while **authenticated users are still routed to
  `/dashboard`** (e.g. render the landing for guests, redirect logged-in sessions). Do not break the
  `_app.tsx` auth guard or the existing `/login`, `/signup`, `/status/$userId` routes.
- Keep the landing route **prerenderable** (it must render meaningful HTML without a live session/API).

---

## DEFINITION OF DONE (acceptance checklist)

- [ ] `/` serves a real landing page; authed users still reach `/dashboard`.
- [ ] `view-source` (post-build) shows prerendered hero/headline/FAQ HTML — not an empty shell.
- [ ] `react-helmet-async` sets title, description, canonical, hreflang (×5), OG, Twitter tags.
- [ ] Valid JSON-LD (`SoftwareApplication` + `Organization` + `FAQPage`) — passes Rich Results test.
- [ ] `public/sitemap.xml` + `public/robots.txt` served; robots allows GPTBot/PerplexityBot/ClaudeBot/
      Google-Extended/Bingbot and links the sitemap.
- [ ] `landing` namespace complete in all 5 locales; Arabic RTL verified.
- [ ] Zero Uncodixify violations; dark mode correct; touch targets ≥ 44×44px; keyboard accessible.
- [ ] GA4 loads from `VITE_GA_MEASUREMENT_ID` (root `.env`), no-ops when unset; `landing.{section}.
      {action}` events + scroll-depth + web-vitals fire with the mandatory props.
- [ ] Lighthouse: SEO ~100, strong Performance / CWV (LCP, CLS < 0.1).
- [ ] Build passes in Docker; no new lint/type errors.

---

## VERIFICATION COMMANDS

```bash
make build                 # build web (+ prerender step)
make start                 # bring up pulsy-web / pulsy-server / pulsy-postgres
# confirm prerendered HTML:
curl -s http://localhost:3000/ | grep -i "<h1"      # hero headline present in source
curl -s http://localhost:3000/robots.txt            # robots served, AI bots allowed
curl -s http://localhost:3000/sitemap.xml           # sitemap served
docker exec -it pulsy-web printenv | grep VITE_GA   # GA id present from root .env
# then: Lighthouse (SEO/Perf), Google Rich Results test on the JSON-LD, and a 5-locale + RTL pass.
```

---

## DELIVERABLES SUMMARY

1. Public landing route at `/` (guests) + prerender/SSG setup.
2. Section components for the Page Spec, on-brand and Uncodixify-clean.
3. `landing` i18n namespace, fully translated ×5, registered in `i18n.ts`.
4. SEO stack: react-helmet-async meta, JSON-LD, OG/Twitter, `sitemap.xml`, `robots.txt`.
5. GA4 loader reading `VITE_GA_MEASUREMENT_ID` from root `.env` (+ `.env.example` placeholder) and
   `landing.{section}.{action}` analytics instrumentation.
6. Green Definition-of-Done checklist, verified with the commands above.
