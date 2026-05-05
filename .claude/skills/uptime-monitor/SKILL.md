---
name: uptime-monitor
description: >
  Comprehensive guide for the Uptime Monitor feature on ServerlessBase. Use when building
  or modifying uptime monitoring features including HTTP checks, TLS monitoring, notifications,
  incidents, email providers, and status pages.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "monitoring"
  dependencies: "recharts, react, tRPC, drizzle-orm"
  project: "ServerlessBase - Uptime Monitor"
---

# Uptime Monitor Development Guide

## Overview

Uptime Monitor is a feature of the ServerlessBase deployment platform that checks HTTP endpoints at configurable intervals, tracks response times, detects outages, sends notifications via multiple channels, manages incidents, and provides dashboard visualizations.

**Keywords**: uptime, monitor, health check, status page, incident, notification channel, email provider, TLS certificate, response time, uptime bar, check log, degraded, outage

**Project Context**: React 18 + TypeScript strict + TanStack Router + TanStack Query + Shadcn UI, tRPC backend with Drizzle ORM + PostgreSQL, Recharts for visualizations.

## When to Use This Skill

- **Uptime Monitor Features**: When building or modifying any uptime monitoring functionality
- **HTTP Health Checks**: When implementing check execution, timeout handling, or status validation
- **TLS Certificate Monitoring**: When checking certificate expiry and alerting
- **Notification Channels**: When configuring email, webhook, Slack, Discord, or Telegram notifications
- **Email Providers**: When managing Resend, SendGrid, or SMTP provider configurations
- **Incident Management**: When implementing incident lifecycle (ongoing -> resolved)
- **Dashboard & Charts**: When building stats cards, response time charts, or uptime bars
- **Monitor CRUD**: When creating, updating, deleting, or listing monitors
- **Scheduling**: When implementing cron-based check scheduling
- **Cleanup**: When managing check log retention and pruning

## Architecture Overview

```
+-----------------------------------------------------------------------+
|                     Uptime Monitor Architecture                        |
+-----------------------------------------------------------------------+
|                                                                        |
|  ┌────────────┐   ┌───────────────┐   ┌──────────────────────┐       |
|  │  Scheduler │──►│ Checker       │──►│ Status Change Logger │       |
|  │  Service   │   │ Service       │   │                      │       |
|  │ (timers)   │   │ (HTTP/TLS)   │   └──────────┬───────────┘       |
|  └────────────┘   └───────────────┘              │                    |
|                                                   ▼                    |
|                                      ┌──────────────────────┐         |
|                                      │ Notification Service │         |
|                                      │ (email/webhook/      │         |
|                                      │  slack/discord/tg)   │         |
|                                      └──────────┬───────────┘         |
|                                                  │                     |
|                                      ┌───────────▼──────────┐         |
|                                      │ Incident Service     │         |
|                                      │ (ongoing -> resolved)│         |
|                                      └──────────────────────┘         |
|                                                                        |
|  ┌────────────────────────────────────────────────────────────┐       |
|  │                    Frontend Dashboard                       │       |
|  │  Stats Cards │ Monitor List │ Detail (5 tabs) │ Charts    │       |
|  └────────────────────────────────────────────────────────────┘       |
+-----------------------------------------------------------------------+
```

## Database Schema

### Tables (7 total, all with `uptime_` prefix)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `uptime_monitor` | Core monitor config | `uptimeMonitorId`, `name`, `url`, `method`, `expectedStatus`, `timeout`, `interval`, `active`, `status`, `consecutiveFailures`, `failureThreshold` |
| `uptime_check_log` | Individual check results | `checkLogId`, `uptimeMonitorId`, `httpStatus`, `responseTime`, `status`, `errorMessage` |
| `uptime_status_change` | State transition audit | `statusChangeId`, `uptimeMonitorId`, `statusBefore`, `statusAfter`, `reason` |
| `uptime_incident` | Outage records | `incidentId`, `uptimeMonitorId`, `status` (ongoing/resolved), `startedAt`, `resolvedAt`, `durationSeconds` |
| `uptime_email_provider` | Email provider config | `emailProviderId`, `providerType` (resend/sendgrid/smtp), credentials (encrypted) |
| `uptime_notification_channel` | Per-monitor channels | `channelId`, `uptimeMonitorId`, `channelType`, notification flags |
| `uptime_dashboard_cache` | Dashboard aggregates | Cached stats to avoid expensive queries |

### Schema File

`serverlessbase/packages/server/src/db/schema/uptime-monitor.ts`

### Enums

| Enum | Values |
|------|--------|
| `uptimeMonitorMethod` | `GET`, `HEAD`, `POST` |
| `uptimeMonitorStatus` | `up`, `down`, `degraded`, `pending` |
| `uptimeCheckStatus` | `up`, `down`, `degraded` |
| `uptimeIncidentStatus` | `ongoing`, `resolved` |
| `uptimeEmailProviderType` | `resend`, `sendgrid`, `smtp` |
| `uptimeNotificationChannelType` | `email`, `webhook`, `slack`, `discord`, `telegram` |

## tRPC Router

**Router name**: `uptimeMonitor`
**File**: `serverlessbase/apps/serverlessbase/server/api/routers/uptime-monitor.ts`

### Procedure Groups

| Group | Procedure | Type | Description |
|-------|-----------|------|-------------|
| `monitor` | `list` | query | List all monitors for user/org |
| `monitor` | `one` | query | Get single monitor with relations |
| `monitor` | `create` | mutation | Create new monitor |
| `monitor` | `update` | mutation | Update monitor config |
| `monitor` | `delete` | mutation | Delete monitor and related data |
| `monitor` | `toggleActive` | mutation | Toggle active/paused state |
| `monitor` | `checkNow` | mutation | Trigger immediate check |
| `statusChange` | `list` | query | List status changes for a monitor |
| `checkLog` | `list` | query | List check logs (paginated) |
| `checkLog` | `stats` | query | Get aggregate stats for a period |
| `incident` | `list` | query | List incidents for a monitor |
| `incident` | `one` | query | Get single incident |
| `emailProvider` | `list` | query | List email providers |
| `emailProvider` | `create` | mutation | Create email provider |
| `emailProvider` | `update` | mutation | Update email provider |
| `emailProvider` | `delete` | mutation | Delete email provider |
| `emailProvider` | `test` | mutation | Send test email |
| `channel` | `list` | query | List channels for a monitor |
| `channel` | `create` | mutation | Create notification channel |
| `channel` | `update` | mutation | Update notification channel |
| `channel` | `delete` | mutation | Delete notification channel |
| `channel` | `test` | mutation | Send test notification |
| `dashboard` | `summary` | query | Get aggregate dashboard stats |

## Backend Services

**Location**: `serverlessbase/packages/server/src/services/uptime/` (10 files)

| Service | Responsibility |
|---------|---------------|
| `monitor-service.ts` | Monitor CRUD operations |
| `checker-service.ts` | HTTP check execution with configurable timeout, redirect following, expected status validation |
| `tls-checker-service.ts` | TLS handshake to extract certificate expiry date |
| `scheduler-service.ts` | In-memory `Map<string, NodeJS.Timeout>` for active timers; `initializeAllMonitors()` on startup |
| `notification-service.ts` | Dispatches to all channels on status change; respects per-channel flags (`notifyOnDown`, `notifyOnRecovery`, `notifyOnTlsExpiry`) |
| `email-provider-service.ts` | Supports Resend, SendGrid, SMTP; credentials stored encrypted in DB |
| `incident-service.ts` | Creates incident on first failure after threshold; resolves on recovery with duration calculation |
| `stats-service.ts` | Computes uptime percentage, response time min/max/avg, dashboard aggregates |
| `cleanup-service.ts` | Removes check logs older than configurable retention period |
| `index.ts` | Barrel exports |

## Frontend Components

**Location**: `client/src/components/dashboard/uptime/` (11 files)

### Dashboard Level

| Component | File | Description |
|-----------|------|-------------|
| Stats Cards | `uptime-stats-cards.tsx` | Total, up, down, degraded, pending counts + avg uptime |
| Monitor List | `monitor-list.tsx` | Table view with status, name, URL, uptime %, response time, actions |
| Create Dialog | `monitor-create-dialog.tsx` | Form dialog for new monitor |

### Monitor Detail (5 tabs)

| Tab | File | URL State | Content |
|-----|------|-----------|---------|
| Overview | `tabs/overview-tab.tsx` | `?tab=overview` | Response time chart, uptime bar, current stats |
| Incidents | `tabs/incidents-tab.tsx` | `?tab=incidents` | Incident list with status, duration |
| History | `tabs/history-tab.tsx` | `?tab=history` | Check log table with pagination |
| Settings | `tabs/settings-tab.tsx` | `?tab=settings` | Monitor configuration form |
| Notifications | `tabs/notifications-tab.tsx` | `?tab=notifications` | Channel management |

### Charts

| Chart | File | Library | Description |
|-------|------|---------|-------------|
| Response Time | `charts/response-time-chart.tsx` | Recharts | Line chart of response time over time |
| Uptime Bar | `charts/uptime-bar-chart.tsx` | Recharts | Daily uptime percentage bar chart |

## Frontend Hooks

**Location**: `client/src/hooks/uptime/` (5 files)

| Hook File | Hooks Provided |
|-----------|---------------|
| `useUptimeMonitors.ts` | `useUptimeMonitors`, `useUptimeMonitor`, `useCreateMonitor`, `useUpdateMonitor`, `useDeleteMonitor`, `useToggleActive`, `useCheckNow` |
| `useUptimeStats.ts` | `useUptimeDashboard`, `useCheckLogStats`, `useStatusChanges`, `useCheckLogs`, `useIncidents` |
| `useUptimeEmailProviders.ts` | `useEmailProviders`, `useCreateEmailProvider`, `useUpdateEmailProvider`, `useDeleteEmailProvider`, `useTestEmailProvider` |
| `useUptimeNotificationChannels.ts` | `useNotificationChannels`, `useCreateChannel`, `useUpdateChannel`, `useDeleteChannel`, `useTestChannel` |

## Frontend Service

**Location**: `client/src/services/uptime/uptimeService.ts`

All API calls use `trpcQuery`/`trpcMutation` from `@/lib/api/dokploy` with router name `uptimeMonitor`.

## React Query Keys

Use the uptime query key factory (follow the pattern from `client/src/hooks/deployment/queryKeys.ts`):

```typescript
export const uptimeKeys = {
  all: ['uptime'] as const,
  monitors: {
    all: () => [...uptimeKeys.all, 'monitors'] as const,
    lists: () => [...uptimeKeys.monitors.all(), 'list'] as const,
    detail: (id: string) => [...uptimeKeys.monitors.all(), 'detail', id] as const,
  },
  dashboard: {
    summary: () => [...uptimeKeys.all, 'dashboard', 'summary'] as const,
  },
  checkLogs: {
    list: (id: string) => [...uptimeKeys.all, 'checkLogs', id, 'list'] as const,
    stats: (id: string) => [...uptimeKeys.all, 'checkLogs', id, 'stats'] as const,
  },
  statusChanges: {
    list: (id: string) => [...uptimeKeys.all, 'statusChanges', id] as const,
  },
  incidents: {
    list: (id: string) => [...uptimeKeys.all, 'incidents', id, 'list'] as const,
    detail: (id: string) => [...uptimeKeys.all, 'incidents', 'detail', id] as const,
  },
  emailProviders: {
    lists: () => [...uptimeKeys.all, 'emailProviders', 'list'] as const,
  },
  channels: {
    list: (id: string) => [...uptimeKeys.all, 'channels', id, 'list'] as const,
  },
};
```

**ALWAYS use the factory. NEVER create ad-hoc keys.**

## Routes

| Route | File | Description |
|-------|------|-------------|
| `/dashboard/uptime` | `_layout.uptime.tsx` | Monitor list with stats |
| `/dashboard/uptime/:monitorId` | `_layout.uptime.$monitorId.tsx` | Monitor detail with tabs |

## Translations

**Namespace**: `uptimeMonitor`
**Files**: `client/public/locales/{lang}/uptimeMonitor.json` (5 languages: en, ar, fr, de, es)

## Feature Flag

**Name**: `uptime_monitor`
**Category**: `monitoring`

Backend: Every procedure MUST call `assertFeatureEnabled('uptime_monitor')` at start.
Frontend: Routes use `beforeLoad` redirect; components use `useFeatureFlags()`.

## Monitor Lifecycle

```
Created (status: "pending")
    │
    ▼ first successful check
┌──────┐
│  UP  │
└──┬───┘
   │
   │ consecutive failures >= failureThreshold
   ▼
┌──────┐  ───►  Incident created (status: "ongoing")
│ DOWN │        Notifications dispatched (notifyOnDown)
└──┬───┘
   │
   │ successful check
   ▼
┌──────┐  ───►  Incident resolved (durationSeconds calculated)
│  UP  │        Notifications dispatched (notifyOnRecovery)
└──────┘
```

**Degraded**: When response time exceeds a threshold but HTTP status is OK.

## Notification Dispatch Flow

```
Status Change Detected
    │
    ▼
Get all channels for monitor
    │
    ▼
For each channel:
  ├── Check flags (notifyOnDown, notifyOnRecovery, notifyOnTlsExpiry)
  ├── Skip if flag disabled for this event type
  └── Dispatch by channelType:
      ├── email: Use emailProvider to send via Resend/SendGrid/SMTP
      ├── webhook: HTTP POST JSON payload to webhookUrl
      ├── slack: POST to Slack webhook URL
      ├── discord: POST to Discord webhook URL
      └── telegram: POST to Telegram Bot API
```

## Troubleshooting

### Checks Not Executing

1. Verify monitor `active` is `true`
2. Check scheduler service has initialized: look for startup log
3. Verify `interval` is reasonable (minimum 30 seconds)
4. Check for network connectivity from the server

### Notifications Not Sending

1. Verify notification channel exists for the monitor
2. Check channel flags (`notifyOnDown`, `notifyOnRecovery`)
3. For email: verify email provider is configured and `verified` is true
4. Test the channel using the `channel.test` procedure
5. Check server logs for dispatch errors

### TLS Certificate Warnings Not Firing

1. Verify `notifyOnTlsExpiry` is enabled on the channel
2. Check `tlsExpiryThresholdDays` (default: 14)
3. Verify the URL uses HTTPS
4. Check TLS checker can reach the endpoint

### Dashboard Stats Inaccurate

1. Stats are computed from check logs; verify logs exist
2. Check retention period hasn't pruned relevant logs
3. Force recalculation via `checkLog.stats` with explicit `days` param

## File Location Reference

| Layer | Location |
|-------|----------|
| Schema | `serverlessbase/packages/server/src/db/schema/uptime-monitor.ts` |
| Backend Services | `serverlessbase/packages/server/src/services/uptime/` |
| tRPC Router | `serverlessbase/apps/serverlessbase/server/api/routers/uptime-monitor.ts` |
| Frontend Types | `client/src/types/uptime.ts` |
| Frontend Service | `client/src/services/uptime/uptimeService.ts` |
| React Query Hooks | `client/src/hooks/uptime/` |
| UI Components | `client/src/components/dashboard/uptime/` |
| Charts | `client/src/components/dashboard/uptime/charts/` |
| Monitor Detail | `client/src/components/dashboard/uptime/monitor-detail/` |
| Routes | `client/src/routes/_app/_auth/dashboard/_layout.uptime*.tsx` |
| Translations | `client/public/locales/{lang}/uptimeMonitor.json` |
| Rules | `.claude/rules/uptime-monitor-patterns.md` |
| Agent | `.claude/agents/uptime-monitor-specialist.md` |
