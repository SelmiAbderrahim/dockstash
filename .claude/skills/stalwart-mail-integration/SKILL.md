---
name: stalwart-mail-integration
description: >
  Comprehensive guide for Stalwart Mail Server integration on ServerlessBase.
  Use when building or modifying mail, calendar, contacts, or files features
  including principal management, CalDAV/CardDAV/WebDAV operations, Docker
  sandbox management, subscription billing, and feature flag gating.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "collaboration"
  dependencies: "stalwart, react, tRPC, drizzle-orm, recharts, fast-xml-parser"
  project: "ServerlessBase - Stalwart Mail Integration"
---

# Stalwart Mail Integration Guide

## Overview

Stalwart Mail Server is integrated into ServerlessBase as a managed Docker container providing email (SMTP/IMAP), calendar (CalDAV), contacts (CardDAV), and file storage (WebDAV). The client dashboard communicates through tRPC proxy routers to Stalwart's REST API and DAV endpoints.

**Keywords**: stalwart, mail server, email, SMTP, IMAP, CalDAV, CardDAV, WebDAV, calendar, contacts, files, collaboration

## When to Use This Skill

- Building or modifying mail server features (accounts, domains, queue, DKIM, spam)
- Implementing CalDAV calendar integration
- Implementing CardDAV contacts integration
- Implementing WebDAV file storage integration
- Managing Stalwart Docker container lifecycle
- Configuring feature flags for collaboration modules
- Building subscription billing for mail tiers
- Creating monitoring dashboards for mail server metrics
- Handling DNS record generation and validation
- Implementing user provisioning sync

## Architecture Overview

```
Client Dashboard (React, port 48080)
    |  React Query hooks
    v
tRPC Proxy Routers (mail, calendar, contacts, files, stalwart-admin)
    |  HTTP requests
    |--- REST API: /api/* (principals, queue, DKIM, spam, reports, settings, telemetry)
    '--- DAV Protocols: /dav/* (CalDAV, CardDAV, WebDAV)
    |
    v
Stalwart Mail Server (Docker: serverless-stalwart, port 18080->8080)
    |
    v
SMTP (25) / Submission (587) / IMAPS (993) / CalDAV / CardDAV / WebDAV
```

## Four Feature Modules

| Module | Feature Flag | tRPC Router | Protocol | Icon |
|--------|-------------|-------------|----------|------|
| Mail | `email_server` | `mail` | REST API | `Mail` |
| Calendar | `calendar` | `calendar` | CalDAV | `Calendar` |
| Contacts | `contacts` | `contacts` | CardDAV | `Users` |
| Files | `file_storage` | `files` | WebDAV | `FolderOpen` |

All under "Collaboration" sidebar section (hidden when all flags disabled).

## Docker Container Configuration

| Property | Value |
|----------|-------|
| Image | `stalwartlabs/stalwart:latest` |
| Container | `serverless-stalwart` |
| Network | `serverless-network` |
| Profile | `mail` (opt-in, NOT started by default) |
| Volume | `stalwart_data:/opt/stalwart` |
| Memory/CPU | 1G / 1.0 (reserve 256M / 0.25) |

### Port Mappings

| Protocol | Container Port | Host Default | Env Var |
|----------|---------------|-------------|---------|
| SMTP | 25 | 25 | `STALWART_SMTP_PORT` |
| Submission | 587 | 587 | `STALWART_SUBMISSION_PORT` |
| IMAPS | 993 | 993 | `STALWART_IMAPS_PORT` |
| HTTP API | 8080 | 18080 | `STALWART_HTTP_PORT` |

### Makefile Commands

| Command | Purpose |
|---------|---------|
| `make start-mail` | Start Stalwart (profile: mail) |
| `make stop-mail` | Stop Stalwart |
| `make logs-mail` | View Stalwart logs |
| `make shell-stalwart` | Interactive shell in container |

### Docker Compose Entry

```yaml
stalwart:
  image: stalwartlabs/stalwart:latest
  container_name: serverless-stalwart
  profiles: ["mail"]
  networks:
    - serverless-network
  ports:
    - "${STALWART_SMTP_PORT:-25}:25"
    - "${STALWART_SUBMISSION_PORT:-587}:587"
    - "${STALWART_IMAPS_PORT:-993}:993"
    - "${STALWART_HTTP_PORT:-18080}:8080"
  volumes:
    - stalwart_data:/opt/stalwart
  deploy:
    resources:
      limits:
        memory: 1G
        cpus: "1.0"
      reservations:
        memory: 256M
        cpus: "0.25"
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8080/healthz"]
    interval: 30s
    timeout: 10s
    retries: 3
  restart: unless-stopped
```

### FORBIDDEN Docker Patterns

- External mail services (SendGrid, SES, Mailgun) as replacements
- Host volume mounts for mail data
- `dokploy-*` container naming
- Admin token in `.env` file
- Running Stalwart outside Docker network

## Stalwart REST API Reference

**Base URL**: `http://serverless-stalwart:8080/api`
**Auth**: Bearer token (encrypted in DB, NEVER in `.env`, NEVER logged)
**Response format**: `{ data: { items: [...], total: N } }`
**Error format**: `{ type, status, title, detail }` or `{ error, field?, value?, details? }`

### HTTP Client Pattern

```typescript
// serverlessbase/packages/server/src/utils/stalwart/client.ts
export class StalwartClient {
  private baseUrl: string;
  private token: string;

  async request<T>(path: string, options?: RequestOptions): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    if (!response.ok) {
      throw new StalwartApiError(response.status, await response.json());
    }
    return response.json();
  }
}
```

### Principal Management (`/api/principal`)

Principals are the core identity objects: individual accounts, groups, domains, and mailing lists.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/principal` | List principals (query: `?type=individual&filter=search`) |
| GET | `/api/principal/{name}` | Get single principal |
| POST | `/api/principal` | Create principal |
| PATCH | `/api/principal/{name}` | Update principal (array-of-patches format) |
| DELETE | `/api/principal/{name}` | Delete principal |

**IMPORTANT**: Updates use PATCH with array-of-patches format:

```typescript
// CORRECT - Array of patch operations
await client.request(`/api/principal/${name}`, {
  method: 'PATCH',
  body: JSON.stringify([
    { action: 'set', field: 'description', value: 'New description' },
    { action: 'addItem', field: 'emails', value: 'alias@example.com' },
    { action: 'removeItem', field: 'memberOf', value: 'old-group' },
  ]),
});

// WRONG - PUT with full object
await client.request(`/api/principal/${name}`, {
  method: 'PUT',
  body: JSON.stringify({ description: 'New description' }),
});
```

#### Principal Types

| Type | Stalwart Value | Purpose |
|------|---------------|---------|
| Individual | `individual` | Email account (user) |
| Group | `group` | Group of individuals |
| Domain | `domain` | Email domain |
| List | `list` | Mailing list |
| Tenant | `tenant` | Multi-tenant isolation |
| API Key | `apiKey` | API access token |

#### Principal Schema

```typescript
interface StalwartPrincipal {
  name: string;            // Unique identifier
  type: PrincipalType;
  description?: string;
  emails: string[];        // Email addresses
  memberOf: string[];      // Groups this principal belongs to
  members: string[];       // Members (for groups/lists)
  quota: number;           // Storage quota in bytes
  secrets: string[];       // Passwords (hashed)
  roles: string[];         // admin, user, tenant-admin
  enabledPermissions: string[];
  disabledPermissions: string[];
  picture?: string;        // Base64 avatar
}
```

### Queue Management (`/api/queue`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/queue/messages` | List queued messages |
| GET | `/api/queue/messages/{id}` | Get message details |
| PATCH | `/api/queue/messages/{id}` | Retry or cancel message |
| DELETE | `/api/queue/messages/{id}` | Remove from queue |
| GET | `/api/queue/status` | Get queue status (running/paused) |
| PATCH | `/api/queue/status` | Start or stop queue |

### DKIM Signatures (`/api/dkim`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/dkim` | Create DKIM signature |
| GET | `/api/dkim/{id}` | Get DKIM signature |
| DELETE | `/api/dkim/{id}` | Delete DKIM signature |
| GET | `/api/dns/records/{domain}` | Get required DNS records |

### Spam Filter (`/api/spam-filter`)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/spam-filter/train` | Train spam/ham classifier |
| POST | `/api/spam-filter/classify` | Classify message |
| GET | `/api/spam-filter/settings` | Get filter settings |
| POST | `/api/spam-filter/settings` | Update filter settings |

### Reports (`/api/reports`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/reports/dmarc` | DMARC aggregate reports |
| GET | `/api/reports/tls-rpt` | TLS-RPT reports |
| GET | `/api/reports/arf` | Abuse feedback reports |
| GET | `/api/reports/{type}/{id}` | Individual report details |

### Settings (`/api/settings`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/settings/group/{prefix}` | Get settings group |
| POST | `/api/settings` | Update settings |
| DELETE | `/api/settings/keys` | Delete settings keys |

### Telemetry (`/api/telemetry`)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/telemetry/metrics` | Prometheus-format metrics |
| GET | `/api/telemetry/traces` | Recent trace spans |
| GET | `/api/telemetry/live/tracing` | SSE live trace stream |
| GET | `/api/healthz` | Health check endpoint |

## DAV Protocol Operations

Calendar, contacts, and files use WebDAV-based protocols (NOT REST). These require XML request/response bodies and specific HTTP methods.

### DAV Client Pattern

```typescript
// serverlessbase/packages/server/src/utils/stalwart/davClient.ts
export class StalwartDavClient {
  async davRequest(
    path: string,
    method: 'PROPFIND' | 'REPORT' | 'MKCOL' | 'PUT' | 'DELETE' | 'MOVE' | 'COPY' | 'GET',
    body?: string,
    headers?: Record<string, string>
  ): Promise<DavResponse> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': method === 'PUT' ? 'text/calendar' : 'application/xml; charset=utf-8',
        Depth: '1',
        ...headers,
      },
      body,
    });
    return this.parseDavResponse(response);
  }
}
```

### CalDAV Operations (`/dav/calendars/{account}/`)

| Method | Purpose | Body |
|--------|---------|------|
| PROPFIND | List calendars or events | XML propfind body |
| MKCOL | Create calendar collection | XML mkcol body |
| PUT | Create/update event | iCalendar (text/calendar) |
| DELETE | Delete calendar or event | None |
| REPORT | Query events by date range | XML calendar-query body |

#### iCalendar Event Format

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//ServerlessBase//Calendar//EN
BEGIN:VEVENT
UID:unique-event-id@serverlessbase.com
DTSTART:20240115T090000Z
DTEND:20240115T100000Z
SUMMARY:Team Meeting
DESCRIPTION:Weekly sync meeting
LOCATION:Conference Room A
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR
```

### CardDAV Operations (`/dav/contacts/{account}/`)

| Method | Purpose | Body |
|--------|---------|------|
| PROPFIND | List address books or contacts | XML propfind body |
| MKCOL | Create address book | XML mkcol body |
| PUT | Create/update contact | vCard (text/vcard) |
| DELETE | Delete address book or contact | None |
| REPORT | Query contacts | XML addressbook-query body |

#### vCard Format

```
BEGIN:VCARD
VERSION:4.0
FN:John Doe
N:Doe;John;;;
EMAIL;TYPE=work:john@example.com
TEL;TYPE=cell:+1-555-0123
ORG:Example Corp
TITLE:Engineer
END:VCARD
```

### WebDAV Operations (`/dav/files/{account}/`)

| Method | Purpose | Body |
|--------|---------|------|
| PROPFIND | List files/directories | XML propfind body |
| MKCOL | Create directory | None |
| PUT | Upload file | File binary content |
| GET | Download file | None |
| DELETE | Delete file/directory | None |
| MOVE | Move/rename file | Destination header |
| COPY | Copy file | Destination header |

## Database Schema

### stalwart_config (Singleton)

```typescript
export const stalwartConfig = pgTable("stalwart_config", {
  id: text("id").primaryKey().default("singleton"),
  apiUrl: text("apiUrl").notNull().default("http://serverless-stalwart:8080"),
  encryptedToken: text("encryptedToken"),       // AES-256-GCM encrypted
  connectionStatus: text("connectionStatus").default("disconnected"),
  lastCheckedAt: timestamp("lastCheckedAt"),
  version: text("version"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
```

### mail_subscription (Per-User)

```typescript
export const mailSubscription = pgTable("mail_subscription", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().references(() => user.id),
  tier: stalwartTierEnum("tier").notNull().default("free"),
  stripeCustomerId: text("stripeCustomerId"),
  stripeSubscriptionId: text("stripeSubscriptionId"),
  currentMailboxCount: integer("currentMailboxCount").default(0),
  currentStorageBytes: bigint("currentStorageBytes", { mode: "number" }).default(0),
  graceExpiresAt: timestamp("graceExpiresAt"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
```

### stalwart_usage (Per-User Per-Period)

```typescript
export const stalwartUsage = pgTable("stalwart_usage", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().references(() => user.id),
  period: text("period").notNull(),            // YYYY-MM format
  mailboxCount: integer("mailboxCount").default(0),
  storageBytes: bigint("storageBytes", { mode: "number" }).default(0),
  emailsSent: integer("emailsSent").default(0),
  emailsReceived: integer("emailsReceived").default(0),
  calendarCount: integer("calendarCount").default(0),
  contactCount: integer("contactCount").default(0),
  fileStorageBytes: bigint("fileStorageBytes", { mode: "number" }).default(0),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
```

### stalwart_limits_config (Per-Tier)

```typescript
export const stalwartLimitsConfig = pgTable("stalwart_limits_config", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  tier: stalwartTierEnum("tier").notNull().unique(),
  maxMailboxes: integer("maxMailboxes").notNull(),
  maxStorageBytes: bigint("maxStorageBytes", { mode: "number" }).notNull(),
  maxEmailsPerDay: integer("maxEmailsPerDay"),  // null = unlimited
  maxCalendars: integer("maxCalendars"),
  maxContacts: integer("maxContacts"),
  maxFileStorageBytes: bigint("maxFileStorageBytes", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
```

### stalwart_user_limits (Per-User Overrides)

```typescript
export const stalwartUserLimits = pgTable("stalwart_user_limits", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull().references(() => user.id).unique(),
  maxMailboxes: integer("maxMailboxes"),
  maxStorageBytes: bigint("maxStorageBytes", { mode: "number" }),
  maxEmailsPerDay: integer("maxEmailsPerDay"),
  maxCalendars: integer("maxCalendars"),
  maxContacts: integer("maxContacts"),
  maxFileStorageBytes: bigint("maxFileStorageBytes", { mode: "number" }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow(),
});
```

### mail_sync_log (Provisioning Audit)

```typescript
export const mailSyncLog = pgTable("mail_sync_log", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("userId").notNull(),
  action: text("action").notNull(),          // create, update, delete
  status: text("status").notNull(),          // success, failed, retrying
  attempts: integer("attempts").default(1),
  errorMessage: text("errorMessage"),
  payload: jsonb("payload"),
  createdAt: timestamp("createdAt").defaultNow(),
  resolvedAt: timestamp("resolvedAt"),
});
```

## Subscription Tiers

| Tier | Mailboxes | Storage | Emails/Day | Calendars | Contacts | File Storage | Price |
|------|-----------|---------|-----------|-----------|----------|-------------|-------|
| Free | 5 | 1 GB | 50 | 2 | 100 | 500 MB | $0/mo |
| Pro | 50 | 10 GB | Unlimited | Unlimited | Unlimited | 5 GB | $29/mo |
| Enterprise | Unlimited | 100 GB | Unlimited | Unlimited | Unlimited | 50 GB | $99/mo |

### Enforcement Rules

- Check limits BEFORE creating resources (not after)
- Grace period: 7 days on downgrade
- Excess resources are disabled (NEVER deleted)
- Disable order: FIFO (oldest excess first)
- Show upgrade CTA in error messages
- Stripe products: `serverlessbase_mail_pro`, `serverlessbase_mail_enterprise`

### Limit Check Pattern

```typescript
async function assertWithinLimits(
  userId: string,
  resource: 'mailbox' | 'calendar' | 'contact' | 'fileStorage',
  additionalAmount: number = 1
): Promise<void> {
  const subscription = await getSubscription(userId);
  const usage = await getCurrentUsage(userId);
  const limits = await getEffectiveLimits(userId, subscription.tier);

  const currentUsage = usage[resourceToField[resource]];
  const limit = limits[resourceToLimit[resource]];

  if (limit !== null && currentUsage + additionalAmount > limit) {
    throw limitExceededError(ctx.t, resource, {
      current: currentUsage,
      max: limit,
      tier: subscription.tier,
    });
  }
}
```

## Feature Flag Configuration

All four flags defined in `client/src/lib/features/platform-features.ts`:

```typescript
export const PLATFORM_FEATURES = {
  // ... existing features
  EMAIL_SERVER: 'email_server',
  CALENDAR: 'calendar',
  CONTACTS: 'contacts',
  FILE_STORAGE: 'file_storage',
};
```

### 3-Tier Resolution

1. Code default (`defaultEnabled: false`)
2. Global DB override (superadmin toggle)
3. Per-user/org override

### Backend Enforcement

```typescript
// In every tRPC procedure
.mutation(async ({ ctx, input }) => {
  await assertFeatureEnabled(ctx, 'email_server');
  // ... procedure logic
});
```

### Frontend Route Gating

```typescript
export const Route = createFileRoute('/dashboard/mail')({
  beforeLoad: async ({ context }) => {
    const flags = await context.featureFlags;
    if (!flags.email_server) {
      throw redirect({ to: '/dashboard' });
    }
  },
  component: MailPage,
});
```

### Sidebar Visibility

```typescript
// Collaboration section hidden when ALL flags disabled
const showCollaboration = featureFlags.email_server ||
  featureFlags.calendar ||
  featureFlags.contacts ||
  featureFlags.file_storage;
```

## User Provisioning Sync

Sync via better-auth lifecycle events:

| Event | Stalwart API Call |
|-------|-----------------|
| `user.created` | `POST /api/principal` (type: individual) |
| `user.deleted` | `DELETE /api/principal/{name}` |
| `user.updated` (email) | `PATCH /api/principal/{name}` (update emails) |
| `user.updated` (name) | `PATCH /api/principal/{name}` (update description) |

### Provisioning Rules

- Failures MUST NOT block user creation (log and retry)
- Log all attempts to `mail_sync_log`
- Exponential backoff: max 5 retries
- Idempotent: re-running is safe
- Skip entirely when `email_server` feature flag is disabled

```typescript
async function provisionMailAccount(user: User): Promise<void> {
  if (!await isFeatureEnabled('email_server')) return;

  try {
    await stalwartClient.request('/api/principal', {
      method: 'POST',
      body: JSON.stringify({
        name: user.email.split('@')[0],
        type: 'individual',
        description: user.name,
        emails: [user.email],
        quota: DEFAULT_QUOTA_BYTES,
      }),
    });

    await logSync(user.id, 'create', 'success');
  } catch (error) {
    await logSync(user.id, 'create', 'failed', error.message);
    await scheduleRetry(user.id, 'create', { delay: calculateBackoff(1) });
  }
}
```

## tRPC Router Structure

### Mail Router (`mail.ts`)

```typescript
export const mailRouter = createTRPCRouter({
  // Principal management
  'principal.list': protectedProcedure
    .input(z.object({ type: z.string().optional(), filter: z.string().optional() }))
    .query(/* ... */),
  'principal.one': protectedProcedure
    .input(z.object({ name: z.string() }))
    .query(/* ... */),
  'principal.create': protectedProcedure
    .input(createPrincipalSchema)
    .mutation(/* ... */),
  'principal.update': protectedProcedure
    .input(updatePrincipalSchema)
    .mutation(/* ... */),
  'principal.delete': protectedProcedure
    .input(z.object({ name: z.string() }))
    .mutation(/* ... */),

  // Queue management
  'queue.list': protectedProcedure.query(/* ... */),
  'queue.one': protectedProcedure.input(z.object({ id: z.string() })).query(/* ... */),
  'queue.cancel': protectedProcedure.input(z.object({ id: z.string() })).mutation(/* ... */),
  'queue.retry': protectedProcedure.input(z.object({ id: z.string() })).mutation(/* ... */),
  'queue.start': protectedProcedure.mutation(/* ... */),
  'queue.stop': protectedProcedure.mutation(/* ... */),
  'queue.status': protectedProcedure.query(/* ... */),

  // DKIM
  'dkim.list': protectedProcedure.query(/* ... */),
  'dkim.create': protectedProcedure.input(createDkimSchema).mutation(/* ... */),
  'dkim.one': protectedProcedure.input(z.object({ id: z.string() })).query(/* ... */),
  'dkim.delete': protectedProcedure.input(z.object({ id: z.string() })).mutation(/* ... */),
  'dkim.dnsRecord': protectedProcedure.input(z.object({ domain: z.string() })).query(/* ... */),

  // Spam
  'spam.train': protectedProcedure.input(spamTrainSchema).mutation(/* ... */),
  'spam.classify': protectedProcedure.input(z.object({ message: z.string() })).mutation(/* ... */),
  'spam.settings': protectedProcedure.query(/* ... */),
  'spam.updateSettings': protectedProcedure.input(spamSettingsSchema).mutation(/* ... */),

  // Reports
  'report.dmarc': protectedProcedure.query(/* ... */),
  'report.tls': protectedProcedure.query(/* ... */),
  'report.arf': protectedProcedure.query(/* ... */),
  'report.one': protectedProcedure
    .input(z.object({ type: z.string(), id: z.string() }))
    .query(/* ... */),
});
```

### Calendar Router (`calendar.ts`)

```typescript
export const calendarRouter = createTRPCRouter({
  'calendar.list': protectedProcedure.query(/* ... */),
  'calendar.create': protectedProcedure.input(createCalendarSchema).mutation(/* ... */),
  'calendar.delete': protectedProcedure
    .input(z.object({ calendarId: z.string() }))
    .mutation(/* ... */),
  'event.list': protectedProcedure
    .input(z.object({
      calendarId: z.string(),
      start: z.string().optional(),
      end: z.string().optional(),
    }))
    .query(/* ... */),
  'event.create': protectedProcedure.input(createEventSchema).mutation(/* ... */),
  'event.update': protectedProcedure.input(updateEventSchema).mutation(/* ... */),
  'event.delete': protectedProcedure
    .input(z.object({ calendarId: z.string(), eventId: z.string() }))
    .mutation(/* ... */),
});
```

### Contacts Router (`contacts.ts`)

```typescript
export const contactsRouter = createTRPCRouter({
  'addressBook.list': protectedProcedure.query(/* ... */),
  'addressBook.create': protectedProcedure
    .input(createAddressBookSchema)
    .mutation(/* ... */),
  'addressBook.delete': protectedProcedure
    .input(z.object({ addressBookId: z.string() }))
    .mutation(/* ... */),
  'contact.list': protectedProcedure
    .input(z.object({ addressBookId: z.string() }))
    .query(/* ... */),
  'contact.create': protectedProcedure.input(createContactSchema).mutation(/* ... */),
  'contact.update': protectedProcedure.input(updateContactSchema).mutation(/* ... */),
  'contact.delete': protectedProcedure
    .input(z.object({ addressBookId: z.string(), contactId: z.string() }))
    .mutation(/* ... */),
  'contact.import': protectedProcedure
    .input(z.object({ addressBookId: z.string(), vcards: z.string() }))
    .mutation(/* ... */),
  'contact.export': protectedProcedure
    .input(z.object({ addressBookId: z.string() }))
    .query(/* ... */),
});
```

### Files Router (`files.ts`)

```typescript
export const filesRouter = createTRPCRouter({
  'file.list': protectedProcedure
    .input(z.object({ path: z.string().default('/') }))
    .query(/* ... */),
  'file.upload': protectedProcedure.input(uploadFileSchema).mutation(/* ... */),
  'file.download': protectedProcedure
    .input(z.object({ path: z.string() }))
    .query(/* ... */),
  'file.delete': protectedProcedure
    .input(z.object({ path: z.string() }))
    .mutation(/* ... */),
  'file.move': protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(/* ... */),
  'file.copy': protectedProcedure
    .input(z.object({ from: z.string(), to: z.string() }))
    .mutation(/* ... */),
  'directory.create': protectedProcedure
    .input(z.object({ path: z.string() }))
    .mutation(/* ... */),
  'directory.delete': protectedProcedure
    .input(z.object({ path: z.string() }))
    .mutation(/* ... */),
  'usage.current': protectedProcedure.query(/* ... */),
});
```

### Stalwart Admin Router (`stalwart-admin.ts`)

```typescript
export const stalwartAdminRouter = createTRPCRouter({
  'admin.config': adminProcedure.query(/* ... */),
  'admin.updateConfig': adminProcedure.input(updateConfigSchema).mutation(/* ... */),
  'admin.reload': adminProcedure.mutation(/* ... */),
  'admin.status': adminProcedure.query(/* ... */),
  'admin.logs': adminProcedure
    .input(z.object({ limit: z.number().default(100) }))
    .query(/* ... */),
  'admin.telemetry': adminProcedure.query(/* ... */),
  'dns.check': adminProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(/* ... */),
  'dns.records': adminProcedure
    .input(z.object({ domain: z.string() }))
    .query(/* ... */),
  'ssl.status': adminProcedure
    .input(z.object({ domain: z.string() }))
    .query(/* ... */),
  'ssl.request': adminProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(/* ... */),
  'ssl.renew': adminProcedure
    .input(z.object({ domain: z.string() }))
    .mutation(/* ... */),
});
```

## React Query Key Factory

Location: `client/src/hooks/stalwart/queryKeys.ts`

```typescript
export const stalwartKeys = {
  all: ['stalwart'] as const,

  principals: {
    all: () => [...stalwartKeys.all, 'principals'] as const,
    lists: (type?: string) => [...stalwartKeys.principals.all(), 'list', type] as const,
    detail: (name: string) => [...stalwartKeys.principals.all(), 'detail', name] as const,
  },

  queue: {
    all: () => [...stalwartKeys.all, 'queue'] as const,
    lists: () => [...stalwartKeys.queue.all(), 'list'] as const,
    detail: (id: string) => [...stalwartKeys.queue.all(), 'detail', id] as const,
    status: () => [...stalwartKeys.queue.all(), 'status'] as const,
  },

  dkim: {
    all: () => [...stalwartKeys.all, 'dkim'] as const,
    lists: () => [...stalwartKeys.dkim.all(), 'list'] as const,
    detail: (id: string) => [...stalwartKeys.dkim.all(), 'detail', id] as const,
    dnsRecord: (domain: string) => [...stalwartKeys.dkim.all(), 'dns', domain] as const,
  },

  spam: {
    all: () => [...stalwartKeys.all, 'spam'] as const,
    settings: () => [...stalwartKeys.spam.all(), 'settings'] as const,
  },

  reports: {
    all: () => [...stalwartKeys.all, 'reports'] as const,
    dmarc: () => [...stalwartKeys.reports.all(), 'dmarc'] as const,
    tls: () => [...stalwartKeys.reports.all(), 'tls'] as const,
    arf: () => [...stalwartKeys.reports.all(), 'arf'] as const,
    detail: (type: string, id: string) => [...stalwartKeys.reports.all(), type, id] as const,
  },

  calendar: {
    all: () => [...stalwartKeys.all, 'calendar'] as const,
    lists: () => [...stalwartKeys.calendar.all(), 'list'] as const,
    detail: (id: string) => [...stalwartKeys.calendar.all(), 'detail', id] as const,
    events: (calendarId: string) => [...stalwartKeys.calendar.all(), 'events', calendarId] as const,
  },

  contacts: {
    all: () => [...stalwartKeys.all, 'contacts'] as const,
    lists: () => [...stalwartKeys.contacts.all(), 'list'] as const,
    detail: (id: string) => [...stalwartKeys.contacts.all(), 'detail', id] as const,
    addressBooks: () => [...stalwartKeys.contacts.all(), 'addressBooks'] as const,
  },

  files: {
    all: () => [...stalwartKeys.all, 'files'] as const,
    lists: (path: string) => [...stalwartKeys.files.all(), 'list', path] as const,
    detail: (id: string) => [...stalwartKeys.files.all(), 'detail', id] as const,
  },

  admin: {
    all: () => [...stalwartKeys.all, 'admin'] as const,
    status: () => [...stalwartKeys.admin.all(), 'status'] as const,
    config: () => [...stalwartKeys.admin.all(), 'config'] as const,
    telemetry: () => [...stalwartKeys.admin.all(), 'telemetry'] as const,
    logs: () => [...stalwartKeys.admin.all(), 'logs'] as const,
  },

  usage: {
    all: () => [...stalwartKeys.all, 'usage'] as const,
    current: () => [...stalwartKeys.usage.all(), 'current'] as const,
    limits: () => [...stalwartKeys.usage.all(), 'limits'] as const,
    history: (period?: string) => [...stalwartKeys.usage.all(), 'history', period] as const,
  },

  subscription: {
    all: () => [...stalwartKeys.all, 'subscription'] as const,
    current: () => [...stalwartKeys.subscription.all(), 'current'] as const,
  },

  config: {
    all: () => [...stalwartKeys.all, 'config'] as const,
    connection: () => [...stalwartKeys.config.all(), 'connection'] as const,
  },
};
```

**ALWAYS use factory. NEVER ad-hoc keys.**

## Frontend Service Layer

```typescript
// client/src/services/stalwart/mailService.ts
import { trpcQuery, trpcMutation } from '@/lib/api/dokploy';

export const StalwartMailService = {
  // Principals
  listAccounts: (filter?: string, type?: string) =>
    trpcQuery('mail', 'principal.list', { filter, type }),
  getAccount: (name: string) =>
    trpcQuery('mail', 'principal.one', { name }),
  createAccount: (data: CreatePrincipalInput) =>
    trpcMutation('mail', 'principal.create', data),
  updateAccount: (name: string, patches: PatchOperation[]) =>
    trpcMutation('mail', 'principal.update', { name, patches }),
  deleteAccount: (name: string) =>
    trpcMutation('mail', 'principal.delete', { name }),

  // Queue
  listQueue: () => trpcQuery('mail', 'queue.list'),
  getQueueMessage: (id: string) => trpcQuery('mail', 'queue.one', { id }),
  cancelMessage: (id: string) => trpcMutation('mail', 'queue.cancel', { id }),
  retryMessage: (id: string) => trpcMutation('mail', 'queue.retry', { id }),
  startQueue: () => trpcMutation('mail', 'queue.start'),
  stopQueue: () => trpcMutation('mail', 'queue.stop'),
  getQueueStatus: () => trpcQuery('mail', 'queue.status'),

  // DKIM
  listDkim: () => trpcQuery('mail', 'dkim.list'),
  createDkim: (data: CreateDkimInput) => trpcMutation('mail', 'dkim.create', data),
  deleteDkim: (id: string) => trpcMutation('mail', 'dkim.delete', { id }),
  getDnsRecord: (domain: string) => trpcQuery('mail', 'dkim.dnsRecord', { domain }),

  // Spam
  trainSpam: (data: SpamTrainInput) => trpcMutation('mail', 'spam.train', data),
  classifyMessage: (message: string) => trpcMutation('mail', 'spam.classify', { message }),
  getSpamSettings: () => trpcQuery('mail', 'spam.settings'),
  updateSpamSettings: (data: SpamSettingsInput) =>
    trpcMutation('mail', 'spam.updateSettings', data),

  // Reports
  getDmarcReports: () => trpcQuery('mail', 'report.dmarc'),
  getTlsReports: () => trpcQuery('mail', 'report.tls'),
  getArfReports: () => trpcQuery('mail', 'report.arf'),
  getReport: (type: string, id: string) => trpcQuery('mail', 'report.one', { type, id }),
};
```

## Mail Sub-Navigation Tabs

| Tab | URL Query | Purpose |
|-----|-----------|---------|
| Dashboard | `?tab=dashboard` | Overview metrics, connection status |
| Accounts | `?tab=accounts` | User/group/domain/list management |
| Domains | `?tab=domains` | Domain management with DNS/SSL |
| Queue | `?tab=queue` | SMTP queue monitoring and control |
| Spam | `?tab=spam` | Spam filter settings and training |
| Reports | `?tab=reports` | DMARC, TLS-RPT, ARF reports |
| DKIM | `?tab=dkim` | DKIM signature management |
| Logs | `?tab=logs` | Server logs viewer |
| Settings | `?tab=settings` | SMTP/IMAP/JMAP configuration |

URL tab state is mandatory (validateSearch + navigate with replace: true).

## Monitoring Charts

| Chart | Type | Data Source |
|-------|------|-------------|
| Connection History | Line (Recharts) | SMTP, IMAP, JMAP connections over time |
| Delivery Rate | Area (Recharts) | Delivered, bounced, rejected per hour |
| Queue Depth | Bar (Recharts) | Pending, deferred, failed messages |
| Resource Usage | Area (Recharts) | CPU and memory over time |
| Storage by Account | Bar (Recharts) | Top accounts by storage usage |

## DNS Record Requirements

| Record | Type | Host | Purpose |
|--------|------|------|---------|
| MX | MX | `@` | Mail routing (priority 10) |
| SPF | TXT | `@` | Sender authorization (`v=spf1 mx a -all`) |
| DKIM | TXT | `{selector}._domainkey` | Email authentication |
| DMARC | TXT | `_dmarc` | Policy enforcement (`v=DMARC1; p=quarantine`) |
| PTR | PTR | (IP-based) | Reverse DNS lookup |
| autoconfig | CNAME | `autoconfig` | Automatic client configuration |

### DNS Wizard Flow

1. Enter domain name
2. Show required records (with copy-to-clipboard buttons)
3. Auto-check DNS propagation every 30 seconds
4. Show confirmation when all records verified
5. Link to SSL certificate request after DNS validation

## Superadmin Page

Route: `/_app/_superadmin/superadmin/_layout.stalwart.tsx`

### 5 Tabs

| Tab | Content |
|-----|---------|
| Overview | Connection status, total accounts, storage usage, queue health |
| Per-User Usage | Table of all users with mailbox count, storage, emails sent |
| Trends | Charts: signups over time, storage growth, email volume |
| Cost Estimation | Revenue projection based on tier distribution |
| Limits | Configure per-tier limits, add per-user overrides |

SEPARATE from WebSmith superadmin (own tables, services, hooks, query keys).

## Security Rules

### Token Management

- Admin token encrypted at rest via `encrypt()` / `decrypt()`
- Token stored in `stalwart_config.encryptedToken` column
- NEVER stored in `.env` file
- NEVER returned unmasked in API responses
- NEVER logged
- Admin-only access (`adminProcedure`)
- Rotation: new token replaces old, connection re-verified

### Path Traversal Prevention

```typescript
// ALWAYS sanitize file paths
function sanitizePath(path: string): string {
  const normalized = posix.normalize(path);
  if (normalized.includes('..')) {
    throw new Error('Path traversal not allowed');
  }
  return normalized;
}
```

### Credential Masking

```typescript
// When returning principal data to frontend
function maskPrincipal(principal: StalwartPrincipal): SafePrincipal {
  return {
    ...principal,
    secrets: principal.secrets.map(() => '********'),
  };
}
```

## i18n Translation Namespaces

| Namespace | Estimated Keys | Content |
|-----------|---------------|---------|
| `mail` | ~150 | Accounts, domains, queue, spam, reports, DKIM, DNS, SSL |
| `calendar` | ~60 | Calendars, events, scheduling, reminders |
| `contacts` | ~50 | Contact lists, address books, import/export |
| `files` | ~45 | File browser, upload, sharing, storage |
| `stalwart` | ~30 | Superadmin usage, limits, configuration |

All 5 languages required: en, ar, fr, de, es.

Navigation keys in `common.json` under `nav.collaboration`, `nav.mail.*`.

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| "Mail server unreachable" | Container not running | `make start-mail` |
| 401 on API calls | Token expired/invalid | Rotate token in superadmin settings |
| Principal already exists | Duplicate name | Check existing principals first |
| 507 on file upload | Storage quota exceeded | Upgrade tier or free space |
| DNS records not verified | Propagation delay | Wait 24-48 hours, then re-check |
| DKIM validation failed | Wrong DNS TXT record | Copy exact record from dashboard |
| Calendar events missing | Wrong date range in filter | Expand date range |
| vCard import failed | Invalid format | Ensure vCard 3.0 or 4.0 format |
| Queue stuck | Queue paused | Click "Start Queue" button |
| Spam false positive | ML model needs training | Train as Ham in spam filter |
| Feature disabled | Flag not enabled | Enable in superadmin feature flags |
| Grace period active | Downgraded recently | Wait for grace period or upgrade |
| Path traversal blocked | `../` in file path | Use clean paths without `..` |
| Token not configured | First-time setup | Configure in superadmin > API Keys |
| Container unhealthy | Port conflict or OOM | Check `make logs-mail` for errors |

## Common Issues & Troubleshooting (Production)

### Health Check Returns All "Error"

**Symptoms**: Dashboard shows Server/SMTP/IMAP all as "Error" status.

**Causes**:
1. Stalwart container not running
2. Admin token invalid (ENCRYPTION_KEY changed or token corrupted)
3. API endpoint unreachable (Docker network issue)

**Diagnostic steps**:
1. `docker ps --filter name=serverless-stalwart` — is the container running?
2. `docker exec serverless-stalwart curl -sf http://localhost:8080/api/healthz` — is the API responsive?
3. Check `stalwart_config.connectionStatus` in the database
4. If API responds but dashboard shows error, the admin token may be invalid — check `stalwart_config` table encryption

**Fix**:
- Container not running → `make start-mail`
- Token invalid → Re-enter token in superadmin settings; if ENCRYPTION_KEY rotated, all encrypted tokens must be re-entered
- Network issue → verify `serverless-stalwart` is on `serverless-network`: `docker network inspect serverless-network`

### DKIM List Returns 404

**Symptoms**: `/dashboard/mail?tab=dkim` shows an error or empty state unexpectedly.

**Causes**:
1. No DKIM keys generated yet (eager provisioning hasn't run)
2. Stalwart container not running
3. Admin token invalid

**Fix**: Eager provisioning (`initStalwartProvisioning`) auto-generates DKIM keys for all configured mail domains on startup. If still failing:
- Verify `listDkim()` gracefully returns an empty array on 404 (not throws)
- Manually trigger provisioning or restart main-app to re-run startup provisioning
- Check `mail_sync_log` table for provisioning errors

### Calendar/Contacts/Files Create Returns 404

**Symptoms**: CalDAV, CardDAV, or WebDAV operations fail with 404 errors.

**Causes**:
1. User principal not provisioned in Stalwart
2. DAV home directory not created for the user

**Fix**: The `ensureUserProvisioned()` guard MUST be called before any DAV mutation. This guard:
1. Checks if the user principal exists in Stalwart
2. Creates it if missing
3. Creates DAV home directories (calendar, contacts, files) via MKCOL
4. Retries MKCOL on 404 (parent collection may need creation first)

If the guard is in place but still failing, check:
- `mail_sync_log` for provisioning errors
- Stalwart container logs: `make logs-mail`
- Whether the user's email is valid for principal creation

### Cloudflare DNS Sync Authentication Error

**Symptoms**: `dnsProvider.domain.sync` returns `[10000] Authentication error` from Cloudflare API.

**Causes**:
1. `ENCRYPTION_KEY` changed — encrypted API token decrypts to garbage
2. Wrong credential field name stored (`token` instead of `apiToken`)
3. API token permissions insufficient (needs Zone:DNS:Edit)

**Diagnostic**: Use `provider.diagnose` procedure to check:
- `decryptOk` — can credentials be decrypted?
- `fieldsOk` — do decrypted credentials have the expected `apiToken` field?
- `connectionOk` — can we reach the Cloudflare API?

**Fix**:
- If `decryptOk: false` → ENCRYPTION_KEY rotated; user must re-enter the API token
- If `fieldsOk: false` → credential field mismatch; re-enter token via "Re-enter Token" UX
- If `connectionOk: false` → token revoked or permissions wrong; generate new token in Cloudflare dashboard

### Health Check Granularity Issues

**Symptoms**: SMTP shows "running" but email delivery fails, or IMAP shows "running" but clients can't connect.

**Cause**: Health check only checks HTTP API, not individual protocol ports.

**Fix**: `getDashboardHealth()` MUST check SMTP (port 25) and IMAP (port 993) independently via TCP port checks, not infer status from the HTTP API health endpoint. The five distinct states are:
- `running` — container up + API healthy
- `stopped` — Docker container not running
- `unreachable` — container running but API fails
- `auth_error` — token rejected (401/403)
- `error` — unknown failure

## File Location Reference

| Layer | Location |
|-------|----------|
| **Backend Routers** | `serverlessbase/apps/serverlessbase/server/api/routers/{mail,calendar,contacts,files,stalwart-admin,mail-subscription,stalwart-sync}.ts` |
| **Backend Services** | `serverlessbase/packages/server/src/services/stalwart/*.ts` |
| **HTTP Client** | `serverlessbase/packages/server/src/utils/stalwart/client.ts` |
| **DAV Client** | `serverlessbase/packages/server/src/utils/stalwart/davClient.ts` |
| **Database Schema** | `serverlessbase/packages/server/src/db/schema/{stalwart-config,mail-subscription,stalwart-usage,mail-sync-log}.ts` |
| **Frontend Components** | `client/src/components/dashboard/{mail,calendar,contacts,files}/` |
| **Superadmin Components** | `client/src/components/superadmin/stalwart/` |
| **Frontend Services** | `client/src/services/stalwart/*.ts` |
| **React Query Hooks** | `client/src/hooks/stalwart/*.ts` |
| **Query Key Factory** | `client/src/hooks/stalwart/queryKeys.ts` |
| **Types** | `client/src/types/stalwart.ts` |
| **Routes** | `client/src/routes/_app/_auth/dashboard/{mail,calendar,contacts,files}/` |
| **Superadmin Route** | `client/src/routes/_app/_superadmin/superadmin/_layout.stalwart.tsx` |
| **Translations** | `client/public/locales/{lang}/{mail,calendar,contacts,files,stalwart}.json` |
| **Feature Flags** | `client/src/lib/features/platform-features.ts` |
| **Docker** | `docker/compose/docker-compose.yml` (stalwart service) |
| **Agents** | `.claude/agents/stalwart/` |
| **Prompts** | `prompts/stalwart-mail/` |
| **Rule** | `.claude/rules/stalwart-mail-patterns.md` |
| **Skill** | `.claude/skills/stalwart-mail-integration/SKILL.md` |

## Validation Checklist

Before completing Stalwart features:

- [ ] Docker-only: `serverless-stalwart` on `serverless-network`, `mail` profile
- [ ] Token encrypted in DB, never in `.env`, never unmasked in responses
- [ ] All 4 feature flags gate respective routes and procedures
- [ ] Tier limits enforced, usage tracked (separate from WebSmith)
- [ ] Stripe integration for Pro/Enterprise tiers
- [ ] User provisioning (non-blocking, idempotent, with retries)
- [ ] Table views for all lists, inline action buttons
- [ ] URL tab state for all tabbed interfaces
- [ ] RTL support with logical CSS properties
- [ ] Dark mode with semantic color tokens
- [ ] Touch targets minimum 44x44px
- [ ] Mobile-first responsive design
- [ ] All strings in 5 languages (en, ar, fr, de, es)
- [ ] React Query key factory used (no ad-hoc keys)
- [ ] Service layer pattern followed (trpcQuery/trpcMutation)
- [ ] DNS wizard with propagation check
- [ ] SSL management via Certbot
- [ ] Monitoring charts for mail metrics
- [ ] No external mail services, no E2B/Vercel
- [ ] No `dokploy-*` naming
- [ ] Uncodixify compliant (no card lift, no animate-pulse on badges)
- [ ] PATCH with array-of-patches for principal updates (not PUT)
- [ ] Path traversal prevention for file operations
- [ ] Grace period handling on tier downgrade
