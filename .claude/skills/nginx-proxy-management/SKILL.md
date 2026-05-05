---
name: nginx-proxy-management
description: >
  Comprehensive guide for implementing Nginx reverse proxy support in ServerlessBase.
  Covers proxy detection, site configuration generation, Certbot SSL integration, and unified domain management.
---

# Nginx Proxy Management Skill

## Overview

Comprehensive guide for implementing Nginx reverse proxy support in ServerlessBase. Covers proxy detection, site configuration generation, Certbot SSL integration, and unified domain management.

## When to Use This Skill

Use this skill when:
- Implementing Nginx site configuration generation
- Managing SSL certificates via Certbot
- Detecting proxy type on remote servers
- Building unified domain management that supports both Traefik and Nginx
- Creating tRPC procedures for Nginx operations
- Building frontend UI for Nginx configuration

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    ServerlessBase Server                     │
├─────────────────────────────────────────────────────────────┤
│  proxyType: "auto" | "traefik" | "nginx"                    │
│  proxyDetected: "traefik" | "nginx" | null                  │
│  proxyDetectedAt: timestamp                                  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Unified Domain Manager                       │
│  manageDomain(app, domain, action, proxyType)               │
├─────────────────────────────────────────────────────────────┤
│  proxyType === "traefik"  →  Docker labels / Traefik API    │
│  proxyType === "nginx"    →  Site configs / Certbot SSL     │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

### Backend Utilities

| File | Purpose |
|------|---------|
| `serverlessbase/packages/server/src/utils/nginx/types.ts` | TypeScript interfaces |
| `serverlessbase/packages/server/src/utils/nginx/templates.ts` | Config generation |
| `serverlessbase/packages/server/src/utils/nginx/file-manager.ts` | SSH file operations |
| `serverlessbase/packages/server/src/utils/nginx/ssl.ts` | Certbot integration |
| `serverlessbase/packages/server/src/utils/nginx/domain.ts` | Domain management |
| `serverlessbase/packages/server/src/utils/proxy/detect.ts` | Proxy detection |
| `serverlessbase/packages/server/src/utils/proxy/domain-manager.ts` | Unified routing |

### API Layer

| File | Purpose |
|------|---------|
| `serverlessbase/apps/serverlessbase/server/api/routers/server.ts` | tRPC procedures |

### Frontend

| File | Purpose |
|------|---------|
| `client/src/services/deployment/nginxService.ts` | API service |
| `client/src/hooks/deployment/useNginx.ts` | React Query hooks |
| `client/src/components/dashboard/nginx/` | UI components |

## Workflows

### 1. Proxy Detection Workflow

```typescript
// 1. Check for Traefik container first
const traefikCheck = await execAsyncRemote(
  serverId,
  'docker ps --filter "name=traefik" --format "{{.Names}}" 2>/dev/null | head -1'
);
if (traefikCheck.stdout.trim()) return "traefik";

// 2. Check for Nginx process
const nginxCheck = await execAsyncRemote(
  serverId,
  'systemctl is-active nginx 2>/dev/null || pgrep -x nginx >/dev/null && echo "active"'
);
if (nginxCheck.stdout.includes("active")) return "nginx";

// 3. No proxy found
return null;
```

### 2. Site Configuration Workflow

```typescript
// 1. Generate config from template
const config = generateFullConfig({
  domain: "app.example.com",
  upstream: "127.0.0.1",
  port: 3000,
  https: true,
});

// 2. Write to sites-available (base64 for safe transfer)
const encoded = Buffer.from(config).toString("base64");
await execAsyncRemote(serverId,
  `echo "${encoded}" | base64 -d | sudo tee /etc/nginx/sites-available/app.example.com.conf`
);

// 3. Enable site (create symlink)
await execAsyncRemote(serverId,
  `sudo ln -sf /etc/nginx/sites-available/app.example.com.conf /etc/nginx/sites-enabled/app.example.com.conf`
);

// 4. Validate before reload
const validation = await execAsyncRemote(serverId, "sudo nginx -t 2>&1");
if (!validation.stdout.includes("successful")) {
  throw new Error(`Invalid config: ${validation.stdout}`);
}

// 5. Reload Nginx
await execAsyncRemote(serverId, "sudo systemctl reload nginx");
```

### 3. SSL Certificate Workflow

```typescript
// 1. Request certificate via Certbot
const result = await execAsyncRemote(serverId, [
  "sudo certbot certonly",
  "--nginx",
  `-d ${domain}`,
  `--email ${email}`,
  "--agree-tos",
  "--non-interactive",
  staging ? "--staging" : "",
].filter(Boolean).join(" "));

// 2. Check result
if (result.exitCode !== 0) {
  if (result.stderr.includes("too many certificates")) {
    throw new Error("Rate limit exceeded");
  }
  throw new Error(result.stderr);
}

// 3. Reload Nginx to pick up new cert
await execAsyncRemote(serverId, "sudo systemctl reload nginx");
```

## Examples

### Creating a Domain Configuration

```typescript
import { manageDomain } from "@dokploy/server/utils/proxy/domain-manager";

// In domain creation handler
const result = await manageDomain(application, domain, "create");
if (!result.success) {
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: result.message,
  });
}
```

### Checking Certificate Status

```typescript
import { getCertificateStatus } from "@dokploy/server/utils/nginx/ssl";

const status = await getCertificateStatus(serverId, "app.example.com");
// { status: "valid", expiresAt: "2024-06-15", daysRemaining: 45, isManaged: true }
```

### Frontend Hook Usage

```typescript
import { useNginxStatus, useReloadNginx } from "@/hooks/deployment/useNginx";

function NginxControls({ serverId }: { serverId: string }) {
  const { data: status } = useNginxStatus(serverId);
  const reloadMutation = useReloadNginx();

  return (
    <div>
      <Badge variant={status?.isRunning ? "default" : "destructive"}>
        {status?.isRunning ? "Running" : "Stopped"}
      </Badge>
      <Button onClick={() => reloadMutation.mutate(serverId)}>
        Reload Nginx
      </Button>
    </div>
  );
}
```

## Error Handling

| Error Pattern | Cause | Resolution |
|---------------|-------|------------|
| `duplicate listen` | Port conflict | Check other server blocks |
| `host not found` | Invalid upstream | Verify container name |
| `SSL: error:0B080074` | Missing certificate | Request via Certbot |
| `too many certificates` | Rate limit | Wait or use staging |
| `Challenge failed` | DNS not configured | Verify DNS records |

## Best Practices

### DO

1. Always validate config with `nginx -t` before reload
2. Use base64 encoding for SSH content transfer
3. Backup configs before writing
4. Include WebSocket headers in all proxy blocks
5. Use the unified domain manager for consistency

### AVOID

1. Writing directly to `/etc/nginx/nginx.conf`
2. Skipping validation before reload
3. Hardcoding upstream addresses
4. Running Traefik and Nginx simultaneously
5. Plain text SSH transfer (use base64)

## References

- [Config Templates](./references/config-templates.md)
- [SSH Operations](./references/ssh-operations.md)
- [Certbot SSL](./references/certbot-ssl.md)

## Related Rules

- `.claude/rules/nginx-proxy-patterns.md` - Comprehensive patterns guide
