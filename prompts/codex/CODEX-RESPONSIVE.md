Use [@Browser](plugin://browser@openai-bundled) to run a complete mobile responsiveness and UX QA pass on the Pulsy dashboard. Use **only** the Codex builtin browser — never launch Chrome, Playwright, or any host browser; if the builtin browser fails, fix it and retry, otherwise **stop** rather than substituting another.

Open the app in mobile view at `http://localhost:3000/login` (`PUBLIC_WEB_URL`; the `pulsy-web` container via `WEB_PORT:80`; server at `http://localhost:4000`). Log in with the seeded demo account `demo@pulsy.org` / `pulsy-demo-1234` (`make seed`); also check the public status page `/status/$userId` logged out. Pulsy is a **single-user, self-hosted uptime monitor** — no multi-tenancy, organizations, billing, or feature flags; everything is always on and scoped to the logged-in user.

Act as a mobile QA engineer and make the product extremely responsive, not just technically usable. Test 320px, 360px, 390px, 430px, tablet, and desktop comparison viewports (portrait first; landscape where layout changes). On every page inspect:

- Layout, spacing, typography, hierarchy, navigation, sticky elements, and safe-area spacing.
- Tap targets (min 44×44px), buttons, links, menus, tabs, dropdowns, filters, pagination.
- Forms, inputs, validation, keyboard behavior, selectors, and modals (monitor create/edit, channel, email provider).
- The monitor **table** staying usable on narrow screens (no clipped action buttons), including row checkboxes, select-all, inline actions, sticky/floating bulk toolbar, and type-to-confirm dialogs.
- Monitor detail tabs (Overview/Incidents/History/Settings/Notifications), Recharts charts, check-log tables, status badges, and empty/loading/error states.
- Scrolling, scroll-locking, horizontal overflow, clipping, overlap, z-index.
- Core actions: quick add, full create, bulk add monitors, edit, delete, toggle-active, check-now, bulk pause/resume if present, bulk delete, and test-channel.

For **Bulk Add Monitors**, paste valid, invalid, duplicate, empty, mixed, and over-limit URL batches on mobile. Verify the textarea, skipped/invalid summary, shared settings, tags, submit button, spinner, toast, and created monitor rows all fit without overflow and update immediately without a manual refresh.

Click every control and validate the result. Nothing should be clipped, hidden, overlapping, too small to tap, overflowing, trapped behind the keyboard, or hard to use. Watch for Uncodixify violations (card lift on hover, `animate-pulse` on badges, `rounded-full`/`rounded-2xl` containers, shadow escalation).

For any mobile issue, fix the root cause in the code, rebuild via `make restart` (the web image is nginx-served, so changes need a rebuild; validate with Docker-first `make typecheck` / `make lint` / `make test` because `pulsy-web` is an nginx runtime and does not contain pnpm), then re-test the same flow. While fixing: mobile-first classes (`base → sm: → md: → lg:`); never `min-h-[44px]`/`min-w-[44px]` on a Shadcn `Switch` (use the parent for the touch target); logical CSS props for RTL (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), never `rtl:flex-row-reverse` (native RTL via `dir="rtl"`); semantic color tokens for dark mode.

Repeat once per language — English, Arabic (RTL), French, German, Spanish — checking `lang`, `dir`, text length, wrapping, truncation, alignment, localized validation/toasts, missing keys, and RTL behavior. Add keys to all 5 locales under `apps/web/public/locales/{lang}/` and revalidate.

Do not stop after reporting problems. Keep testing, fixing, and retrying until the dashboard is fully responsive and usable on mobile across all pages, interactions, viewports, and languages.
