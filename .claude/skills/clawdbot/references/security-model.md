# Clawdbot Security Model

Complete reference for Clawdbot's security features including pairing, sandboxing, and access control.

## Overview

Clawdbot implements multiple security layers:

| Layer | Description |
|-------|-------------|
| Pairing | DM approval system |
| Access Control | Allowlist/denylist |
| Sandboxing | Docker isolation |
| Rate Limiting | Request throttling |
| Audit Logging | Activity tracking |

## DM Pairing

### How It Works

When an unknown sender messages Clawdbot:

1. Clawdbot generates a unique pairing code
2. Sender receives the code
3. Owner approves or denies via CLI
4. Approved senders can interact freely

```
┌──────────┐     ┌───────────┐     ┌─────────┐
│ Unknown  │────▶│ Clawdbot  │────▶│  Owner  │
│  Sender  │     │  Gateway  │     │   CLI   │
└──────────┘     └───────────┘     └─────────┘
     │                │                  │
     │    Code: ABC123                   │
     │◀───────────────│                  │
     │                │   clawdbot       │
     │                │   pairing        │
     │                │   approve ABC123 │
     │                │◀─────────────────│
     │                │                  │
     │   Approved!    │                  │
     │◀───────────────│                  │
```

### Configuration

```json
{
  "security": {
    "pairing": {
      "enabled": true,
      "autoApproveLocal": true,
      "codeExpiry": 300000,
      "codeLength": 6,
      "maxPendingRequests": 10
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable pairing |
| `autoApproveLocal` | boolean | `true` | Auto-approve localhost |
| `codeExpiry` | number | `300000` | Code expiry (ms) |
| `codeLength` | number | `6` | Code length |
| `maxPendingRequests` | number | `10` | Max pending |

### CLI Commands

```bash
# List pending pairing requests
clawdbot pairing list

# Approve a request
clawdbot pairing approve <channel> <code>

# Deny a request
clawdbot pairing deny <channel> <code>

# Approve all pending
clawdbot pairing approve-all

# Revoke approved sender
clawdbot pairing revoke <channel> <senderId>

# List approved senders
clawdbot pairing approved
```

### Auto-Approval

Local connections can be auto-approved:

```json
{
  "security": {
    "pairing": {
      "autoApproveLocal": true,
      "autoApprovePatterns": [
        "tailnet:*",
        "localhost:*"
      ]
    }
  }
}
```

## Access Control

### Allowlist

```json
{
  "security": {
    "allowFrom": [
      "+1234567890",
      "alice@telegram",
      "bob#1234@discord",
      "user@matrix.org"
    ]
  }
}
```

Only listed senders can interact.

### Denylist

```json
{
  "security": {
    "denyFrom": [
      "spammer@telegram",
      "blocked@discord"
    ]
  }
}
```

Listed senders are blocked.

### Combining Lists

```json
{
  "security": {
    "allowFrom": ["*@telegram"],
    "denyFrom": ["spammer@telegram"]
  }
}
```

Denylist takes precedence over allowlist.

### Group Access

```json
{
  "groups": {
    "allowedGroups": ["group1", "group2"],
    "deniedGroups": ["spam-group"],
    "ownerOnly": true
  }
}
```

## Sandboxing

### Overview

Non-main sessions can run in isolated Docker containers:

```
┌─────────────────────────────────────────┐
│              Host System                 │
├─────────────────────────────────────────┤
│  Main Session (/main)                    │
│  - Full tool access                      │
│  - No sandbox                            │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │    Docker Sandbox               │    │
│  │  ┌───────────────────────────┐  │    │
│  │  │ User Session (/user:alice)│  │    │
│  │  │ - Limited tool access     │  │    │
│  │  │ - Isolated filesystem     │  │    │
│  │  │ - Network restricted      │  │    │
│  │  └───────────────────────────┘  │    │
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

### Configuration

```json
{
  "security": {
    "sandbox": {
      "enabled": true,
      "mode": "docker",
      "image": "clawdbot/sandbox:latest",
      "network": "none",
      "memory": "512m",
      "cpus": 1,
      "timeout": 300000,
      "mountPoints": [
        {
          "host": "~/.clawdbot/sandbox-data",
          "container": "/data",
          "readOnly": false
        }
      ]
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable sandboxing |
| `mode` | string | `docker` | Sandbox mode |
| `image` | string | `clawdbot/sandbox:latest` | Docker image |
| `network` | string | `none` | Network mode |
| `memory` | string | `512m` | Memory limit |
| `cpus` | number | `1` | CPU limit |
| `timeout` | number | `300000` | Execution timeout |

### Sandbox Modes

| Mode | Description |
|------|-------------|
| `docker` | Docker container isolation |
| `podman` | Podman container |
| `firecracker` | microVM isolation |
| `none` | No sandboxing |

### Per-Session Sandbox

```json
{
  "sessions": {
    "patterns": {
      "/user:*": {
        "sandbox": true
      },
      "/group:*": {
        "sandbox": true
      },
      "/main": {
        "sandbox": false
      }
    }
  }
}
```

## Rate Limiting

### Configuration

```json
{
  "security": {
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000,
      "message": "Too many requests. Please slow down.",
      "skipMain": true
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable rate limiting |
| `maxRequests` | number | `100` | Max requests per window |
| `windowMs` | number | `60000` | Window duration (ms) |
| `message` | string | - | Rate limit message |
| `skipMain` | boolean | `true` | Skip main session |

### Per-Sender Limits

```json
{
  "security": {
    "rateLimit": {
      "perSender": {
        "maxRequests": 20,
        "windowMs": 60000
      },
      "perChannel": {
        "maxRequests": 500,
        "windowMs": 60000
      }
    }
  }
}
```

## Audit Logging

### Configuration

```json
{
  "security": {
    "audit": {
      "enabled": true,
      "logPath": "~/.clawdbot/logs/audit.log",
      "events": [
        "pairing",
        "message",
        "tool",
        "session"
      ],
      "retention": "30d"
    }
  }
}
```

### Logged Events

| Event | Data |
|-------|------|
| `pairing.request` | sender, channel, code |
| `pairing.approve` | sender, channel |
| `pairing.deny` | sender, channel |
| `message.received` | sender, channel, preview |
| `message.sent` | recipient, channel |
| `tool.execute` | tool, session, input |
| `session.create` | sessionId, sender |
| `session.reset` | sessionId |

### Viewing Audit Logs

```bash
# View recent audit events
clawdbot audit show

# Filter by event type
clawdbot audit show --type pairing

# Filter by sender
clawdbot audit show --sender "alice@telegram"

# Export to JSON
clawdbot audit export --format json > audit.json
```

## Tool Permissions

### Per-Session Tools

```json
{
  "sessions": {
    "patterns": {
      "/main": {
        "tools": {
          "browser": true,
          "camera": true,
          "screen": true,
          "files": true
        }
      },
      "/user:*": {
        "tools": {
          "browser": false,
          "camera": false,
          "screen": false,
          "files": {
            "enabled": true,
            "paths": ["~/.clawdbot/sandbox-data"]
          }
        }
      }
    }
  }
}
```

### Tool Categories

| Category | Tools |
|----------|-------|
| `safe` | text processing, math |
| `network` | browser, webhooks |
| `device` | camera, screen, voice |
| `filesystem` | files, workspace |

```json
{
  "sessions": {
    "patterns": {
      "/user:*": {
        "toolCategories": ["safe"]
      }
    }
  }
}
```

## Authentication

### OAuth

For services requiring OAuth:

```json
{
  "auth": {
    "oauth": {
      "google": {
        "clientId": "your-client-id",
        "clientSecret": "your-client-secret"
      }
    }
  }
}
```

### API Keys

```json
{
  "auth": {
    "apiKeys": {
      "internal": {
        "key": "your-api-key",
        "permissions": ["read", "write"]
      }
    }
  }
}
```

## Encryption

### At Rest

Session data and credentials are encrypted:

```json
{
  "security": {
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm",
      "keyPath": "~/.clawdbot/keys/master.key"
    }
  }
}
```

### In Transit

All WebSocket connections use encryption:

```json
{
  "gateway": {
    "tls": {
      "enabled": true,
      "cert": "~/.clawdbot/certs/server.crt",
      "key": "~/.clawdbot/certs/server.key"
    }
  }
}
```

## Best Practices

### Production Checklist

- [ ] Enable pairing for unknown senders
- [ ] Configure allowlist for expected users
- [ ] Enable sandboxing for non-main sessions
- [ ] Configure rate limiting
- [ ] Enable audit logging
- [ ] Restrict tool access per session
- [ ] Use TLS for remote access
- [ ] Regularly review audit logs
- [ ] Rotate API keys and credentials

### Security Hardening

```json
{
  "security": {
    "pairing": {
      "enabled": true,
      "autoApproveLocal": false
    },
    "sandbox": {
      "enabled": true,
      "mode": "docker",
      "network": "none"
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 50
    },
    "audit": {
      "enabled": true,
      "events": ["*"]
    }
  },
  "sessions": {
    "patterns": {
      "/user:*": {
        "sandbox": true,
        "toolCategories": ["safe"]
      }
    }
  }
}
```

## Incident Response

### Suspicious Activity

```bash
# View recent activity
clawdbot audit show --last 1h

# Block sender
clawdbot pairing revoke telegram alice@telegram

# Add to denylist
clawdbot config set security.denyFrom '["alice@telegram"]'

# Restart with new config
clawdbot daemon restart
```

### Recovery

```bash
# Revoke all approvals
clawdbot pairing revoke-all

# Reset to defaults
clawdbot config reset security

# Clear sessions
clawdbot sessions clear --all
```
