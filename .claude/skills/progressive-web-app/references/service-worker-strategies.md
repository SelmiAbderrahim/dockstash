# Service Worker Strategies - Deep Dive

## Workbox Strategy Reference

### Strategy Decision Matrix

| Question | CacheFirst | NetworkFirst | StaleWhileRevalidate |
|----------|-----------|-------------|---------------------|
| Is the URL content-hashed? | Yes | No | No |
| Does stale data cause user harm? | No | Yes | Tolerable briefly |
| Is the resource large? | Yes | Varies | Moderate |
| Is freshness critical? | No | Yes | Semi-critical |
| Offline access important? | Yes | Fallback | Yes |

### Current Routes in sw.ts

```
┌─────────────────────────────────────────────────────┐
│  Route Order (first match wins)                     │
│                                                     │
│  1. Precache (self.__WB_MANIFEST)  ← build assets   │
│  2. CacheFirst: script | style    ← JS/CSS          │
│  3. CacheFirst: image             ← images          │
│  4. CacheFirst: font              ← fonts           │
│  5. SWR: /locales/*               ← translations    │
│  6. NetworkFirst: /api/trpc, /x/  ← API calls       │
│  7. NavigationRoute               ← HTML pages       │
│  8. fetch listener                ← offline fallback │
└─────────────────────────────────────────────────────┘
```

## Adding a New Cache Route

### Template

```typescript
// In client/src/sw.ts, add BEFORE the NavigationRoute

registerRoute(
  // 1. URL matcher - function or regex
  ({ url, request }) => url.pathname.startsWith('/my-path/'),

  // 2. Strategy
  new NetworkFirst({  // or CacheFirst, StaleWhileRevalidate
    cacheName: `my-cache-${CACHE_VERSION}`,  // MUST include CACHE_VERSION
    networkTimeoutSeconds: 10,               // NetworkFirst only

    // 3. Plugins - MUST include CacheableResponsePlugin
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 24 * 60 * 60,  // 1 day
      }),
    ],
  })
);
```

### Checklist for New Routes

- [ ] Route matcher is specific enough (won't conflict with existing routes)
- [ ] Cache name includes `CACHE_VERSION`
- [ ] `CacheableResponsePlugin` included with `statuses: [0, 200]`
- [ ] `ExpirationPlugin` has appropriate `maxEntries` and `maxAgeSeconds`
- [ ] Route is placed BEFORE the `NavigationRoute` registration
- [ ] If caching API responses, consider `networkTimeoutSeconds`
- [ ] Added cache name to `CACHE_CONFIG.names` in `config.ts` (optional but recommended)

## Cache Versioning

### How It Works

1. `CACHE_VERSION` constant in `sw.ts` (currently `'v1.0.0'`)
2. All cache names use `${CACHE_VERSION}` suffix
3. `cleanupOutdatedCaches()` from Workbox removes old version caches on activate
4. `CACHE_CONFIG.version` in `config.ts` should stay in sync (used by frontend for display)

### When to Bump

| Scenario | Action |
|----------|--------|
| Added new cache route | No bump needed (new cache name) |
| Changed caching strategy | Bump to invalidate old cached responses |
| Changed cache TTL | Bump (old entries still have old TTL) |
| Fixed bug in cached response | Bump to force refetch |
| Regular maintenance | Optional bump on major releases |

### How to Bump

1. Update `CACHE_VERSION` in `client/src/sw.ts`
2. Update `CACHE_CONFIG.version` in `client/src/lib/pwa/config.ts`
3. Build → old caches are cleaned up on next SW activation

## Precache Manifest Injection

### How `self.__WB_MANIFEST` Works

1. During build, `vite-plugin-pwa` scans output files matching `globPatterns`
2. Generates an array of `{ url: string, revision: string }` entries
3. Injects this array into the compiled `sw.js` replacing `self.__WB_MANIFEST`
4. `precacheAndRoute()` caches these files on SW install and serves them from cache

### Configuration

```javascript
// vite.config.mjs
injectManifest: {
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
  globIgnores: ['**/node_modules/**', '**/sw.js', '**/workbox-*.js'],
  maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,  // 6MB for large bundles
}
```

### Notes

- `maximumFileSizeToCacheInBytes` is set to 6MB because the main JS bundle can exceed the default 2MB limit
- `globIgnores` excludes `sw.js` itself and Workbox runtime chunks
- Only files in `dist/` are included (source files are not precached)

## Service Worker Lifecycle

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   INSTALL    │────►│   WAITING    │────►│   ACTIVE     │
│              │     │              │     │              │
│ precache     │     │ waiting for  │     │ controls     │
│ assets       │     │ old SW to    │     │ all clients  │
│              │     │ release      │     │              │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                     │
       │              SKIP_WAITING                │
       │              message                     │
       │                    │                     │
       │                    ▼                     │
       │              ┌──────────┐                │
       │              │ ACTIVATE │                │
       │              │ cleanup  │                │
       │              │ old cache│                │
       │              └──────────┘                │
       │                                          │
       └──────── Event Listeners ─────────────────┘
                 • fetch (cache/network)
                 • push (notifications)
                 • sync (background sync)
                 • periodicsync
                 • message (SKIP_WAITING)
```

### ServerlessBase Update Flow

1. Browser detects new `sw.js` (different hash from current)
2. New SW enters INSTALL phase → precaches new assets
3. New SW enters WAITING phase (old SW still active)
4. `onNeedRefresh()` callback fires → `PWAUpdatePrompt` shows "New version available"
5. User clicks "Reload" → `updateSW(true)` sends `SKIP_WAITING` → page reloads
6. New SW enters ACTIVE phase → `clients.claim()` → controls all tabs

## Debugging Service Workers

### Chrome DevTools

1. **Application > Service Workers** — See registered SW, status, update button
2. **Application > Cache Storage** — Inspect cached entries by cache name
3. **Application > Manifest** — Verify manifest fields and installability
4. **Network tab** — Filter by "ServiceWorker" to see cache hits

### Useful URLs

| URL | Purpose |
|-----|---------|
| `chrome://serviceworker-internals` | All registered SWs across all origins |
| `chrome://flags/#enable-desktop-pwas` | Desktop PWA feature flags |

### Debug Logging

The SW logs its version on load:

```typescript
console.log('[SW] Service worker loaded - version:', CACHE_VERSION);
```

Filter browser console with `[SW]` prefix to see service worker logs.

### Common Debug Scenarios

**"SW not updating":**
1. Check if new `sw.js` has different content (hash mismatch triggers update)
2. Check `Application > Service Workers > Update on reload` checkbox for dev
3. Verify no `devOptions.enabled: true` interfering

**"Cached stale API response":**
1. Check if API route uses `NetworkFirst` (not `CacheFirst`)
2. Check `networkTimeoutSeconds` — too high and user waits, too low and falls back to stale cache
3. Check `maxAgeSeconds` in `ExpirationPlugin`

**"File not precached":**
1. Check `globPatterns` includes the file extension
2. Check `globIgnores` doesn't exclude the file
3. Check file size vs `maximumFileSizeToCacheInBytes` (6MB limit)
