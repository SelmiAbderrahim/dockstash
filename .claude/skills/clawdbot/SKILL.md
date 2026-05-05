---
name: clawdbot
description: Comprehensive guide for using Clawdbot personal AI assistant. Use when setting up messaging integrations (WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Teams, Matrix), configuring the Gateway control plane, developing plugins/hooks, managing multi-agent workflows, or integrating device features (browser control, Canvas, camera). This skill should be used for any Clawdbot-related development, configuration, or troubleshooting.
license: MIT
metadata:
  version: "1.0"
  author: "ServerlessBase"
  category: "ai-assistant"
  source: "https://github.com/clawdbot/clawdbot"
---

# Clawdbot Personal AI Assistant

Clawdbot is a self-hosted personal AI assistant that runs locally across multiple operating systems and messaging platforms.

**Keywords**: clawdbot, personal assistant, messaging gateway, whatsapp bot, telegram bot, slack integration, discord bot, multi-agent, ai assistant, claude integration

## Overview

Clawdbot operates through a Gateway control plane that connects to messaging services, with support for:
- **12+ Messaging Platforms**: WhatsApp, Telegram, Slack, Discord, iMessage, Signal, Microsoft Teams, Matrix, Zalo, Google Chat, WebChat
- **AI Model Support**: Anthropic Claude (Pro/Max/Opus), OpenAI models
- **Plugin System**: Extensible architecture for custom features
- **Hooks**: Event-driven automation
- **Tools**: Browser control, Canvas, Camera, webhooks, cron jobs
- **Device Integration**: macOS, iOS, Android companion apps

## When to Use This Skill

- Setting up Clawdbot Gateway on a server or local machine
- Configuring messaging channel connections (WhatsApp, Telegram, etc.)
- Developing custom plugins for Clawdbot
- Creating automation hooks for agent events
- Integrating browser control or device features
- Troubleshooting connection or configuration issues
- Managing multi-agent workflows across messaging platforms

## Installation

### Requirements

- Node.js >= 22
- npm, pnpm, or bun package manager
- For WhatsApp: QR code scanner for initial authentication
- For iMessage: macOS with Messages app

### Quick Install

```bash
# Install globally
npm install -g clawdbot@latest

# Run onboarding wizard (configures Gateway, workspace, channels)
clawdbot onboard --install-daemon
```

### From Source (Development)

```bash
git clone https://github.com/clawdbot/clawdbot.git
cd clawdbot
pnpm install
pnpm ui:build
pnpm build
pnpm clawdbot onboard --install-daemon
pnpm gateway:watch  # Auto-reload on changes
```

## Configuration

### Configuration File

Location: `~/.clawdbot/clawdbot.json`

```json
{
  "agent": {
    "model": "anthropic/claude-opus-4-5",
    "thinkingLevel": "medium"
  },
  "channels": {
    "whatsapp": {
      "enabled": true
    },
    "telegram": {
      "enabled": true,
      "botToken": "YOUR_BOT_TOKEN"
    }
  },
  "plugins": {
    "enabled": true
  },
  "hooks": {
    "internal": {
      "enabled": true
    }
  }
}
```

### Environment Variables

Precedence order (highest to lowest):
1. Process environment (parent shell/daemon)
2. Local `.env` file (current directory)
3. Global `.env` file (`~/.clawdbot/.env`)
4. Config `env` block in `clawdbot.json`

```bash
# ~/.clawdbot/.env
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

## Gateway Architecture

The Gateway is the central control plane managing all connections:

```
┌─────────────────────────────────────────────────────────────┐
│                     Clawdbot Gateway                         │
│                  ws://127.0.0.1:18789                        │
├─────────────────────────────────────────────────────────────┤
│  Session Manager  │  Channel Router  │  Plugin Host         │
└─────────────────────────────────────────────────────────────┘
         │                  │                   │
         ▼                  ▼                   ▼
    ┌─────────┐      ┌───────────┐      ┌───────────┐
    │ Sessions│      │  Channels │      │  Plugins  │
    │ /main   │      │ WhatsApp  │      │  voice    │
    │ /user1  │      │ Telegram  │      │  memory   │
    │ /user2  │      │ Slack     │      │  custom   │
    └─────────┘      └───────────┘      └───────────┘
```

### Starting the Gateway

```bash
# Start Gateway daemon
clawdbot gateway

# Start with specific config
clawdbot gateway --config /path/to/clawdbot.json

# Development mode with auto-reload
clawdbot gateway --watch
```

### Network Configuration

| Port | Service | Description |
|------|---------|-------------|
| 18789 | Gateway WebSocket | Main control plane |
| 18793 | Canvas File Server | Media serving |

## Messaging Channels

### WhatsApp Setup

```bash
# Add WhatsApp channel
clawdbot channels add whatsapp

# Authenticate via QR code
clawdbot channels auth whatsapp
# Scan the QR code with WhatsApp mobile app
```

Configuration:
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
    }
  }
}
```

### Telegram Setup

```bash
# Add Telegram channel
clawdbot channels add telegram
```

Configuration:
```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ"
        }
      }
    }
  }
}
```

### Slack Setup

```bash
# Add Slack channel
clawdbot channels add slack
```

Configuration:
```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "accounts": {
        "workspace": {
          "botToken": "xoxb-your-bot-token",
          "appToken": "xapp-your-app-token"
        }
      }
    }
  }
}
```

### Discord Setup

```bash
# Add Discord channel
clawdbot channels add discord
```

Configuration:
```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "your-discord-bot-token"
        }
      }
    }
  }
}
```

### Other Channels

See reference documentation for complete setup guides:
- [Channel Reference](./references/channels-reference.md) - All 12+ channels

## Chat Commands

Available in all messaging platforms:

| Command | Description |
|---------|-------------|
| `/status` | Show session info (model, tokens, cost) |
| `/new` or `/reset` | Clear session and start fresh |
| `/think <level>` | Set thinking depth (off, low, medium, high, xhigh) |
| `/verbose on\|off` | Toggle verbose output |
| `/activation mention\|always` | Group chat activation mode |
| `/model <name>` | Switch AI model |
| `/stop` | Stop current generation |

## Plugin Development

Plugins extend Clawdbot with modular features.

### Plugin Structure

```
my-plugin/
├── clawdbot.plugin.json    # Manifest file
├── index.ts                # Entry point
└── skills/                 # Optional bundled skills
    └── my-skill/
        └── SKILL.md
```

### Manifest File

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Description of what the plugin does",
  "main": "index.ts",
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": { "type": "string" }
    }
  }
}
```

### Plugin Implementation

```typescript
// index.ts
import type { PluginApi } from 'clawdbot';

export default function (api: PluginApi) {
  // Register Gateway RPC method
  api.registerGatewayMethod('myplugin.status', ({ respond }) => {
    respond(true, { status: 'ok' });
  });

  // Register CLI command
  api.registerCli(({ program }) => {
    program.command('myplugin')
      .description('My plugin command')
      .action(() => {
        console.log('Hello from my plugin!');
      });
  }, { commands: ['myplugin'] });

  // Register auto-reply command (no AI)
  api.registerCommand({
    name: 'ping',
    description: 'Ping the plugin',
    handler: (ctx) => ({
      text: `Pong! Channel: ${ctx.channel}`,
    }),
  });

  // Register background service
  api.registerService({
    id: 'my-service',
    start: () => api.logger.info('Service started'),
    stop: () => api.logger.info('Service stopped'),
  });
}
```

### Plugin CLI

```bash
clawdbot plugins list              # List all plugins
clawdbot plugins info <id>         # Show plugin details
clawdbot plugins install <path>    # Install plugin
clawdbot plugins enable <id>       # Enable plugin
clawdbot plugins disable <id>      # Disable plugin
clawdbot plugins doctor            # Check plugin health
```

## Hooks System

Hooks are event handlers for automation.

### Hook Structure

```
my-hook/
├── HOOK.md        # Metadata and documentation
└── handler.ts     # Implementation
```

### Hook Types

| Event | Trigger |
|-------|---------|
| `command:new` | When `/new` command is issued |
| `command:reset` | When `/reset` command is issued |
| `command:stop` | When `/stop` command is issued |
| `agent:bootstrap` | Before agent starts (can modify bootstrap) |
| `gateway:startup` | After Gateway initializes |
| `tool_result_persist` | When tool results are persisted |

### Hook Implementation

```typescript
// handler.ts
import type { HookHandler } from 'clawdbot';

const handler: HookHandler = async (event) => {
  if (event.type !== 'command' || event.action !== 'new') return;

  // Log the session reset
  console.log(`Session reset: ${event.sessionId}`);

  // Send message to user
  event.messages.push('Session has been reset. Starting fresh!');
};

export default handler;
```

### Hook CLI

```bash
clawdbot hooks list           # List all hooks
clawdbot hooks enable <name>  # Enable hook
clawdbot hooks disable <name> # Disable hook
clawdbot hooks check          # Verify hooks
clawdbot hooks info <name>    # Show hook details
```

## Tools Integration

### Browser Control

```json
{
  "tools": {
    "browser": {
      "enabled": true,
      "headless": false
    }
  }
}
```

### Canvas Surface

Canvas provides a visual workspace for agents:
- Drawing and visualization
- Document rendering
- Interactive UI elements

### Camera & Screen

```json
{
  "tools": {
    "camera": {
      "enabled": true
    },
    "screen": {
      "enabled": true,
      "recording": true
    }
  }
}
```

### Webhooks

```json
{
  "tools": {
    "webhooks": {
      "enabled": true,
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

### Cron Jobs

```json
{
  "tools": {
    "cron": {
      "enabled": true,
      "jobs": [
        {
          "name": "daily-summary",
          "schedule": "0 9 * * *",
          "action": "summarize-inbox"
        }
      ]
    }
  }
}
```

## Security Model

### DM Pairing

Unknown senders receive pairing codes for approval:

```bash
# Approve a pairing request
clawdbot pairing approve <channel> <code>

# List pending requests
clawdbot pairing list

# Deny a request
clawdbot pairing deny <channel> <code>
```

### Sandbox Mode

Non-main sessions can run in Docker sandboxes:

```json
{
  "security": {
    "sandbox": {
      "enabled": true,
      "mode": "docker"
    }
  }
}
```

### Access Control

```json
{
  "security": {
    "allowFrom": [
      "+1234567890",
      "user@telegram"
    ]
  }
}
```

## Remote Access

### Tailscale Integration

```bash
# Tailnet-only HTTPS access
clawdbot serve --mode tailscale

# Public HTTPS with password
clawdbot funnel --password your-secret
```

### SSH Tunnels

```bash
# Create SSH tunnel
ssh -R 8080:localhost:18789 user@server
```

## Agent-to-Agent Communication

Three session tools enable coordination:

| Tool | Description |
|------|-------------|
| `sessions_list` | Discover active agents |
| `sessions_history` | Fetch transcripts |
| `sessions_send` | Message other sessions |

## CLI Reference

### Core Commands

```bash
clawdbot gateway                # Start Gateway
clawdbot onboard               # Setup wizard
clawdbot status                # Show status
clawdbot config check          # Validate config
```

### Channel Commands

```bash
clawdbot channels list         # List channels
clawdbot channels add <name>   # Add channel
clawdbot channels auth <name>  # Authenticate
clawdbot channels remove <name> # Remove channel
```

### Model Commands

```bash
clawdbot models list           # List available models
clawdbot models status         # Check model access
clawdbot models set <model>    # Set default model
```

### Update Commands

```bash
clawdbot update                # Update to latest
clawdbot update --channel beta # Switch to beta channel
clawdbot update --channel dev  # Switch to dev channel
```

## Troubleshooting

### Common Issues

**Gateway won't start:**
```bash
# Check if port is in use
lsof -i :18789

# Kill existing process
clawdbot gateway stop

# Start fresh
clawdbot gateway
```

**WhatsApp disconnected:**
```bash
# Re-authenticate
clawdbot channels auth whatsapp

# Check session
ls -la ~/.clawdbot/whatsapp-session/
```

**Plugin not loading:**
```bash
# Check plugin health
clawdbot plugins doctor

# Verify manifest
cat path/to/plugin/clawdbot.plugin.json
```

### Diagnostic Commands

```bash
clawdbot doctor              # Full system check
clawdbot logs                # View Gateway logs
clawdbot logs --follow       # Stream logs
clawdbot debug               # Debug mode
```

## Reference Files

- [Gateway Architecture](./references/gateway-architecture.md) - WebSocket control plane details
- [Channels Reference](./references/channels-reference.md) - All 12+ messaging channels
- [Plugins Guide](./references/plugins-guide.md) - Plugin development patterns
- [Hooks Reference](./references/hooks-reference.md) - Event-driven automation
- [Tools Reference](./references/tools-reference.md) - Browser, Canvas, Camera, etc.
- [Configuration](./references/configuration.md) - Complete config reference
- [Security Model](./references/security-model.md) - Pairing, sandboxing, permissions
- [Remote Access](./references/remote-access.md) - Tailscale, SSH tunnels
- [CLI Commands](./references/cli-commands.md) - Complete CLI reference

## Helper Scripts

- [Check Installation](./scripts/check-clawdbot.sh) - Verify Clawdbot is installed
- [Setup Channel](./scripts/setup-channel.sh) - Interactive channel setup
- [Validate Config](./scripts/validate-config.sh) - Validate configuration file
