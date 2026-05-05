# Nginx Config Templates Reference

## Template Functions

### generateLocationBlock()

Generates the location block for proxying requests.

```typescript
interface NginxLocation {
  path?: string;           // Location path (default: "/")
  upstream: string;        // Upstream host (e.g., "127.0.0.1")
  port: number;           // Upstream port
  websocket?: boolean;    // Enable WebSocket support (default: true)
}

function generateLocationBlock(options: NginxLocation): string;
```

**Output:**
```nginx
location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_buffer_size 4k;
    proxy_buffers 8 4k;

    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # WebSocket support
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```

### generateSSLDirectives()

Generates SSL configuration with OCSP stapling.

```typescript
interface NginxSSLConfig {
  domain: string;
  certPath?: string;      // Custom cert path
  keyPath?: string;       // Custom key path
}

function generateSSLDirectives(config: NginxSSLConfig): string;
```

**Output:**
```nginx
ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

ssl_stapling on;
ssl_stapling_verify on;
resolver 8.8.8.8 8.8.4.4 valid=300s;
resolver_timeout 5s;
```

### generateServerBlock()

Generates a complete HTTPS server block with security headers.

```typescript
interface NginxServerBlock {
  domain: string;
  upstream: string;
  port: number;
  https?: boolean;
  websocket?: boolean;
}

function generateServerBlock(config: NginxServerBlock): string;
```

**Output:**
```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name example.com;

    ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 8.8.8.8 8.8.4.4 valid=300s;
    resolver_timeout 5s;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

### generateHttpToHttpsRedirect()

Generates HTTP to HTTPS redirect block.

```typescript
function generateHttpToHttpsRedirect(domain: string): string;
```

**Output:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    location / {
        return 301 https://$server_name$request_uri;
    }
}
```

### generateFullConfig()

Generates complete domain configuration (HTTP redirect + HTTPS server).

```typescript
interface NginxDomainConfig {
  domain: string;
  upstream: string;
  port: number;
  https?: boolean;
  websocket?: boolean;
}

function generateFullConfig(config: NginxDomainConfig): string;
```

**Output:** Complete configuration combining HTTP redirect and HTTPS server block.

### generateCertbotChallengeConfig()

Generates minimal config for Certbot HTTP-01 challenge.

```typescript
function generateCertbotChallengeConfig(domain: string): string;
```

**Output:**
```nginx
server {
    listen 80;
    listen [::]:80;
    server_name example.com;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 444;
    }
}
```

## Usage Patterns

### Creating Domain Config

```typescript
import { generateFullConfig } from "@dokploy/server/utils/nginx/templates";

const config = generateFullConfig({
  domain: "app.example.com",
  upstream: "127.0.0.1",
  port: 3000,
  https: true,
  websocket: true,
});

// Write to server
await writeNginxConfig(serverId, "app.example.com.conf", config);
```

### Creating HTTP-Only Config

```typescript
import { generateServerBlock } from "@dokploy/server/utils/nginx/templates";

const config = generateServerBlock({
  domain: "app.example.com",
  upstream: "127.0.0.1",
  port: 3000,
  https: false,
});
```

### Creating Challenge Config for Certbot

```typescript
import { generateCertbotChallengeConfig } from "@dokploy/server/utils/nginx/templates";

// 1. Write challenge config
const challengeConfig = generateCertbotChallengeConfig("app.example.com");
await writeNginxConfig(serverId, "app.example.com.conf", challengeConfig);
await enableNginxSite(serverId, "app.example.com.conf");
await reloadNginx(serverId);

// 2. Request certificate
await requestCertificate(serverId, "app.example.com", "admin@example.com");

// 3. Replace with full config
const fullConfig = generateFullConfig({ domain: "app.example.com", ... });
await writeNginxConfig(serverId, "app.example.com.conf", fullConfig);
await reloadNginx(serverId);
```

## Security Headers

All HTTPS server blocks include these security headers by default:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `SAMEORIGIN` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |

## WebSocket Support

WebSocket headers are included by default in all location blocks:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
```

This ensures WebSocket connections work for real-time features (logs, monitoring, etc.).
