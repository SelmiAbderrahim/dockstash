# Clawdbot Configuration Reference

Complete reference for Clawdbot configuration options.

## Configuration File

### Location

Primary configuration file: `~/.clawdbot/clawdbot.json`

Alternative locations:
- `$CLAWDBOT_CONFIG_PATH` (environment variable)
- `.clawdbot/clawdbot.json` (workspace)
- `./clawdbot.json` (current directory)

### Format

JSON or JSON5 (with comments):

```json5
{
  // Agent configuration
  "agent": {
    "model": "anthropic/claude-opus-4-5"
  },

  // Channel configuration
  "channels": {
    "whatsapp": {
      "enabled": true
    }
  }
}
```

## Configuration Sections

### Agent

```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5",
    "thinkingLevel": "medium",
    "temperature": 0.7,
    "maxTokens": 4096,
    "systemPrompt": "You are a helpful assistant.",
    "tools": {
      "enabled": true,
      "allowedTools": ["browser", "files"]
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `model` | string | `anthropic/claude-opus-4-5` | AI model to use |
| `thinkingLevel` | string | `medium` | Extended thinking depth |
| `temperature` | number | `0.7` | Response randomness |
| `maxTokens` | number | `4096` | Max response tokens |
| `systemPrompt` | string | - | Custom system prompt |
| `tools.enabled` | boolean | `true` | Enable tool use |
| `tools.allowedTools` | string[] | all | Allowed tools |

### Thinking Levels

| Level | Description |
|-------|-------------|
| `off` | No extended thinking |
| `low` | Brief thinking |
| `medium` | Moderate thinking |
| `high` | Deep thinking |
| `xhigh` | Maximum thinking |

### Gateway

```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789,
    "maxConnections": 100,
    "pingInterval": 30000,
    "messageTimeout": 300000,
    "debug": false
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | string | `127.0.0.1` | Bind address |
| `port` | number | `18789` | WebSocket port |
| `maxConnections` | number | `100` | Max connections |
| `pingInterval` | number | `30000` | Ping interval (ms) |
| `messageTimeout` | number | `300000` | Message timeout (ms) |
| `debug` | boolean | `false` | Debug mode |

### Sessions

```json
{
  "sessions": {
    "mainSessionId": "/main",
    "defaultModel": "anthropic/claude-opus-4-5",
    "defaultThinkingLevel": "medium",
    "maxConcurrentSessions": 10,
    "sessionTimeout": 3600000,
    "persistHistory": true,
    "historyPath": "~/.clawdbot/history"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mainSessionId` | string | `/main` | Main session ID |
| `defaultModel` | string | - | Default model for sessions |
| `defaultThinkingLevel` | string | `medium` | Default thinking level |
| `maxConcurrentSessions` | number | `10` | Max sessions |
| `sessionTimeout` | number | `3600000` | Session timeout (ms) |
| `persistHistory` | boolean | `true` | Save session history |
| `historyPath` | string | `~/.clawdbot/history` | History location |

### Channels

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "default": {
          "sessionPath": "~/.clawdbot/whatsapp-session"
        }
      }
    },
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "123456789:ABC..."
        }
      }
    }
  }
}
```

See [Channels Reference](./channels-reference.md) for channel-specific options.

### Plugins

```json
{
  "plugins": {
    "enabled": true,
    "allow": ["voice-call", "memory-core"],
    "deny": ["untrusted-plugin"],
    "load": {
      "paths": ["~/Projects/my-plugin"]
    },
    "entries": {
      "voice-call": {
        "enabled": true,
        "config": {
          "provider": "twilio"
        }
      }
    },
    "slots": {
      "memory": "memory-core"
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable plugins |
| `allow` | string[] | all | Allowed plugins |
| `deny` | string[] | [] | Denied plugins |
| `load.paths` | string[] | [] | Additional load paths |
| `entries` | object | {} | Per-plugin config |
| `slots` | object | {} | Exclusive plugin slots |

### Hooks

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "session-memory": {
          "enabled": true
        },
        "command-logger": {
          "enabled": false
        }
      }
    },
    "webhooks": {
      "enabled": true,
      "port": 18796,
      "endpoints": [
        {
          "path": "/webhook/github",
          "secret": "your-secret"
        }
      ]
    }
  }
}
```

### Tools

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "headless": false
    },
    "canvas": {
      "enabled": true,
      "port": 18793
    },
    "camera": {
      "enabled": true
    },
    "screen": {
      "enabled": true,
      "recording": true
    },
    "files": {
      "enabled": true,
      "allowedPaths": ["~/.clawdbot/workspace"]
    },
    "webhooks": {
      "enabled": true
    },
    "cron": {
      "enabled": true,
      "jobs": []
    },
    "voice": {
      "enabled": true,
      "provider": "elevenlabs"
    }
  }
}
```

See [Tools Reference](./tools-reference.md) for tool-specific options.

### Security

```json
{
  "security": {
    "allowFrom": ["+1234567890", "user@telegram"],
    "denyFrom": ["spammer@telegram"],
    "pairing": {
      "enabled": true,
      "autoApproveLocal": true,
      "codeExpiry": 300000
    },
    "sandbox": {
      "enabled": true,
      "mode": "docker"
    },
    "rateLimit": {
      "enabled": true,
      "maxRequests": 100,
      "windowMs": 60000
    }
  }
}
```

See [Security Model](./security-model.md) for detailed options.

### Logging

```json
{
  "logging": {
    "level": "info",
    "file": "~/.clawdbot/logs/gateway.log",
    "maxSize": "10MB",
    "maxFiles": 5,
    "console": true,
    "format": "pretty"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `level` | string | `info` | Log level |
| `file` | string | - | Log file path |
| `maxSize` | string | `10MB` | Max file size |
| `maxFiles` | number | `5` | Max rotated files |
| `console` | boolean | `true` | Console output |
| `format` | string | `pretty` | Output format |

### Groups

```json
{
  "groups": {
    "activation": "mention",
    "mentionPrefix": "@bot",
    "commandPrefix": "/",
    "ownerOnly": false,
    "allowedGroups": ["group1", "group2"]
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `activation` | string | `mention` | Group activation mode |
| `mentionPrefix` | string | `@bot` | Mention trigger |
| `commandPrefix` | string | `/` | Command prefix |
| `ownerOnly` | boolean | `false` | Owner-only commands |
| `allowedGroups` | string[] | all | Allowed group IDs |

## Environment Variables

### Loading Precedence

1. Process environment (shell/daemon)
2. Local `.env` file (current directory)
3. Global `.env` file (`~/.clawdbot/.env`)
4. Config `env` block
5. Shell environment import (if enabled)

### Common Variables

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `CLAWDBOT_CONFIG_PATH` | Config file path |
| `CLAWDBOT_STATE_DIR` | State directory |
| `CLAWDBOT_LOG_LEVEL` | Override log level |
| `CLAWDBOT_DEBUG` | Enable debug mode |

### Config env Block

```json
{
  "env": {
    "vars": {
      "MY_API_KEY": "your-key",
      "CUSTOM_VAR": "value"
    },
    "shellEnv": {
      "enabled": true,
      "timeoutMs": 5000
    }
  }
}
```

### Variable Substitution

```json
{
  "agent": {
    "model": "${DEFAULT_MODEL:-anthropic/claude-opus-4-5}"
  },
  "channels": {
    "telegram": {
      "accounts": {
        "default": {
          "botToken": "${TELEGRAM_BOT_TOKEN}"
        }
      }
    }
  }
}
```

## Validation

### CLI Validation

```bash
# Validate configuration
clawdbot config check

# Show effective configuration
clawdbot config show

# Show specific section
clawdbot config show agent

# Edit configuration
clawdbot config edit
```

### JSON Schema

Configuration is validated against JSON Schema. Invalid configurations produce detailed error messages.

## Profiles

### Development Profile

```json
{
  "profile": "development",
  "gateway": {
    "debug": true
  },
  "logging": {
    "level": "debug",
    "console": true
  }
}
```

### Production Profile

```json
{
  "profile": "production",
  "gateway": {
    "debug": false
  },
  "logging": {
    "level": "info",
    "file": "~/.clawdbot/logs/gateway.log"
  },
  "security": {
    "sandbox": {
      "enabled": true
    }
  }
}
```

## Migration

### Upgrading Configuration

When upgrading Clawdbot, configuration may need migration:

```bash
# Check for migration
clawdbot config migrate --dry-run

# Apply migration
clawdbot config migrate
```

### Backup

```bash
# Backup configuration
cp ~/.clawdbot/clawdbot.json ~/.clawdbot/clawdbot.json.backup
```

## Best Practices

1. **Use environment variables** for secrets
2. **Validate configuration** after changes
3. **Keep backups** before major updates
4. **Use JSON5** for comments and readability
5. **Test changes** in development first
6. **Document custom settings** for your team
