# Clawdbot Remote Access

Complete reference for accessing Clawdbot remotely via Tailscale, SSH tunnels, and VPN.

## Overview

Clawdbot Gateway binds to localhost by default. Remote access requires one of:

| Method | Security | Complexity | Best For |
|--------|----------|------------|----------|
| Tailscale | High | Low | Personal use |
| SSH Tunnel | High | Medium | Server access |
| VPN | High | High | Enterprise |
| Reverse Proxy | Medium | Medium | Web access |

## Tailscale Integration

### Overview

Tailscale provides secure, zero-config VPN for accessing Clawdbot from anywhere.

```
┌──────────────┐         ┌──────────────┐
│   Mobile     │         │   Desktop    │
│   Device     │         │   Client     │
└──────┬───────┘         └──────┬───────┘
       │                        │
       └────────┬───────────────┘
                │
         ┌──────▼──────┐
         │  Tailscale  │
         │   Network   │
         └──────┬──────┘
                │
         ┌──────▼──────┐
         │  Clawdbot   │
         │   Server    │
         └─────────────┘
```

### Setup

1. Install Tailscale:
   ```bash
   # macOS
   brew install tailscale

   # Linux
   curl -fsSL https://tailscale.com/install.sh | sh

   # Authenticate
   sudo tailscale up
   ```

2. Configure Clawdbot:
   ```json
   {
     "gateway": {
       "host": "0.0.0.0",
       "port": 18789
     },
     "security": {
       "pairing": {
         "autoApprovePatterns": ["tailnet:*"]
       }
     }
   }
   ```

### Serve Mode

Expose Gateway on your tailnet only:

```bash
# Start serve mode
clawdbot serve --mode tailscale

# Custom port
clawdbot serve --mode tailscale --port 8080
```

Configuration:
```json
{
  "remote": {
    "tailscale": {
      "serve": {
        "enabled": true,
        "port": 443,
        "https": true
      }
    }
  }
}
```

Access from any tailnet device:
```
https://your-machine.tailnet-name.ts.net
```

### Funnel Mode

Expose Gateway to the public internet with authentication:

```bash
# Start funnel with password
clawdbot funnel --password your-secret-password

# Start funnel with magic link
clawdbot funnel --magic-link
```

Configuration:
```json
{
  "remote": {
    "tailscale": {
      "funnel": {
        "enabled": true,
        "auth": "password",
        "password": "your-secret"
      }
    }
  }
}
```

Access from anywhere:
```
https://your-machine.tailnet-name.ts.net
```

### Security

| Mode | Visibility | Authentication |
|------|------------|----------------|
| Serve | Tailnet only | Tailscale identity |
| Funnel | Public | Password/Magic Link |

## SSH Tunnels

### Local Port Forwarding

Access remote Clawdbot from local machine:

```bash
# Forward local port to remote Clawdbot
ssh -L 8080:localhost:18789 user@remote-server

# Now access at localhost:8080
```

### Remote Port Forwarding

Expose local Clawdbot to remote server:

```bash
# Forward remote port to local Clawdbot
ssh -R 8080:localhost:18789 user@remote-server

# Now accessible at remote-server:8080
```

### Persistent Tunnel with autossh

```bash
# Install autossh
brew install autossh  # macOS
apt install autossh   # Linux

# Create persistent tunnel
autossh -M 0 -f -N -L 8080:localhost:18789 user@remote-server
```

### SSH Config

```
# ~/.ssh/config
Host clawdbot-server
    HostName your-server.com
    User your-username
    LocalForward 8080 localhost:18789
    ServerAliveInterval 60
    ServerAliveCountMax 3
```

Then connect with:
```bash
ssh clawdbot-server
```

### Systemd Service

```ini
# /etc/systemd/system/clawdbot-tunnel.service
[Unit]
Description=Clawdbot SSH Tunnel
After=network.target

[Service]
User=your-user
ExecStart=/usr/bin/autossh -M 0 -N -L 8080:localhost:18789 user@remote-server
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable clawdbot-tunnel
sudo systemctl start clawdbot-tunnel
```

## VPN Access

### WireGuard

1. Set up WireGuard server
2. Configure Clawdbot to bind to VPN interface:

```json
{
  "gateway": {
    "host": "10.0.0.1",
    "port": 18789
  }
}
```

3. Connect clients via WireGuard

### OpenVPN

Similar configuration - bind Gateway to VPN interface IP.

## Reverse Proxy

### Nginx

```nginx
# /etc/nginx/sites-available/clawdbot
server {
    listen 443 ssl http2;
    server_name clawdbot.example.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:18789;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Caddy

```
# Caddyfile
clawdbot.example.com {
    reverse_proxy localhost:18789
}
```

### Traefik

```yaml
# docker-compose.yml
services:
  traefik:
    image: traefik:v2.10
    command:
      - "--providers.docker=true"
      - "--entrypoints.websecure.address=:443"
    ports:
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock

  clawdbot:
    image: clawdbot/clawdbot:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.clawdbot.rule=Host(`clawdbot.example.com`)"
      - "traefik.http.routers.clawdbot.tls=true"
```

## Cloud Deployments

### Railway

```bash
# Deploy to Railway
railway login
railway init
railway up
```

Configuration in `railway.toml`:
```toml
[build]
builder = "dockerfile"

[deploy]
startCommand = "clawdbot gateway"
healthcheckPath = "/health"
```

### Render

Configuration in `render.yaml`:
```yaml
services:
  - type: web
    name: clawdbot
    env: docker
    dockerfilePath: ./Dockerfile
    healthCheckPath: /health
```

### Fly.io

```bash
# Deploy to Fly.io
fly launch
fly deploy
```

Configuration in `fly.toml`:
```toml
app = "clawdbot"

[http_service]
internal_port = 18789
force_https = true
```

## Mobile Access

### iOS

1. Install Tailscale app
2. Connect to tailnet
3. Access Clawdbot via channels (WhatsApp, Telegram)

### Android

1. Install Tailscale app
2. Connect to tailnet
3. Use Clawdbot Android node app

### WebChat

Access via browser on any device:

```json
{
  "channels": {
    "webchat": {
      "enabled": true,
      "port": 18800
    }
  }
}
```

URL: `https://your-server/webchat`

## Discovery

### Bonjour/mDNS

Clawdbot announces itself on local network:

```json
{
  "discovery": {
    "mdns": {
      "enabled": true,
      "serviceName": "clawdbot",
      "serviceType": "_clawdbot._tcp"
    }
  }
}
```

Discover with:
```bash
dns-sd -B _clawdbot._tcp local.
```

### Tailscale Discovery

Automatic discovery on tailnet:

```bash
tailscale status
```

## Security Considerations

### TLS Configuration

```json
{
  "gateway": {
    "tls": {
      "enabled": true,
      "cert": "/path/to/cert.pem",
      "key": "/path/to/key.pem",
      "minVersion": "TLSv1.2"
    }
  }
}
```

### Authentication

Always use authentication for remote access:

```json
{
  "remote": {
    "auth": {
      "required": true,
      "methods": ["password", "token", "oauth"]
    }
  }
}
```

### Firewall Rules

```bash
# Allow only tailnet
sudo ufw allow from 100.64.0.0/10 to any port 18789

# Or specific IPs
sudo ufw allow from 192.168.1.0/24 to any port 18789
```

## Troubleshooting

### Connection Issues

```bash
# Check Gateway is running
clawdbot status

# Check port is listening
lsof -i :18789

# Test connectivity
curl http://localhost:18789/health
```

### Tailscale Issues

```bash
# Check Tailscale status
tailscale status

# Check serve/funnel status
tailscale serve status

# View logs
tailscale debug log
```

### SSH Tunnel Issues

```bash
# Test SSH connection
ssh -v user@remote-server

# Check tunnel is established
lsof -i :8080

# Debug autossh
AUTOSSH_DEBUG=1 autossh -M 0 -N -L 8080:localhost:18789 user@server
```

## Best Practices

1. **Use TLS** for all remote connections
2. **Prefer Tailscale** for simplicity and security
3. **Enable authentication** for public access
4. **Monitor access logs** for suspicious activity
5. **Rotate credentials** regularly
6. **Use firewall rules** to restrict access
7. **Keep Clawdbot updated** for security patches
