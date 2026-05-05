# SSH Operations Reference

## Core Function

All Nginx file operations use `execAsyncRemote()` from the server package.

```typescript
import { execAsyncRemote } from "@dokploy/server/utils/process/execAsync";

const result = await execAsyncRemote(serverId, command);
// result: { stdout: string, stderr: string, exitCode: number }
```

## File Operations

### Write Config (Base64 Encoded)

Always use base64 encoding for safe content transfer:

```typescript
export async function writeNginxConfig(
  serverId: string,
  configName: string,
  content: string
): Promise<void> {
  const configPath = `/etc/nginx/sites-available/${configName}`;
  const encoded = Buffer.from(content).toString("base64");

  await execAsyncRemote(
    serverId,
    `echo "${encoded}" | base64 -d | sudo tee ${configPath} > /dev/null`
  );
}
```

### Read Config

```typescript
export async function readNginxConfig(
  serverId: string,
  configName: string
): Promise<string> {
  const configPath = `/etc/nginx/sites-available/${configName}`;
  const result = await execAsyncRemote(serverId, `sudo cat ${configPath}`);

  if (result.exitCode !== 0) {
    throw new Error(`Failed to read config: ${result.stderr}`);
  }

  return result.stdout;
}
```

### Delete Config

```typescript
export async function deleteNginxConfig(
  serverId: string,
  configName: string
): Promise<void> {
  const availablePath = `/etc/nginx/sites-available/${configName}`;
  const enabledPath = `/etc/nginx/sites-enabled/${configName}`;

  // Remove both symlink and config file
  await execAsyncRemote(serverId, `sudo rm -f ${enabledPath} ${availablePath}`);
}
```

## Site Management

### Enable Site

```typescript
export async function enableNginxSite(
  serverId: string,
  configName: string
): Promise<void> {
  const available = `/etc/nginx/sites-available/${configName}`;
  const enabled = `/etc/nginx/sites-enabled/${configName}`;

  await execAsyncRemote(serverId, `sudo ln -sf ${available} ${enabled}`);
}
```

### Disable Site

```typescript
export async function disableNginxSite(
  serverId: string,
  configName: string
): Promise<void> {
  const enabled = `/etc/nginx/sites-enabled/${configName}`;
  await execAsyncRemote(serverId, `sudo rm -f ${enabled}`);
}
```

### List Configs

```typescript
export async function listNginxConfigs(
  serverId: string
): Promise<NginxConfigListItem[]> {
  // List all configs in sites-available
  const available = await execAsyncRemote(
    serverId,
    "ls -1 /etc/nginx/sites-available/ 2>/dev/null || true"
  );

  // List enabled configs
  const enabled = await execAsyncRemote(
    serverId,
    "ls -1 /etc/nginx/sites-enabled/ 2>/dev/null || true"
  );

  const enabledSet = new Set(enabled.stdout.trim().split("\n").filter(Boolean));

  return available.stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((name) => ({
      name,
      enabled: enabledSet.has(name),
    }));
}
```

## Nginx Control

### Validate Configuration

```typescript
export async function validateNginxConfig(
  serverId: string
): Promise<NginxValidationResult> {
  const result = await execAsyncRemote(serverId, "sudo nginx -t 2>&1");

  return {
    valid: result.stdout.includes("successful") || result.exitCode === 0,
    output: result.stdout || result.stderr,
  };
}
```

### Reload (Validate First)

```typescript
export async function reloadNginx(serverId: string): Promise<void> {
  // Always validate before reload
  const validation = await validateNginxConfig(serverId);
  if (!validation.valid) {
    throw new Error(`Cannot reload Nginx: ${validation.output}`);
  }

  await execAsyncRemote(serverId, "sudo systemctl reload nginx");
}
```

### Get Status

```typescript
export async function getNginxStatus(
  serverId: string
): Promise<NginxStatus> {
  const [statusResult, versionResult] = await Promise.all([
    execAsyncRemote(serverId, "systemctl is-active nginx 2>/dev/null || echo inactive"),
    execAsyncRemote(serverId, "nginx -v 2>&1"),
  ]);

  const isRunning = statusResult.stdout.trim() === "active";
  const versionMatch = versionResult.stdout.match(/nginx\/(\S+)/);

  return {
    isRunning,
    version: versionMatch ? versionMatch[1] : null,
  };
}
```

### Start/Stop/Restart

```typescript
export async function startNginx(serverId: string): Promise<void> {
  await execAsyncRemote(serverId, "sudo systemctl start nginx");
}

export async function stopNginx(serverId: string): Promise<void> {
  await execAsyncRemote(serverId, "sudo systemctl stop nginx");
}

export async function restartNginx(serverId: string): Promise<void> {
  const validation = await validateNginxConfig(serverId);
  if (!validation.valid) {
    throw new Error(`Cannot restart Nginx: ${validation.output}`);
  }
  await execAsyncRemote(serverId, "sudo systemctl restart nginx");
}
```

## Directory Setup

### Ensure Directories Exist

```typescript
export async function ensureNginxDirectories(serverId: string): Promise<void> {
  await execAsyncRemote(serverId, [
    "sudo mkdir -p /etc/nginx/sites-available",
    "sudo mkdir -p /etc/nginx/sites-enabled",
    "sudo mkdir -p /var/www/certbot",
  ].join(" && "));
}
```

### Check Nginx Installed

```typescript
export async function isNginxInstalled(serverId: string): Promise<boolean> {
  const result = await execAsyncRemote(serverId, "which nginx 2>/dev/null");
  return result.exitCode === 0 && result.stdout.trim().length > 0;
}
```

## Safety Patterns

### Backup Before Write

```typescript
async function safeWriteConfig(
  serverId: string,
  configName: string,
  content: string
): Promise<void> {
  const configPath = `/etc/nginx/sites-available/${configName}`;
  const backupPath = `${configPath}.backup.${Date.now()}`;

  // Backup existing (ignore if doesn't exist)
  await execAsyncRemote(serverId, `sudo cp ${configPath} ${backupPath} 2>/dev/null || true`);

  try {
    // Write new content
    await writeNginxConfig(serverId, configName, content);

    // Validate
    const validation = await validateNginxConfig(serverId);
    if (!validation.valid) {
      // Restore backup
      await execAsyncRemote(serverId, `sudo mv ${backupPath} ${configPath} 2>/dev/null || true`);
      throw new Error(`Invalid configuration: ${validation.output}`);
    }

    // Clean up backup
    await execAsyncRemote(serverId, `sudo rm -f ${backupPath}`);
  } catch (error) {
    // Restore on any error
    await execAsyncRemote(serverId, `sudo mv ${backupPath} ${configPath} 2>/dev/null || true`);
    throw error;
  }
}
```

## Error Handling

| Exit Code | Meaning | Handling |
|-----------|---------|----------|
| 0 | Success | Continue |
| 1 | General error | Check stderr |
| 127 | Command not found | Nginx not installed |

```typescript
if (result.exitCode === 127) {
  throw new Error("Nginx is not installed on this server");
}

if (result.exitCode !== 0) {
  throw new Error(result.stderr || result.stdout || "Unknown error");
}
```
