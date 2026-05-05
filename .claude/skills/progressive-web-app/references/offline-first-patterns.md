# Offline-First Patterns - Deep Dive

## Current State

The service worker has two stub functions that need implementation:

1. **Background Sync** (`syncPendingActions`) — sw.ts:209-211
2. **Periodic Sync** (`checkDeploymentStatus`) — sw.ts:221-223

Additionally, `STORAGE_KEYS.offlineQueue` (`'pwa-offline-queue'`) is defined in `config.ts` but not yet used.

## Background Sync Implementation

### Architecture

```
User performs action while offline
    │
    ▼
Frontend: Queue action in IndexedDB
    │
    ▼
Register sync event: 'sync-pending-actions'
    │
    ▼
Network restored → Browser fires sync event
    │
    ▼
SW: syncPendingActions()
    ├── Read queue from IndexedDB
    ├── Replay each action against API
    ├── Remove successful actions from queue
    ├── Keep failed actions for retry
    └── Show notification with results
```

### IndexedDB Queue Schema

```typescript
interface OfflineAction {
  id: string;               // UUID
  type: OfflineActionType;  // 'deploy' | 'start' | 'stop' | 'restart' | 'update-env'
  endpoint: string;         // tRPC procedure path (e.g., 'application.deploy')
  payload: unknown;         // Procedure input
  timestamp: number;        // Date.now()
  retryCount: number;       // Incremented on each failure
  maxRetries: number;       // Default: 3
  status: 'pending' | 'processing' | 'failed';
  error?: string;           // Last error message
}

type OfflineActionType = 'deploy' | 'start' | 'stop' | 'restart' | 'update-env';
```

### Queue Manager (Frontend)

```typescript
// client/src/lib/pwa/offline-queue.ts
import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface OfflineQueueDB extends DBSchema {
  'offline-actions': {
    key: string;
    value: OfflineAction;
    indexes: { 'by-timestamp': number; 'by-status': string };
  };
}

const DB_NAME = 'serverlessbase-offline';
const DB_VERSION = 1;

async function getDB(): Promise<IDBPDatabase<OfflineQueueDB>> {
  return openDB<OfflineQueueDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      const store = db.createObjectStore('offline-actions', { keyPath: 'id' });
      store.createIndex('by-timestamp', 'timestamp');
      store.createIndex('by-status', 'status');
    },
  });
}

export async function enqueueAction(action: Omit<OfflineAction, 'id' | 'retryCount' | 'status'>): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('offline-actions', {
    ...action,
    id,
    retryCount: 0,
    status: 'pending',
  });

  // Request background sync
  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register('sync-pending-actions');
  }

  return id;
}

export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-actions', 'by-status', 'pending');
}

export async function removeAction(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-actions', id);
}

export async function getQueueSize(): Promise<number> {
  const db = await getDB();
  return db.count('offline-actions');
}
```

### Service Worker Sync Handler

```typescript
// Replace the stub in sw.ts

async function syncPendingActions(): Promise<void> {
  console.log('[SW] Syncing pending deployment actions...');

  // Open IndexedDB from service worker context
  const db = await openIndexedDB('serverlessbase-offline');
  const tx = db.transaction('offline-actions', 'readwrite');
  const store = tx.objectStore('offline-actions');
  const statusIndex = store.index('by-status');

  const pendingActions = await getAllFromIndex(statusIndex, 'pending');

  let successCount = 0;
  let failCount = 0;

  for (const action of pendingActions) {
    try {
      // Mark as processing
      action.status = 'processing';
      await store.put(action);

      // Replay the API call
      const response = await fetch(`/api/trpc/${action.endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(action.payload),
      });

      if (response.ok) {
        // Success - remove from queue
        await store.delete(action.id);
        successCount++;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      action.retryCount++;
      action.error = error instanceof Error ? error.message : 'Unknown error';

      if (action.retryCount >= action.maxRetries) {
        action.status = 'failed';
      } else {
        action.status = 'pending';
      }

      await store.put(action);
      failCount++;
    }
  }

  // Show summary notification
  if (successCount > 0 || failCount > 0) {
    await self.registration.showNotification('Offline Actions Synced', {
      body: `${successCount} succeeded, ${failCount} failed`,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: 'sync-result',
    });
  }
}
```

### Frontend Integration

```typescript
// In a deployment action handler
import { enqueueAction } from '@/lib/pwa/offline-queue';

async function handleDeploy(applicationId: string) {
  if (!navigator.onLine) {
    // Queue for later
    await enqueueAction({
      type: 'deploy',
      endpoint: 'application.deploy',
      payload: { applicationId },
      timestamp: Date.now(),
      maxRetries: 3,
    });
    toast.info(t('pwa.actionQueued', 'Action queued for when you\'re back online'));
    return;
  }

  // Normal online flow
  await ApplicationService.deploy(applicationId);
}
```

## Periodic Sync Implementation

### Purpose

Check deployment status periodically in the background (even when tab is not focused):

```typescript
// Replace the stub in sw.ts

async function checkDeploymentStatus(): Promise<void> {
  console.log('[SW] Checking active deployment status...');

  try {
    const response = await fetch('/api/trpc/deployment.active', {
      credentials: 'include',
    });

    if (!response.ok) return;

    const data = await response.json();
    const deployments = data.result?.data?.json || [];

    for (const deploy of deployments) {
      if (deploy.status === 'done' || deploy.status === 'error') {
        await self.registration.showNotification(
          deploy.status === 'done' ? 'Deployment Complete' : 'Deployment Failed',
          {
            body: `${deploy.applicationName}: ${deploy.status}`,
            icon: '/pwa-192x192.png',
            badge: '/pwa-64x64.png',
            tag: `deploy-${deploy.deploymentId}`,
            data: {
              url: `/dashboard/projects/${deploy.projectId}?tab=deployments`,
            },
          }
        );
      }
    }
  } catch (error) {
    console.error('[SW] Failed to check deployment status:', error);
  }
}
```

### Registration

Periodic sync requires browser permission and minimum interval:

```typescript
// In a frontend component or service
async function registerPeriodicSync() {
  if (!('periodicSync' in (await navigator.serviceWorker.ready))) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).periodicSync.register('check-deployment-status', {
      minInterval: 60 * 1000, // Minimum 1 minute (browser may enforce longer)
    });
  } catch {
    // Periodic sync not granted or not supported
  }
}
```

## UI for Pending Offline Actions

### Pending Actions Indicator

Show a badge/counter when there are queued offline actions:

```tsx
import { useEffect, useState } from 'react';
import { getQueueSize } from '@/lib/pwa/offline-queue';
import { useOnlineStatus } from '@/hooks/usePWAInstall';
import { Badge } from '@/components/ui/badge';
import { CloudOff } from 'lucide-react';

export function OfflineQueueIndicator() {
  const isOnline = useOnlineStatus();
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    const checkQueue = async () => {
      const size = await getQueueSize();
      setQueueSize(size);
    };
    checkQueue();
    const interval = setInterval(checkQueue, 5000);
    return () => clearInterval(interval);
  }, []);

  if (queueSize === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <CloudOff className="h-4 w-4 text-muted-foreground" />
      <Badge variant="secondary">
        {queueSize} pending
      </Badge>
      {isOnline && (
        <span className="text-xs text-muted-foreground">Syncing...</span>
      )}
    </div>
  );
}
```

## Dependencies

If implementing the IndexedDB queue, add the `idb` package:

```bash
# Inside Docker
docker exec -it serverless-client npm install idb
```

The `idb` package provides a thin Promise-based wrapper around IndexedDB, making it easier to work with from both the main thread and service worker context.

## Conflict Resolution

When syncing offline actions, conflicts can occur if the server state has changed:

| Scenario | Resolution |
|----------|------------|
| Deploying an app that was deleted | Remove action, show error notification |
| Starting a service already running | Treat as success (idempotent) |
| Updating env vars that were already changed | Server wins (latest write wins) |
| Stopping a service already stopped | Treat as success (idempotent) |

**Principle:** For deployment actions, server state is the source of truth. Offline actions are best-effort retries, not guaranteed transactions.
