---
name: progressive-web-app
description: >
  Comprehensive guide for ServerlessBase's PWA implementation including service worker management,
  Workbox caching strategies, push notifications, offline-first patterns, Android TWA wrapper,
  and icon generation pipeline. Use when building or modifying PWA features, debugging service
  worker issues, implementing push notification flows, managing the Android TWA build, or
  optimizing offline experience.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "pwa"
  dependencies: "vite-plugin-pwa, workbox-precaching, workbox-routing, workbox-strategies, workbox-expiration, workbox-cacheable-response, workbox-window, @vite-pwa/assets-generator"
  project: "ServerlessBase - Progressive Web App"
---

# Progressive Web App Development Guide

## Overview

ServerlessBase's PWA enables the deployment dashboard to work offline-first, be installable on any device, and receive push notifications for deployment events. The implementation uses `vite-plugin-pwa` with an `injectManifest` strategy, giving full control over the service worker via Workbox. Registration uses the vanilla `virtual:pwa-register` module (not the React hook variant) to avoid duplicate React instances.

## Keywords

pwa, service worker, workbox, cache, offline, push notification, install prompt, update prompt, web manifest, android, twa, vapid, background sync, periodic sync, icon generation, offline fallback, beforeinstallprompt, injectManifest

## When to Use This Skill

- Adding new Workbox caching strategies for API endpoints or resource types
- Implementing background sync for offline deployment actions
- Connecting push notification subscriptions to the backend
- Debugging service worker registration, update, or caching issues
- Generating or updating PWA icons from SVG source
- Modifying the web app manifest (shortcuts, screenshots, display mode)
- Building or updating the Android TWA wrapper
- Adding new push notification types for deployment events
- Implementing the offline queue for pending actions
- Writing or fixing PWA E2E or unit tests
- Modifying the offline fallback page (`offline.html`)
- Troubleshooting install prompt or update prompt behavior

## Architecture Overview

```
Vite Build Pipeline
┌─────────────────────────────────────────────────────────────┐
│  vite-plugin-pwa (injectManifest strategy)                  │
│  ├── Compiles client/src/sw.ts → dist/sw.js                 │
│  ├── Injects self.__WB_MANIFEST with hashed asset URLs      │
│  ├── Generates dist/manifest.webmanifest from config         │
│  └── registerType: 'prompt' (user must click Reload)        │
└─────────────────────────────────────────────────────────────┘

Browser Runtime
┌─────────────────────────────────────────────────────────────┐
│  main.tsx (React app entry)                                  │
│  ├── <OfflineIndicator />    (z-[60], top bar when offline)  │
│  ├── <PWAUpdatePrompt />     (z-50, bottom-end toast)        │
│  └── <PWAInstallPrompt />    (z-50, bottom-start banner)     │
│                                                              │
│  Service Worker (sw.ts → sw.js)                              │
│  ├── precacheAndRoute(self.__WB_MANIFEST)                    │
│  ├── CacheFirst: JS/CSS (30d), images (30d), fonts (1yr)    │
│  ├── StaleWhileRevalidate: /locales/*                        │
│  ├── NetworkFirst: /api/trpc, /x/ (10s timeout, 5min TTL)   │
│  ├── NetworkFirst: navigations (3s timeout)                  │
│  ├── Offline fallback → /offline.html                        │
│  ├── Push notification handler                               │
│  ├── Background Sync handler (stub)                          │
│  └── Periodic Sync handler (stub)                            │
└─────────────────────────────────────────────────────────────┘

Android TWA (mobile/android/)
└── Bubblewrap-generated Gradle project
    ├── twa-manifest.json → app configuration
    ├── keystore/upload-keystore.jks → signing key
    └── ./gradlew assembleDebug → builds APK
```

## File Map

| File | Purpose |
|------|---------|
| `client/src/sw.ts` | Service worker source — 6 Workbox route strategies, push handler, sync stubs (225 lines) |
| `client/vite.config.mjs` (lines 40-138) | VitePWA plugin config — `injectManifest`, manifest, `devOptions` |
| `client/src/lib/pwa/config.ts` | `VAPID_PUBLIC_KEY`, `CACHE_CONFIG`, `PUSH_CONFIG`, `STORAGE_KEYS`, `PWA_FEATURES`, `urlBase64ToUint8Array()` |
| `client/src/lib/pwa/push-notifications.ts` | `subscribeToPushNotifications()`, `unsubscribeFromPushNotifications()`, `getSubscriptionData()`, `showLocalNotification()` |
| `client/src/components/pwa/PWAInstallPrompt.tsx` | Install banner — 3s delay, iOS Safari guide, 7-day dismissal, RTL-safe |
| `client/src/components/pwa/PWAUpdatePrompt.tsx` | Update toast — vanilla `registerSW`, hourly update checks, reload button |
| `client/src/components/pwa/OfflineIndicator.tsx` | Offline alert — `useOnlineStatus()`, `z-[60]`, destructive banner |
| `client/src/components/pwa/index.ts` | Barrel export for all 3 PWA components |
| `client/src/hooks/usePWAInstall.ts` | `usePWAInstall()` — `beforeinstallprompt` capture, standalone detection, iOS detection, 7-day dismiss. `useOnlineStatus()` — online/offline tracking |
| `client/src/vite-env.d.ts` | Type declarations for `virtual:pwa-register` and `virtual:pwa-register/react` |
| `client/public/offline.html` | Offline fallback page — inline CSS, 5 languages, dark mode, RTL, auto-retry on reconnect (294 lines) |
| `client/pwa-assets.config.ts` | `@vite-pwa/assets-generator` config — `minimal2023Preset`, source `public/branding/logo-icon.svg` |
| `client/public/pwa-*.png` | Generated icons: 64x64, 192x192, 512x512 |
| `client/public/maskable-icon-512x512.png` | Maskable icon (background: `#0f172a`) |
| `client/public/apple-touch-icon-180x180.png` | Apple touch icon (background: `#ffffff`) |
| `client/public/locales/{lang}/common.json` | i18n keys under `pwa.*` namespace |
| `mobile/android/` | Android TWA wrapper — Gradle project, `twa-manifest.json` |
| `client/tests/e2e/pwa/` | 3 E2E test files: `install-flow.spec.ts`, `update-flow.spec.ts`, `offline-fallback.spec.ts` |
| `client/src/lib/pwa/__tests__/` | Unit tests for push notifications |
| `client/src/components/pwa/__tests__/` | Unit tests for PWA components |
| `client/src/hooks/__tests__/usePWAInstall.test.ts` | Unit test for install hook |

## Service Worker Patterns

### SKIP_WAITING Message

The SW listens for `SKIP_WAITING` messages to activate immediately:

```typescript
// sw.ts lines 29-33
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
```

### Cache Version Constant

All cache names use a version suffix for cache busting:

```typescript
const CACHE_VERSION = 'v1.0.0';
// Usage: cacheName: `static-resources-${CACHE_VERSION}`
```

Update `CACHE_VERSION` when you need to invalidate all caches. Also keep `CACHE_CONFIG.version` in `config.ts` in sync.

### Cleanup and Precaching

```typescript
cleanupOutdatedCaches();                    // Remove old Workbox caches
precacheAndRoute(self.__WB_MANIFEST);       // Precache build assets (injected by plugin)
```

### Offline Navigation Fallback

Failed navigation requests fall back to `/offline.html`:

```typescript
// sw.ts lines 132-143
self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(`navigations-${CACHE_VERSION}`);
        const cachedResponse = await cache.match('/offline.html');
        return cachedResponse || new Response('Offline', { status: 503 });
      })
    );
  }
});
```

### Strategy Decision Table

| Resource | Strategy | Rationale |
|----------|----------|-----------|
| JS/CSS (`script`, `style`) | CacheFirst | Hashed filenames = immutable; cache hit is faster |
| Images (`image`) | CacheFirst | Large payloads; rarely change once deployed |
| Fonts (`font`) | CacheFirst | Never change; 1-year TTL |
| `/locales/*` | StaleWhileRevalidate | Show cached translations instantly, update in background |
| `/api/trpc`, `/x/` | NetworkFirst (10s) | Must be fresh; cache is offline fallback only |
| Navigations | NetworkFirst (3s) | HTML pages need latest version; short timeout |

## Component Integration

### Mounting in main.tsx

PWA components are mounted at `client/src/main.tsx` lines 80-82, **outside** the router/auth but **inside** `QueryClientProvider`:

```tsx
<QueryClientProvider client={queryClient}>
  <AuthProvider>
    <LanguageProvider>
      <RouterProvider router={router} />
    </LanguageProvider>
  </AuthProvider>
  <OfflineIndicator />
  <PWAUpdatePrompt />
  <PWAInstallPrompt />
</QueryClientProvider>
```

This ensures PWA features work regardless of authentication or route state.

### Component Responsibilities

| Component | Trigger | Z-Index | Position |
|-----------|---------|---------|----------|
| `OfflineIndicator` | `useOnlineStatus()` returns `false` | `z-[60]` | Fixed top, full width |
| `PWAUpdatePrompt` | `registerSW` `onNeedRefresh` / `onOfflineReady` | `z-50` | Fixed bottom-end |
| `PWAInstallPrompt` | `usePWAInstall()` `canInstall` or `showIOSGuide` | `z-50` | Fixed bottom-start |

## Update Flow

1. `PWAUpdatePrompt` calls `registerSW()` from `virtual:pwa-register` on mount
2. Plugin checks for SW update on page load
3. Hourly re-check via `registration.update()` in `setInterval` (60 min)
4. When new SW detected → `onNeedRefresh()` fires → shows "New version available" toast
5. When first cached → `onOfflineReady()` fires → shows "App ready for offline use" toast
6. User clicks "Reload" → `updateSW(true)` → page reloads with new SW
7. User can dismiss → toast hidden, but update still pending for next visit

**Key:** `registerType: 'prompt'` means the user must explicitly reload. Auto-update is NOT used.

## Push Notification Flow

### Current State

**Frontend (complete):**
- `isPushSupported()` — checks `serviceWorker`, `PushManager`, `Notification`, `VAPID_PUBLIC_KEY`
- `requestNotificationPermission()` — shows browser permission dialog
- `subscribeToPushNotifications()` — creates `PushSubscription` with VAPID key
- `unsubscribeFromPushNotifications()` — removes subscription
- `getSubscriptionData()` — extracts `endpoint`, `p256dh`, `auth` for backend storage
- `showLocalNotification()` — shows notification via SW (testing/immediate feedback)

**Service Worker (complete):**
- `push` handler (sw.ts:146-171) — parses JSON payload, shows notification
- `notificationclick` handler (sw.ts:174-199) — focuses existing window or opens new one
- Default icon: `/pwa-192x192.png`, badge: `/pwa-64x64.png`
- Default actions: `[{ action: 'view', title: 'View Details' }, { action: 'dismiss', title: 'Dismiss' }]`

**Backend (GAP):**
- No tRPC procedure to receive `PushSubscriptionData`
- No database table to store subscriptions
- No push sending service (would use `web-push` npm package)

### Notification Types

Defined in `PUSH_CONFIG.types` (`client/src/lib/pwa/config.ts`):

| Constant | Value | Use Case |
|----------|-------|----------|
| `DEPLOY_STARTED` | `'deploy_started'` | Deployment kicked off |
| `DEPLOY_COMPLETE` | `'deploy_complete'` | Deployment succeeded |
| `DEPLOY_FAILED` | `'deploy_failed'` | Deployment failed |
| `SERVER_ALERT` | `'server_alert'` | Server health warning |
| `CERTIFICATE_EXPIRY` | `'certificate_expiry'` | SSL cert expiring soon |
| `UPTIME_DOWN` | `'uptime_down'` | Monitored service went down |
| `UPTIME_RECOVERED` | `'uptime_recovered'` | Monitored service recovered |
| `GENERAL` | `'general'` | Generic notification |

## Incomplete Features (Stubs)

### Background Sync

`sw.ts` lines 201-211 — stub that logs to console:

```typescript
self.addEventListener('sync', (event: Event) => {
  const syncEvent = event as SyncEvent;
  if (syncEvent.tag === 'sync-pending-actions') {
    syncEvent.waitUntil(syncPendingActions());
  }
});

async function syncPendingActions(): Promise<void> {
  console.log('[SW] Syncing pending deployment actions...');
  // TODO: Read from IndexedDB queue, retry failed API calls
}
```

**Implementation guide:** See `references/offline-first-patterns.md`.

### Periodic Sync

`sw.ts` lines 213-223 — stub that logs to console:

```typescript
self.addEventListener('periodicsync', (event: Event) => {
  const periodicSyncEvent = event as PeriodicSyncEvent;
  if (periodicSyncEvent.tag === 'check-deployment-status') {
    periodicSyncEvent.waitUntil(checkDeploymentStatus());
  }
});

async function checkDeploymentStatus(): Promise<void> {
  console.log('[SW] Checking active deployment status...');
  // TODO: Fetch deployment status from API, show notification if changed
}
```

### Offline Queue

`STORAGE_KEYS.offlineQueue` (`'pwa-offline-queue'`) is defined in `config.ts` but not yet used. Intended for IndexedDB-based action queue.

### Push Backend

`getSubscriptionData()` exists in `push-notifications.ts` but the subscription is never sent to the server. Needs:
1. tRPC procedure: `push.subscribe` / `push.unsubscribe`
2. Database table: `push_subscriptions` (userId, endpoint, keys, expirationTime)
3. Backend service: `web-push` npm package for sending notifications

## i18n Keys

All PWA translation keys live in `common.json` under the `pwa` namespace:

| Key | Default (EN) |
|-----|-------------|
| `pwa.installTitle` | Install ServerlessBase |
| `pwa.installDescription` | Install our app for faster access and offline support |
| `pwa.install` | Install |
| `pwa.iosInstallTitle` | Add to Home Screen |
| `pwa.iosStep1` | Tap the Share button in Safari |
| `pwa.iosStep2` | Scroll down and tap "Add to Home Screen" |
| `pwa.iosStep3` | Tap "Add" to install |
| `pwa.offlineReady` | App ready for offline use |
| `pwa.updateAvailable` | New version available |
| `pwa.reload` | Reload |
| `pwa.offline` | You're offline |

When adding new PWA UI text, add keys to all 5 locales: `en`, `ar`, `fr`, `de`, `es`.

## Testing Strategy

### E2E Tests (Playwright)

Located in `client/tests/e2e/pwa/` — 3 files, ~1,400 lines total:

| File | Tests |
|------|-------|
| `install-flow.spec.ts` | Install prompt visibility, interaction, dismissal persistence, ARIA, 44px targets, RTL |
| `update-flow.spec.ts` | Offline ready notification, update notification, reload, SW registration, RTL |
| `offline-fallback.spec.ts` | Offline indicator, fallback page, network transitions, SW caching, dark mode, RTL |

**Key patterns:**
- Mock `beforeinstallprompt` with `page.evaluate()`
- Use `context.setOffline(true)` for offline testing
- Mock `navigator.serviceWorker` for SW tests

### Unit Tests

| File | Tests |
|------|-------|
| `client/src/lib/pwa/__tests__/push-notifications.test.ts` | Push support detection, permission, subscribe, unsubscribe |
| `client/src/components/pwa/__tests__/PWAInstallPrompt.test.tsx` | Render, install flow, dismiss, iOS guide |
| `client/src/components/pwa/__tests__/PWAUpdatePrompt.test.tsx` | Offline ready toast, update toast, reload |
| `client/src/components/pwa/__tests__/OfflineIndicator.test.tsx` | Online/offline states, ARIA attributes |
| `client/src/hooks/__tests__/usePWAInstall.test.ts` | Hook state, prompt capture, dismissal |

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| SW not updating | `registerType: 'prompt'` requires user action | User must click "Reload" in update toast |
| Duplicate React instances | `devOptions.enabled: true` | Keep `devOptions.enabled: false` |
| Large bundle not precached | Exceeds 2MB default limit | `maximumFileSizeToCacheInBytes: 6 * 1024 * 1024` (already set) |
| Icons not generating | Wrong source path | Must be `public/branding/logo-icon.svg` |
| Android TWA crashes on splash | Color-only drawable has 0x0 dimensions | Must have image layer in `splash.xml` — see `android-twa-patterns.md` |
| Android TWA crashes on launch | Missing `twa_splash/` in FileProvider paths | Add `<files-path name="twa_splash" path="twa_splash/" />` to `filepaths.xml` |
| Push notifications not working | No VAPID key | Set `VITE_VAPID_PUBLIC_KEY` in root `.env` |
| Offline page shows wrong language | Browser `navigator.language` not matching | Offline page detects language from `navigator.language` prefix |
| Install prompt not showing | Already installed or recently dismissed | Check `display-mode: standalone` and `localStorage` for dismiss timestamp |

## Related Rules and Skills

| Type | Path | Purpose |
|------|------|---------|
| Rule | `.claude/rules/pwa-patterns.md` | Mandatory PWA coding patterns |
| Rule | `.claude/rules/android-twa-patterns.md` | TWA crash prevention rules |
| Rule | `.claude/rules/rtl-support-arabic.md` | RTL support for PWA components |
| Rule | `.claude/rules/docker-development-only.md` | Docker-only command execution |
| Rule | `.claude/rules/environment-variables.md` | Root `.env` only (VITE_VAPID_PUBLIC_KEY) |
| Agent | `.claude/agents/pwa/pwa-specialist.md` | PWA debugging and implementation agent |

## References

- [Service Worker Strategies](references/service-worker-strategies.md) — Deep dive into Workbox caching strategies
- [Push Notification Patterns](references/push-notification-patterns.md) — VAPID, backend, payloads
- [Android TWA Guide](references/android-twa-guide.md) — Build, signing, Play Store
- [Offline-First Patterns](references/offline-first-patterns.md) — Background sync, offline queue
- [Icon Generation](references/icon-generation.md) — Asset pipeline and configuration
