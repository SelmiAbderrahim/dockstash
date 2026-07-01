Use [@Browser](plugin://browser@openai-bundled) to run a focused end-to-end QA pass that validates every Pulsy notification provider and notification channel, starting from `http://localhost:3000/login` (`PUBLIC_WEB_URL`; the `pulsy-web` container via `WEB_PORT:80`; the tRPC/auth server is at `http://localhost:4000`). Use only the Codex builtin browser for browser work; if it fails, fix the Browser/runtime issue and retry rather than substituting Chrome, Playwright, or a host browser.

Bring the stack up with Docker-first commands only: `make start`, `make migrate`, and `make seed` as needed. Log in with the seeded demo account `demo@pulsy.org` / `pulsy-demo-1234`; only register a new account if that fails. Pulsy is a single-user, self-hosted uptime monitor: no organizations/workspaces, billing, tiers, or feature flags. Every provider, channel, monitor, incident, and log must be scoped to `ctx.user.id`; `public.status` is the only public procedure and must never expose provider or channel secrets.

Act as a rigorous QA engineer. The goal is that notification delivery is proven, not merely inspected. Use safe synthetic credentials and local/containerized capture services for tests. Only use real Resend, SendGrid, SMTP, Slack, Discord, or Telegram credentials when they already exist in the QA environment or were explicitly provided for this run; never invent or commit secrets. If a real external credential is unavailable, validate create/update/masking/error behavior and add or run focused mocked server tests to prove request formatting and dispatch behavior.

Validate the full provider matrix from the Notifications tab at `/dashboard/uptime/$monitorId?tab=notifications`:

- **Email providers** - create, edit, list, delete, and test Resend, SendGrid, and SMTP providers. Each requires `name`, `providerType`, `fromAddress`, and the provider-specific credentials (`apiKey` for Resend/SendGrid; `smtpHost`, `smtpPort`, `smtpUsername`, `smtpPassword`, `smtpSecure` for SMTP). Verify missing/invalid fields produce localized Zod errors and no request succeeds with invalid input.
- **Provider test behavior** - Resend posts to `/emails`, SendGrid posts to `/v3/mail/send`, and SMTP validates/sends through the configured SMTP transport or containerized SMTP sink. Confirm success marks the provider `verified: true`; failed tests leave it unverified and show a clear localized toast.
- **Secret handling** - `apiKey` and `smtpPassword` must be AES-256-GCM encrypted at rest, never stored as plaintext, never returned unmasked by tRPC, never shown in the UI after save, never included in public status data, and never printed in browser console or `make logs`. Updating non-secret fields must not leak or unexpectedly wipe existing secrets; updating credentials must require re-verification.
- **Email notification channels** - create/edit/delete/test an email channel linked to a verified provider with comma-separated recipients. Test single and multiple valid recipients, invalid email addresses, empty recipients, missing provider, deleting the linked provider, and switching providers. The channel test must reject unverified providers and succeed once verified.
- **Webhook channels** - create/edit/delete/test with a local/containerized HTTP capture endpoint reachable from `pulsy-server`. Verify `webhookUrl`, optional `webhookHeaders`, JSON payload shape, headers, non-2xx error handling, timeout handling, and that custom headers do not leak into unrelated requests.
- **Slack channels** - validate the Slack webhook payload shape (`text`/`blocks` or alert attachments depending on path), content type, status text, monitor name, URL, HTTP status, response time, and clear failure handling for non-2xx responses.
- **Discord channels** - validate Discord webhook payload shape (`content`/`embeds`), embed color/status, monitor name, URL, HTTP status, response time, timestamp, and clear failure handling for non-2xx responses.
- **Telegram channels** - validate both supported formats where applicable: direct Telegram API URL behavior and shorthand token/chat configuration. Confirm test notifications and real alert notifications include monitor name, URL, status, HTTP status, response time, and timestamp, with clear errors for missing token/chat ID or non-2xx responses.

Validate notification event behavior, not just "test" buttons:

- Create or reuse monitors with controllable URLs so you can force up -> down, down -> degraded, and down/degraded -> up transitions with "check now" and scheduled checks. Use a capture endpoint or focused mocked integration test when external services cannot be called safely.
- Verify `notifyOnDown`, `notifyOnRecovery`, and `notifyOnTlsExpiry` independently for every channel type. A disabled flag must suppress only that event type; enabled flags must dispatch exactly once per qualifying status change.
- Verify TLS-expiry notifications for HTTPS monitors with `tlsExpiryThresholdDays` from 1 to 90. If real short-expiry certificates are not available, add or run a focused server test around `dispatchTlsExpiryNotifications` with mocked TLS info.
- Confirm one failing channel never blocks other channels, never prevents the check log/status change/incident update, and records a useful server-side error without leaking credentials.
- Confirm monitor check logs, status changes, incident open/resolution, dashboard counts, notification rows, and toasts update immediately with no manual refresh.

Validate backend boundaries while testing:

- Every `uptime.emailProvider.*` and `uptime.channel.*` procedure must be `protectedProcedure`, Zod-validated, and scoped to the logged-in user. `findOwnedEmailProviderOrThrow`, `findOwnedChannelOrThrow`, and monitor ownership checks must reject cross-user access.
- Try direct tRPC/API calls or DB setup for a second user to prove one user cannot list, update, delete, test, or attach another user's providers/channels.
- Verify `public.status` remains unauthenticated and only exposes safe public monitor/status data, never email providers, notification channels, webhook URLs, recipients, headers, API keys, SMTP values, or Telegram tokens.
- Search the touched code for raw SQL, `as any` around inputs, unvalidated payloads, plaintext provider secrets, and SaaS-only drift (`organizationId`, workspace/org ownership, billing, tiers, feature flags).

Validate the UI deeply on the notification surface:

- In light and dark mode, inspect the Notifications tab, provider dialogs, channel dialogs, tables, empty states, loading/pending/error states, destructive confirmations, and toasts. No overlap, clipping, broken focus, dead buttons, double-submit, stale disabled state, or uncodixify violations (`shadow-sm` max, no lift-on-hover, no `rounded-2xl+`, no `transition-all`).
- Check mobile widths 320px, 360px, 390px, and 430px plus tablet and desktop. Provider/channel forms, selects, switches, recipient fields, long webhook URLs, action buttons, and dialogs must remain usable with no horizontal overflow and tap targets at least 44x44px. Do not put `min-h-[44px]` or `min-w-[44px]` on a Shadcn `Switch`; use its parent hit area.
- Repeat the core provider/channel create-edit-test-delete flows in all five locales: English, Arabic (RTL), French, German, Spanish. Confirm `lang`, `dir`, translated labels/errors/toasts, no missing keys, long German/French/Spanish wrapping, and Arabic logical alignment. Use logical CSS props (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`), never `ml-*`/`mr-*`/`left-*`/`right-*` or `rtl:flex-row-reverse`.

For any defect, fix the root cause in code, add or update focused tests when the bug is not covered, rebuild via `make restart` if the web/server image changed, and rerun the same provider/channel flow. Use Docker validation for the touched scope:

- `docker compose -f docker/docker-compose.yml --env-file .env exec server pnpm typecheck`
- `docker compose -f docker/docker-compose.yml --env-file .env exec server pnpm test`
- `make typecheck`
- `make lint`
- `make test`
- `git diff --check -- apps packages prompts docs .env.example docker`

`pulsy-web` is an nginx runtime and intentionally does not contain pnpm; web
typecheck/test run during the Docker web build used by the Makefile targets.

Finish with a concise matrix report: Resend, SendGrid, SMTP, email channel, webhook, Slack, Discord, Telegram, down, recovery, TLS expiry, secret masking/encryption, user scoping, locale/RTL, responsive behavior, commands run, failures fixed, and any remaining provider that could not be live-sent because QA credentials were unavailable. Do not stop at a report while a fixable provider defect remains.
