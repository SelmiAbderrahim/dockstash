---
name: postal-transactional-email
description: >
  Comprehensive guide for the Postal Transactional Email integration on ServerlessBase.
  Use when building or modifying transactional email features including Postal configuration,
  email sending, webhook processing, domain DNS verification, analytics, superadmin management,
  and subscription tier integration.
version: 1.0.0
category: collaboration
dependencies:
  - Docker (Postal v3, MariaDB 10.6, RabbitMQ 3.12)
  - Drizzle ORM (schema)
  - tRPC (router)
  - React Query (hooks)
  - Recharts (analytics)
---

# Postal Transactional Email Integration Skill

## When to Use

Use this skill when building or modifying any transactional email feature:
- Postal Docker infrastructure setup
- Email sending (structured or raw RFC 2822)
- Webhook event processing
- Domain DNS verification
- Credential and configuration management
- Analytics dashboards and suppression lists
- Superadmin Postal management pages
- Subscription tier quota enforcement
- PAYG metering for transactional sends

## Architecture

Stalwart handles **inbound** mail and collaboration (IMAP, CalDAV, CardDAV, WebDAV).
Postal handles **outbound** transactional email (HTTP API sends, SMTP relay, webhooks, tracking).
They run independently on separate Docker profiles (`mail` vs `postal`).

```
Client Dashboard (React, port 48080)
    |  tRPC hooks (postalKeys.*)
    v
tRPC Postal Router (feature-gated: transactional_email)
    |  PostalClient HTTP (snake_case mapping)
    v
Postal Cluster (Docker profile: postal)
    |  5 containers: web, smtp, worker, mariadb, rabbitmq
    v  Webhook POST per event type
pages/api/webhooks/postal/[eventType].ts
    |
    v
postal_webhook_events + postal_usage tables
```

## Postal API Conventions

- **All endpoints use POST** (even reads)
- **Auth:** `X-Server-API-Key` header with decrypted API key
- **Response wrapper:** `{ status: "success"|"error", time: number, flags: {}, data: {...} }`
- **Client MUST:** check `status`, extract `data`, throw typed errors
- **Field naming:** Postal uses snake_case; TypeScript uses camelCase; explicit mapping required

### snake_case Mapping

| TypeScript | Postal API |
|------------|-----------|
| `plainBody` | `plain_body` |
| `htmlBody` | `html_body` |
| `replyTo` | `reply_to` |
| `contentType` | `content_type` |
| `mailFrom` | `mail_from` |
| `rcptTo` | `rcpt_to` |
| `sentWithSsl` | `sent_with_ssl` |
| `spamStatus` | `spam_status` |
| `ipAddress` | `ip_address` |
| `userAgent` | `user_agent` |

### API Error Types (8)

| Error | Description |
|-------|-------------|
| `ValidationError` | Input validation failed (`errors` hash with field details) |
| `NoRecipients` | No valid recipients provided |
| `NoContent` | Neither `plain_body` nor `html_body` provided |
| `TooManyToAddresses` | Max 50 recipients exceeded |
| `FromAddressMissing` | `from` field required |
| `UnauthenticatedFromAddress` | From address not authorized for server |
| `AttachmentMissingName` | Attachment missing `name` field |
| `AttachmentMissingData` | Attachment missing `data` field |

Auth failures (invalid API key) return HTTP 401/403, NOT a named error type.

## Webhook Events

Event type from URL path: `/api/webhooks/postal/[eventType]`

| Events | Payload |
|--------|---------|
| MessageSent/Delayed/Failed/Held | `{ status, details, output, time, sent_with_ssl, timestamp, message: { id, token, direction, message_id, to, from, subject, timestamp, spam_status, tag } }` |
| MessageBounced | `{ original_message: {...}, bounce: {...} }` |
| MessageLinkClicked | `{ url, token, ip_address, user_agent, message: {...} }` |
| MessageLoaded | `{ ip_address, user_agent, message: {...} }` |
| DomainDNSError | `{ domain, uuid, dns_checked_at, spf_status, dkim_status, mx_status, return_path_status, server: {...} }` |

## DNS Records (5 Required)

| Record | Type | Purpose |
|--------|------|---------|
| SPF | TXT | Sender authorization |
| DKIM | TXT | Email signing |
| MX | MX | Mail routing |
| Return Path | CNAME | Bounce handling |
| Tracking | CNAME | Click/open tracking |

## Dashboard (7 Tabs)

`overview | send | messages | analytics | domains | credentials | settings`

URL tab state mandatory per `url-tab-state.md`.

## Subscription Tiers (Main Platform)

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| `transactionalEmailsPerDay` | 100 | 10,000 | `Infinity` |
| `transactionalEmailTracking` | `false` | `true` | `true` |

Integrated into `PricingTierLimits` / `PricingTierCapabilities` in `pricing-config.ts`.

## Feature Flag

| Property | Value |
|----------|-------|
| Key | `transactional_email` |
| Category | `collaboration` |
| Entitlement | `transactionalEmail` |

Defined in BOTH `client/src/lib/features/platform-features.ts` AND `serverlessbase/packages/server/src/constants/platform-features.ts`.

## File Location Reference

| Layer | Path |
|-------|------|
| Schema: config | `serverlessbase/packages/server/src/db/schema/postal-config.ts` |
| Schema: events | `serverlessbase/packages/server/src/db/schema/postal-webhook-events.ts` |
| Schema: usage | `serverlessbase/packages/server/src/db/schema/postal-usage.ts` |
| HTTP Client | `serverlessbase/packages/server/src/services/postal/postalClient.ts` |
| Config Service | `serverlessbase/packages/server/src/services/postal/configService.ts` |
| Domain Service | `serverlessbase/packages/server/src/services/postal/domainService.ts` |
| Quota Service | `serverlessbase/packages/server/src/services/postal/quotaService.ts` |
| Usage Service | `serverlessbase/packages/server/src/services/postal/usageService.ts` |
| Errors | `serverlessbase/packages/server/src/services/postal/errors.ts` |
| Types | `serverlessbase/packages/server/src/services/postal/types.ts` |
| tRPC Router | `serverlessbase/apps/serverlessbase/server/api/routers/postal.ts` |
| Webhook | `serverlessbase/apps/serverlessbase/pages/api/webhooks/postal/[eventType].ts` |
| Frontend Types | `client/src/types/postal.ts` |
| Frontend Service | `client/src/services/postal/postalService.ts` |
| Query Keys | `client/src/hooks/postal/queryKeys.ts` |
| Hooks | `client/src/hooks/postal/usePostal.ts`, `useAnalytics.ts`, `useDomains.ts` |
| Dashboard Route | `client/src/routes/_app/_auth/dashboard/_layout.transactional-email.tsx` |
| Superadmin Route | `client/src/routes/_app/_superadmin/superadmin/_layout.postal.tsx` |
| Dashboard UI | `client/src/components/dashboard/postal/` |
| Superadmin UI | `client/src/components/superadmin/postal/` |
| Translations | `client/public/locales/{lang}/postal.json` |
| Feature Flag (client) | `client/src/lib/features/platform-features.ts` |
| Feature Flag (server) | `serverlessbase/packages/server/src/constants/platform-features.ts` |
| Pricing Config | `serverlessbase/packages/server/src/billing/pricing-config.ts` |
| Docker | `docker/compose/docker-compose.yml` (postal profile) |
| Entrypoint | `docker/postal/entrypoint.sh` |
| Agent | `.claude/agents/postal/postal-transactional-specialist.md` |
| Rule | `.claude/rules/postal-transactional-patterns.md` |
| Prompts | `prompts/postal-transactional-email/00-10` (11 phase files) |

## Cross-References

- **Stalwart patterns:** `.claude/skills/stalwart-mail-integration/SKILL.md` — reuse DNS wizard, superadmin, encryption patterns
- **Pricing rules:** `.claude/rules/pricing-source-of-truth.md` — all limits from `pricing-config.ts`
- **Postal rules:** `.claude/rules/postal-transactional-patterns.md` — comprehensive pattern enforcement

## Validation Checklist

- [ ] Container names use `serverless-postal-*`
- [ ] All commands run inside Docker
- [ ] API key encrypted in DB, never in `.env`, never unmasked
- [ ] Feature flag `transactional_email` gates all routes/procedures
- [ ] snake_case mapping in PostalClient
- [ ] Response unwrapping from `{ status, time, flags, data }`
- [ ] 5 DNS records (SPF, DKIM, MX, Return Path, Tracking)
- [ ] 7 dashboard tabs with URL state
- [ ] Webhook uses `pages/api/webhooks/postal/[eventType].ts`
- [ ] `Infinity` for unlimited (not `-1`)
- [ ] RTL: logical properties, no `rtl:flex-row-reverse`
- [ ] Dark mode: semantic tokens
- [ ] Touch targets: 44x44px
- [ ] i18n: 5 languages, namespace `postal`
- [ ] Table views, inline buttons (Uncodixify)
- [ ] All 8 API error types handled
