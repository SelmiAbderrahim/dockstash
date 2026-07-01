Use [@Browser](plugin://browser@openai-bundled) to run a complete end-to-end QA pass on the Pulsy dashboard, starting from `http://localhost:3000/login` (`PUBLIC_WEB_URL`; the `pulsy-web` container via `WEB_PORT:80`; the tRPC/auth server is at `http://localhost:4000`). Use **only** the Codex builtin browser — never launch Chrome, Playwright, or any host browser; if the builtin browser fails, fix it and retry, otherwise **stop** rather than substituting another.

Log in with the seeded demo account `demo@pulsy.org` / `pulsy-demo-1234` (`make seed`); only register a new account if that fails. Pulsy is a **single-user, self-hosted uptime monitor** — no multi-tenancy, organizations, billing, tiers, or feature flags. Everything is always on and scoped to the logged-in user. The only public route is the status page `/status/$userId`; all else requires a session.

Act as a rigorous QA engineer. Visit every page and sub-page and test every interaction (buttons, links, forms, dropdowns, filters, tabs, tables, pagination, modals). Cover the full surface:

- **Monitor list** (`/dashboard`) — must be a **table** (not card grid) with **inline** actions. Test quick add, full create, edit, delete, toggle-active, "check now", bulk-select, bulk pause/resume if present, and bulk delete (type-to-confirm `DELETE N`).
- **Bulk Add Monitors** — paste multiple URLs, including valid, invalid, duplicate, empty, and over-limit batches. Verify parsing, skipped/invalid feedback, shared defaults (method, expected status, interval, timeout, failure threshold, tags), localized validation, disabled/pending states, immediate row/stat updates with no refresh, and that every created monitor is user-scoped and scheduled.
- **Monitor detail** (`/dashboard/uptime/$monitorId`) — every tab: Overview (response-time chart, uptime bar, stats), Incidents (ongoing→resolved + duration), History (paginated check logs), Settings (config form), Notifications. Tab state must persist in the URL (`?tab=`) on refresh.
- **Notification channels** — create/edit/delete/test for email, webhook, Slack, Discord, Telegram; verify per-channel flags (down / recovery / TLS expiry).
- **Email providers** — configure Resend, SendGrid, SMTP + run "test"; secrets must never display unmasked (encrypted at rest).
- **Public status page** — open `/status/$userId` logged out; confirm it shows the owner's monitors with no auth-only data leaking.

For each page validate: correct rendering (no broken layout/overlap/clipping); data loads and updates in place after actions (React Query invalidation + the uptime query-key factory, no manual refresh); status badges (up/down/degraded), counts, lists, charts update after every action; forms validate valid and invalid input with localized errors (Zod); loading/empty/error states present; protected routes redirect to login; no console errors; tRPC requests succeed or fail gracefully with toasts.

Make the app extremely responsive on mobile, not merely passable. Check narrow phones (320/360/390/430px), tablet, and desktop; verify no horizontal overflow, clipped table actions, trapped dialogs, hidden bulk toolbar, broken charts, cramped forms, or tap targets under 44x44px.

Repeat the pass in all five languages — English, Arabic (RTL), French, German, Spanish — not as a spot check. For every locale confirm `lang`, `dir`, translated labels/errors/toasts, date/number readability, long-text wrapping, and Arabic RTL alignment/mirroring.

For any defect, fix the root cause in the code, rebuild via `make restart` (the web image is nginx-served, so changes need a rebuild; validate with Docker-first `make typecheck` / `make lint` / `make test` because `pulsy-web` is an nginx runtime and does not contain pnpm), then re-test the same flow. While fixing: use logical CSS props for RTL (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), never `ml-*`/`mr-*`/`left-*`/`right-*` or `rtl:flex-row-reverse` (the app sets `dir="rtl"`, so flex reverses natively); add keys to all 5 locales under `apps/web/public/locales/{lang}/`; never put `min-h-[44px]`/`min-w-[44px]` on a Shadcn `Switch`.

Do not stop after listing issues. Keep testing, fixing, and retrying until every page, every interaction, and every language is validated and works.
