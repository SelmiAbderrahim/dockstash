# Certbot SSL Reference

## Core Functions

### Request Certificate

```typescript
interface CertbotRequestOptions {
  serverId: string;
  domain: string;
  email: string;
  staging?: boolean;     // Use Let's Encrypt staging (for testing)
  dryRun?: boolean;      // Test without saving
  webroot?: boolean;     // Use webroot instead of nginx plugin
  autoRedirect?: boolean; // Auto-configure HTTPS redirect
}

export async function requestCertificate(
  options: CertbotRequestOptions
): Promise<CertbotRequestResult> {
  const { serverId, domain, email, staging, dryRun, webroot } = options;

  const args = [
    "sudo certbot certonly",
    webroot ? "--webroot -w /var/www/certbot" : "--nginx",
    `-d ${domain}`,
    `--email ${email}`,
    "--agree-tos",
    "--non-interactive",
    staging ? "--staging" : "",
    dryRun ? "--dry-run" : "",
  ].filter(Boolean).join(" ");

  const result = await execAsyncRemote(serverId, args);

  if (result.exitCode !== 0) {
    return {
      success: false,
      message: parseCertbotError(result.stderr || result.stdout),
      output: result.stderr || result.stdout,
    };
  }

  // Reload Nginx to pick up new cert
  if (!dryRun) {
    await execAsyncRemote(serverId, "sudo systemctl reload nginx");
  }

  return {
    success: true,
    message: "Certificate requested successfully",
    output: result.stdout,
  };
}
```

### Get Certificate Status

```typescript
interface CertificateStatus {
  status: "valid" | "expiring" | "expired" | "none";
  expiresAt?: string;
  daysRemaining?: number;
  isManaged: boolean;
}

export async function getCertificateStatus(
  serverId: string,
  domain: string
): Promise<CertificateStatus> {
  const certPath = `/etc/letsencrypt/live/${domain}/cert.pem`;

  // Check if certificate exists
  const existsCheck = await execAsyncRemote(
    serverId,
    `sudo test -f ${certPath} && echo "exists" || echo "missing"`
  );

  if (!existsCheck.stdout.includes("exists")) {
    return { status: "none", isManaged: false };
  }

  // Get expiration date
  const dateResult = await execAsyncRemote(
    serverId,
    `sudo openssl x509 -enddate -noout -in ${certPath} 2>/dev/null`
  );

  if (dateResult.exitCode !== 0) {
    return { status: "none", isManaged: false };
  }

  // Parse: notAfter=Mar 15 00:00:00 2024 GMT
  const match = dateResult.stdout.match(/notAfter=(.+)/);
  if (!match) {
    return { status: "none", isManaged: false };
  }

  const expiresAt = new Date(match[1]);
  const now = new Date();
  const daysRemaining = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  let status: "valid" | "expiring" | "expired";
  if (daysRemaining < 0) {
    status = "expired";
  } else if (daysRemaining < 30) {
    status = "expiring";
  } else {
    status = "valid";
  }

  return {
    status,
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
    isManaged: true,
  };
}
```

### Renew Certificates

```typescript
interface CertbotRenewalResult {
  success: boolean;
  renewed: number;
  failed: number;
  output: string;
}

export async function renewCertificates(
  serverId: string,
  options?: { dryRun?: boolean; force?: boolean }
): Promise<CertbotRenewalResult> {
  const args = [
    "sudo certbot renew",
    "--quiet",
    options?.dryRun ? "--dry-run" : "",
    options?.force ? "--force-renewal" : "",
  ].filter(Boolean).join(" ");

  const result = await execAsyncRemote(serverId, args);

  // Reload Nginx after renewal
  if (!options?.dryRun && result.exitCode === 0) {
    await execAsyncRemote(serverId, "sudo systemctl reload nginx");
  }

  // Parse output for counts
  const renewedMatch = result.stdout.match(/(\d+) renewed/);
  const failedMatch = result.stdout.match(/(\d+) failed/);

  return {
    success: result.exitCode === 0,
    renewed: renewedMatch ? parseInt(renewedMatch[1]) : 0,
    failed: failedMatch ? parseInt(failedMatch[1]) : 0,
    output: result.stdout || result.stderr,
  };
}
```

### List All Certificates

```typescript
interface CertbotCertificate {
  domain: string;
  expiresAt: string;
  daysRemaining: number;
  status: "valid" | "expiring" | "expired";
}

export async function listCertificates(
  serverId: string
): Promise<CertbotCertificate[]> {
  const result = await execAsyncRemote(
    serverId,
    "sudo certbot certificates 2>/dev/null"
  );

  if (result.exitCode !== 0) {
    return [];
  }

  // Parse certbot output
  const certs: CertbotCertificate[] = [];
  const blocks = result.stdout.split("Certificate Name:");

  for (const block of blocks.slice(1)) {
    const domainMatch = block.match(/^\s*(\S+)/);
    const expiryMatch = block.match(/Expiry Date: ([^\(]+)/);

    if (domainMatch && expiryMatch) {
      const expiresAt = new Date(expiryMatch[1].trim());
      const daysRemaining = Math.floor(
        (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );

      certs.push({
        domain: domainMatch[1],
        expiresAt: expiresAt.toISOString(),
        daysRemaining,
        status: daysRemaining < 0 ? "expired" : daysRemaining < 30 ? "expiring" : "valid",
      });
    }
  }

  return certs;
}
```

### Revoke Certificate

```typescript
type RevokeReason =
  | "unspecified"
  | "keyCompromise"
  | "affiliationChanged"
  | "superseded"
  | "cessationOfOperation";

export async function revokeCertificate(
  serverId: string,
  domain: string,
  reason?: RevokeReason
): Promise<{ success: boolean; message: string }> {
  const certPath = `/etc/letsencrypt/live/${domain}/cert.pem`;

  const args = [
    "sudo certbot revoke",
    `--cert-path ${certPath}`,
    "--non-interactive",
    reason ? `--reason ${reason}` : "",
  ].filter(Boolean).join(" ");

  const result = await execAsyncRemote(serverId, args);

  return {
    success: result.exitCode === 0,
    message: result.exitCode === 0
      ? "Certificate revoked successfully"
      : result.stderr || "Failed to revoke certificate",
  };
}
```

### Check Certbot Installed

```typescript
export async function checkCertbotInstalled(
  serverId: string
): Promise<boolean> {
  const result = await execAsyncRemote(serverId, "which certbot 2>/dev/null");
  return result.exitCode === 0 && result.stdout.trim().length > 0;
}
```

## Error Handling

### Common Errors

| Error Pattern | Meaning | Resolution |
|---------------|---------|------------|
| `too many certificates` | Rate limit hit | Wait 1 hour or use staging |
| `Challenge failed` | DNS not configured | Verify DNS points to server |
| `Connection refused` | Firewall blocking | Open port 80 |
| `command not found` | Certbot not installed | Install certbot |
| `Could not find a matching server block` | No nginx config | Create site config first |

### Error Parser

```typescript
function parseCertbotError(output: string): string {
  if (output.includes("too many certificates")) {
    return "Rate limit exceeded. Wait 1 hour or use staging flag for testing.";
  }
  if (output.includes("Challenge failed")) {
    return "DNS validation failed. Ensure domain points to this server.";
  }
  if (output.includes("Connection refused")) {
    return "Connection refused. Check firewall allows port 80.";
  }
  if (output.includes("command not found")) {
    return "Certbot is not installed on this server.";
  }
  if (output.includes("Could not find a matching server block")) {
    return "No Nginx configuration found for this domain.";
  }
  return output;
}
```

## Staging vs Production

### When to Use Staging

- During development and testing
- When debugging certificate issues
- Before requesting production cert

```typescript
// Staging request (no rate limits)
await requestCertificate({
  serverId,
  domain: "test.example.com",
  email: "admin@example.com",
  staging: true,  // Uses staging server
});
```

### Rate Limits (Production)

| Limit | Value |
|-------|-------|
| Certificates per domain | 50/week |
| Failed validations | 5/hour |
| Duplicate certificates | 5/week |

Staging server has no rate limits - use for testing!

## Automatic Renewal

Certbot installs a systemd timer for automatic renewal. Check status:

```typescript
const timerStatus = await execAsyncRemote(
  serverId,
  "systemctl is-active certbot.timer 2>/dev/null || echo inactive"
);
// Returns "active" if timer is running
```

Certificates are automatically renewed when < 30 days remaining.
