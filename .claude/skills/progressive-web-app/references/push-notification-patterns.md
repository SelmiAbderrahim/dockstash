# Push Notification Patterns - Deep Dive

## Current Implementation State

### Frontend (Complete)

Located in `client/src/lib/pwa/push-notifications.ts`:

| Function | Purpose |
|----------|---------|
| `isPushSupported()` | Checks `serviceWorker`, `PushManager`, `Notification`, `VAPID_PUBLIC_KEY` |
| `getNotificationPermission()` | Returns current `NotificationPermission` status |
| `requestNotificationPermission()` | Shows browser permission dialog, returns result |
| `subscribeToPushNotifications()` | Creates `PushSubscription` with VAPID key |
| `unsubscribeFromPushNotifications()` | Removes subscription from push manager |
| `getSubscriptionData(sub)` | Extracts `endpoint`, `p256dh`, `auth` for backend |
| `isSubscribedToPush()` | Checks if active subscription exists |
| `showLocalNotification(title, opts)` | Shows notification via SW registration (testing) |

### Service Worker (Complete)

Located in `client/src/sw.ts`:

- **Push handler** (lines 146-171): Parses JSON payload, shows notification with icon/badge/actions
- **Notification click** (lines 174-199): Focuses existing window or opens new one at `data.url`

### Backend (NOT YET IMPLEMENTED)

Needs:
1. Database table for push subscriptions
2. tRPC procedures for subscribe/unsubscribe
3. Push sending service using `web-push` npm package

## VAPID Key Management

### Environment Variable

```bash
# Root .env (NEVER in client/.env)
VITE_VAPID_PUBLIC_KEY=BN1jk...your-base64-key...
```

### Generating VAPID Keys

```bash
# Install web-push globally in the backend container
docker exec -it serverless-main-app npx web-push generate-vapid-keys

# Output:
# Public Key: BN1jk...
# Private Key: dI3k...

# Store public key in .env as VITE_VAPID_PUBLIC_KEY
# Store private key as VAPID_PRIVATE_KEY (backend only, never exposed to frontend)
```

### Key Storage

| Key | Location | Access |
|-----|----------|--------|
| VAPID Public Key | Root `.env` as `VITE_VAPID_PUBLIC_KEY` | Frontend (via `import.meta.env`) |
| VAPID Private Key | Root `.env` as `VAPID_PRIVATE_KEY` | Backend only (never in `VITE_*`) |
| VAPID Contact Email | Root `.env` as `VAPID_CONTACT_EMAIL` | Backend only (`mailto:admin@...`) |

## Backend Implementation Guide

### 1. Database Table

```sql
CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  keys_p256dh TEXT NOT NULL,
  keys_auth TEXT NOT NULL,
  expiration_time BIGINT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_push_sub_user ON push_subscriptions(user_id);
CREATE INDEX idx_push_sub_endpoint ON push_subscriptions(endpoint);
```

### 2. tRPC Procedures

```typescript
// serverlessbase/apps/serverlessbase/server/api/routers/push.ts
export const pushRouter = createTRPCRouter({
  subscribe: protectedProcedure
    .input(z.object({
      endpoint: z.string().url(),
      keys: z.object({
        p256dh: z.string(),
        auth: z.string(),
      }),
      expirationTime: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Upsert subscription (endpoint is unique)
      // Associate with ctx.user.id
    }),

  unsubscribe: protectedProcedure
    .input(z.object({ endpoint: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      // Delete subscription by endpoint + user
    }),

  status: protectedProcedure
    .query(async ({ ctx }) => {
      // Return user's active subscriptions count
    }),
});
```

### 3. Push Sending Service

```typescript
// serverlessbase/packages/server/src/services/push/pushService.ts
import webPush from 'web-push';

webPush.setVapidDetails(
  process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@serverlessbase.com',
  process.env.VITE_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushNotification(
  userId: string,
  payload: PushPayload
): Promise<void> {
  const subscriptions = await getSubscriptionsByUserId(userId);

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        JSON.stringify(payload)
      );
    } catch (error: any) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        // Subscription expired or invalid — remove from DB
        await deleteSubscription(sub.endpoint);
      }
    }
  }
}
```

## Payload Format

The SW push handler (sw.ts:146-171) expects this JSON structure:

```typescript
interface PushPayload {
  title: string;           // Required — notification title
  body: string;            // Required — notification body text
  url?: string;            // Navigation target on click (default: '/')
  tag?: string;            // Grouping tag (replaces previous with same tag)
  renotify?: boolean;      // Re-alert even if same tag (default: false)
  actions?: Array<{        // Max 2 action buttons
    action: string;        // Action identifier ('view', 'dismiss', etc.)
    title: string;         // Button label
  }>;
}
```

### Payload Examples by Type

```typescript
// DEPLOY_COMPLETE
{
  title: 'Deployment Complete',
  body: 'Project "my-app" deployed successfully to production',
  url: '/dashboard/projects/abc123',
  tag: 'deploy-abc123',
}

// DEPLOY_FAILED
{
  title: 'Deployment Failed',
  body: 'Project "my-app" deployment failed: Build error',
  url: '/dashboard/projects/abc123?tab=deployments',
  tag: 'deploy-abc123',
  actions: [
    { action: 'view', title: 'View Logs' },
    { action: 'dismiss', title: 'Dismiss' },
  ],
}

// UPTIME_DOWN
{
  title: 'Service Down',
  body: 'Monitor "API Health" is not responding (3 consecutive failures)',
  url: '/dashboard/uptime/monitor123?tab=incidents',
  tag: 'uptime-monitor123',
  renotify: true,  // Always alert for downtime
}

// CERTIFICATE_EXPIRY
{
  title: 'Certificate Expiring',
  body: 'SSL certificate for "example.com" expires in 7 days',
  url: '/dashboard/settings/servers/srv123?tab=certificates',
  tag: 'cert-example.com',
}
```

## Permission UX Best Practices

### Progressive Disclosure

Never ask for notification permission on first visit. Use a two-step pattern:

1. Show in-app UI explaining value (e.g., "Get notified when deployments finish")
2. User clicks "Enable notifications" → then trigger `requestNotificationPermission()`
3. Browser shows native permission dialog

### Good Timing

| Trigger | Good Timing |
|---------|-------------|
| After first successful deployment | User sees value, wants updates |
| In notification settings page | User explicitly looking for it |
| After watching a long deployment | User waiting for result |

| Trigger | Bad Timing |
|---------|------------|
| On first page load | No context, feels spammy |
| During onboarding | Too many prompts |
| In a modal overlay | Feels forced |

## Testing Push Notifications Locally

### 1. Show Local Notification (No Backend Needed)

```typescript
import { showLocalNotification } from '@/lib/pwa/push-notifications';

// In a component or dev console
await showLocalNotification('Test Notification', {
  body: 'This is a test push notification',
  tag: 'test',
});
```

### 2. Test via Chrome DevTools

1. Open `Application > Service Workers`
2. Click "Push" button next to registered SW
3. Enter JSON payload: `{"title":"Test","body":"Hello"}`
4. Notification appears

### 3. Test via web-push CLI

```bash
# In backend container
docker exec -it serverless-main-app npx web-push send-notification \
  --endpoint "https://fcm.googleapis.com/fcm/send/..." \
  --key "p256dh-key" \
  --auth "auth-key" \
  --vapid-pubkey "$VITE_VAPID_PUBLIC_KEY" \
  --vapid-pvtkey "$VAPID_PRIVATE_KEY" \
  --payload '{"title":"Test","body":"Hello from CLI"}'
```

## Notification Click Handling

The SW's `notificationclick` handler (sw.ts:174-199) follows this logic:

```
User clicks notification
    │
    ├── action === 'dismiss'
    │   └── Close notification, do nothing
    │
    └── action === 'view' or no action (body click)
        │
        ├── Check for existing open window
        │   ├── Found → focus it, navigate to data.url
        │   └── Not found → openWindow(data.url)
        │
        └── Close notification
```
