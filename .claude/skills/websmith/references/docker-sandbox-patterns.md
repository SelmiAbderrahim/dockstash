# Docker Sandbox Patterns - WebSmith Reference

## Overview

WebSmith uses Docker containers as isolated sandboxes for live website preview during AI code generation. Each user session gets a dedicated container running a Vite dev server.

## Container Lifecycle

### States

```
CREATING → RUNNING → IDLE → EXPIRED → DESTROYED
                 ↑         ↓
                 └─ ACTIVE ←┘ (user interaction resets expiry timer)
```

| State | Description | Transitions |
|-------|-------------|-------------|
| CREATING | Container being created, deps installing | → RUNNING |
| RUNNING | Vite dev server active, user interacting | → IDLE (after inactivity) |
| IDLE | No recent user activity, timer counting down | → EXPIRED (timeout) or → RUNNING (user returns) |
| EXPIRED | Timeout reached, pending cleanup | → DESTROYED |
| DESTROYED | Container removed, port freed | Terminal state |

### Create Flow

```typescript
async function createSandbox(sessionId: string): Promise<Sandbox> {
  // 1. Allocate port from range 49000-49999
  const port = await allocatePort();

  // 2. Create container
  const containerName = `serverless-websmith-sandbox-${sessionId}`;
  await execAsync([
    'docker create',
    `--name ${containerName}`,
    `--network serverless-network`,
    `-p ${port}:5173`,
    '--memory=512m',
    '--cpus=0.5',
    '-w /app',
    'node:22-slim',
    'sleep infinity',
  ].join(' '));

  // 3. Start container
  await execAsync(`docker start ${containerName}`);

  // 4. Initialize project structure
  await execInContainer(containerName, 'npm init -y');
  await execInContainer(containerName, 'npm install vite @vitejs/plugin-react react react-dom tailwindcss postcss autoprefixer');

  // 5. Write base config files (vite.config.ts, tailwind.config.ts, etc.)
  await writeBaseFiles(containerName);

  // 6. Start Vite dev server
  await execAsync(`docker exec -d ${containerName} npx vite --host 0.0.0.0`);

  // 7. Record in database
  return await db.insert(websmithSandbox).values({
    sessionId,
    containerId: containerName,
    port,
    status: 'running',
    expiresAt: new Date(Date.now() + DEFAULT_TIMEOUT_MS),
  }).returning();
}
```

### Destroy Flow

```typescript
async function destroySandbox(sandboxId: string): Promise<void> {
  const sandbox = await db.query.websmithSandbox.findFirst({
    where: eq(websmithSandbox.sandboxId, sandboxId),
  });

  if (!sandbox) return;

  // 1. Stop container (graceful)
  await execAsync(`docker stop ${sandbox.containerId}`).catch(() => {});

  // 2. Remove container
  await execAsync(`docker rm ${sandbox.containerId}`).catch(() => {});

  // 3. Update database
  await db.update(websmithSandbox)
    .set({ status: 'destroyed', destroyedAt: new Date() })
    .where(eq(websmithSandbox.sandboxId, sandboxId));
}
```

### Extend Timeout

```typescript
async function extendTimeout(sandboxId: string, minutes?: number): Promise<void> {
  const timeout = minutes || DEFAULT_TIMEOUT_MINUTES;
  await db.update(websmithSandbox)
    .set({
      expiresAt: new Date(Date.now() + timeout * 60 * 1000),
      status: 'running',
    })
    .where(eq(websmithSandbox.sandboxId, sandboxId));
}
```

## Port Allocation

### Strategy

Dynamic port allocation from range `49000-49999`:

```typescript
async function allocatePort(): Promise<number> {
  // Get all ports currently in use by WebSmith sandboxes
  const { stdout } = await execAsync(
    "docker ps --filter 'name=serverless-websmith-sandbox' --format '{{.Ports}}'"
  );

  const usedPorts = new Set<number>();
  const portRegex = /(\d+)->5173/g;
  let match;
  while ((match = portRegex.exec(stdout)) !== null) {
    usedPorts.add(parseInt(match[1]));
  }

  // Find first available port
  for (let port = 49000; port <= 49999; port++) {
    if (!usedPorts.has(port)) return port;
  }

  throw new Error('No available ports in WebSmith sandbox range (49000-49999)');
}
```

### Port Mapping

| Host Port | Container Port | Purpose |
|-----------|---------------|---------|
| 49000-49999 | 5173 | Vite dev server |

## File Operations

### Write File

```typescript
async function writeFile(containerId: string, filePath: string, content: string): Promise<void> {
  // Ensure parent directory exists
  const dir = path.dirname(filePath);
  await execAsync(`docker exec ${containerId} mkdir -p ${dir}`);

  // Write file content using heredoc
  const escaped = content.replace(/\\/g, '\\\\');
  await execAsync(
    `docker exec ${containerId} sh -c 'cat > ${filePath} << '"'"'SANDBOXEOF'"'"'\n${escaped}\nSANDBOXEOF'`
  );
}
```

### Read File

```typescript
async function readFile(containerId: string, filePath: string): Promise<string> {
  const { stdout } = await execAsync(`docker exec ${containerId} cat ${filePath}`);
  return stdout;
}
```

### List Files

```typescript
async function listFiles(containerId: string, dir: string = '/app/src'): Promise<FileEntry[]> {
  const { stdout } = await execAsync(
    `docker exec ${containerId} find ${dir} -type f ` +
    `-not -path '*/node_modules/*' -not -path '*/.git/*' ` +
    `-printf '%p\\t%s\\t%T@\\n'`
  );

  return stdout.trim().split('\n').filter(Boolean).map(line => {
    const [path, size, mtime] = line.split('\t');
    return { path, size: parseInt(size), modifiedAt: new Date(parseFloat(mtime) * 1000) };
  });
}
```

## Auto-Cleanup

### Cron Job Pattern

```typescript
// Run every 5 minutes
async function cleanupExpiredSandboxes(): Promise<{ cleaned: number; errors: number }> {
  const expired = await db.query.websmithSandbox.findMany({
    where: and(
      eq(websmithSandbox.status, 'running'),
      lt(websmithSandbox.expiresAt, new Date()),
    ),
  });

  let cleaned = 0;
  let errors = 0;

  for (const sandbox of expired) {
    try {
      await destroySandbox(sandbox.sandboxId);
      cleaned++;
    } catch (error) {
      console.error(`Cleanup failed for ${sandbox.containerId}:`, error);
      errors++;
    }
  }

  return { cleaned, errors };
}
```

### Orphan Container Cleanup

```bash
#!/bin/bash
# Find containers that exist in Docker but not in database
docker ps -a --filter "name=serverless-websmith-sandbox" --format "{{.Names}}" | while read name; do
  # Check if container is tracked in database
  # If not, remove it
  echo "Checking orphan: $name"
done
```

## Base Project Files

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
```

### tailwind.config.ts

```typescript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

### index.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WebSmith Preview</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

## Resource Limits

| Resource | Limit | Rationale |
|----------|-------|-----------|
| Memory | 512MB | Sufficient for Vite + React |
| CPU | 0.5 cores | Prevents resource starvation |
| Disk | No explicit limit | Files are small (code only) |
| Network | `serverless-network` only | Isolation from host |
| Timeout | 15 min default | Prevents zombie containers |

## Monitoring Queries

```bash
# List all WebSmith sandboxes
docker ps --filter "name=serverless-websmith-sandbox" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}"

# Count active sandboxes
docker ps --filter "name=serverless-websmith-sandbox" -q | wc -l

# Check specific sandbox logs
docker logs serverless-websmith-sandbox-{id} --tail 50

# Inspect sandbox resources
docker stats --no-stream --filter "name=serverless-websmith-sandbox"
```

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Port already in use | Previous sandbox not cleaned up | Run cleanup, free port |
| Container won't start | Docker daemon issue | Check `docker info`, restart daemon |
| Vite not serving | npm install failed | Check logs, reinstall deps |
| Files not persisting | Wrong container ID | Verify sandbox lookup by session |
| Network unreachable | Network not created | Run `docker network create serverless-network` |
| Memory exceeded | Large project | Increase memory limit for sandbox |
