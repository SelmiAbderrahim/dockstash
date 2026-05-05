# Sandbox Lifecycle - App Studio Reference

## Overview

App Studio uses Docker containers as isolated sandboxes for live application preview. Each project gets a dedicated container running a Vite dev server with hot module replacement (HMR).

## Container Specification

| Property | Value |
|----------|-------|
| Base Image | `node:22-slim` |
| Container Prefix | `serverless-appstudio-sandbox` |
| Container Name | `serverless-appstudio-sandbox-{projectId}` |
| Network | `serverless-network` |
| Port Range | 50000-50999 (host) → 5173 (container) |
| Memory Limit | 1 GB (`SANDBOX_MEMORY_LIMIT`) |
| CPU Limit | 1.0 cores (`SANDBOX_CPU_LIMIT`) |
| Working Directory | `/app` |
| User | `node` (non-root) |
| Default Expiry | 30 minutes |
| Security | `no-new-privileges`, restart policy `no` |
| Labels | `serverless.service=appstudio-sandbox`, `serverless.project={id}` |

## Lifecycle States

```
CREATING → RUNNING → IDLE → EXPIRED → DESTROYED
                 ↑         ↓
                 └─ ACTIVE ←┘ (user interaction resets expiry timer)
```

| State | Description | Transitions |
|-------|-------------|-------------|
| `creating` | Container being created, deps installing | → `running` or → `destroyed` (on error) |
| `running` | Vite dev server active, user interacting | → `idle` (after inactivity) |
| `idle` | Container stopped, data preserved | → `running` (startSandbox) or → `destroyed` |
| `expired` | Timeout reached, pending cleanup | → `destroyed` |
| `destroyed` | Container removed, port freed | Terminal state |

## Creation Flow

The `createSandbox(projectId)` function orchestrates 16 steps:

```
1. Validate project exists
2. Clean up stale "creating" records (> 5 min old)
3. Check for existing running/creating sandbox
   → If running and alive: return existing
   → If stale: mark destroyed + remove container
4. Allocate port (scan 50000-50999 for availability)
5. Remove stale container with same name (preemptive)
6. Insert DB record (status: "creating")
7. Pull image if not cached (120s timeout)
8. Create Docker container (with resource limits)
9. Start container
10. Fix permissions (chown -R node:node /app)
11. Install git (apt-get install git)
12. Write template files (package.json, vite.config.ts, etc.)
13. npm install (180s timeout)
14. Initialize git repo + initial commit
15. Start Vite dev server (detached)
16. Wait for Vite readiness (poll http://localhost:5173, 30s timeout)
17. Update DB: status → "running", set containerId
```

Total creation timeout: 240 seconds.

## Port Allocation

```typescript
// Scan range 50000-50999
// Skip ports already used by other sandboxes (from DB)
// Check actual availability with net.createServer
export async function allocatePort(usedPorts: Set<number>): Promise<number> {
  for (let port = 50000; port <= 50999; port++) {
    if (usedPorts.has(port)) continue;
    const available = await isPortAvailable(port);
    if (available) return port;
  }
  throw new Error('No available ports in range 50000-50999');
}
```

## File Operations

All file operations use `docker exec`:

### Write File (base64 safe)

```typescript
// 1. Create parent directories
await execInSandbox(containerName, `mkdir -p '/app/src/components'`);

// 2. Base64 encode content and pipe to file
const encoded = Buffer.from(content, "utf-8").toString("base64");
await execAsync(
  `echo '${encoded}' | docker exec -i -w /app ${containerName} sh -c 'base64 -d > /app/src/components/Button.tsx'`
);
```

### Read File

```typescript
const { stdout } = await execInSandbox(containerName, `cat '/app/src/App.tsx'`);
```

### List Files

```typescript
const { stdout } = await execInSandbox(containerName,
  `find '/app' -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.git/*'`
);
```

### Path Validation

```typescript
export function validateSandboxPath(filePath: string): string {
  // Reject absolute paths
  // Reject null bytes
  // Reject dangerous metacharacters (; | & ` $ etc.)
  // Reject path traversal (..)
  // Normalize and join with /app
  return path.posix.join('/app', normalized);
}
```

## Command Validation

```typescript
// Only these binaries are allowed
const ALLOWED_COMMANDS = new Set([
  'node', 'npm', 'npx', 'ls', 'cat', 'find', 'mkdir',
  'cp', 'mv', 'rm', 'echo', 'pwd', 'which', 'env',
  'printenv', 'tail', 'head', 'wc', 'sort', 'grep',
  'touch', 'chmod', 'test', 'git',
]);

// Dangerous metacharacters blocked
const DANGEROUS_METACHARACTERS = /[;|&`$(){}><*?\\\n\r~]/;
```

## Git Operations

Each sandbox has a git repository:

| Operation | Command |
|-----------|---------|
| Init | `git init` + config user |
| Commit | `git add -A && git commit -m '...'` |
| Log | `git log --oneline --format='%H|||%s|||%ci' -n 20` |
| Diff | `git diff` |
| Checkout | `git checkout {commitHash}` |
| Current Hash | `git rev-parse HEAD` |

## Auto-Cleanup

### Cron-Based Cleanup

The `sandbox-cleanup.ts` service runs periodically to remove expired sandboxes:

```typescript
// Find sandboxes where status is "running" and expiresAt < now
const expired = await db.query.appStudioSandbox.findMany({
  where: and(
    inArray(appStudioSandbox.status, ["running", "idle"]),
    lt(appStudioSandbox.expiresAt, new Date().toISOString()),
  ),
});

for (const sandbox of expired) {
  await destroySandbox(sandbox.sandboxId);
}
```

### Stale Record Cleanup

During `createSandbox`, records stuck in "creating" state for >5 minutes are automatically cleaned up.

## Resource Limits

| Resource | Limit | Constant |
|----------|-------|----------|
| Memory | 1 GB | `SANDBOX_MEMORY_LIMIT = 1024 * 1024 * 1024` |
| CPU | 1.0 cores | `SANDBOX_CPU_LIMIT = 1_000_000_000` NanoCPUs |
| Network | `serverless-network` only | `SANDBOX_NETWORK` |
| Expiry | 30 min default | `DEFAULT_EXPIRY_MINUTES = 30` |
| Shell timeout | 30s per command | `SHELL_TIMEOUT_MS = 30_000` |
| npm install | 180s | `NPM_INSTALL_TIMEOUT_MS` |
| Image pull | 120s | `IMAGE_PULL_TIMEOUT_MS` |
| Total creation | 240s | `SANDBOX_CREATION_TIMEOUT_MS` |
| Vite readiness | 30s | `VITE_READINESS_TIMEOUT_MS` |

## Monitoring

```bash
# List all App Studio sandboxes
docker ps --filter "label=serverless.service=appstudio-sandbox" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Count active sandboxes
docker ps --filter "name=serverless-appstudio-sandbox" -q | wc -l

# Check specific sandbox logs
docker logs serverless-appstudio-sandbox-{projectId} --tail 50

# Resource usage
docker stats --no-stream --filter "name=serverless-appstudio-sandbox"
```

## Troubleshooting

| Issue | Cause | Resolution |
|-------|-------|------------|
| Port already in use | Previous sandbox not cleaned up | Run cleanup script |
| Container won't start | Docker daemon issue | Check `docker info` |
| Vite not serving | npm install failed | Check container logs |
| Files not persisting | Wrong container reference | Verify sandbox lookup |
| Network unreachable | Network not created | `docker network create serverless-network` |
| Memory exceeded | Large project dependencies | Check `docker stats` |
| Creation timeout | Slow npm install | Pre-pull image, check network |
