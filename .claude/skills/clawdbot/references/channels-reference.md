# Clawdbot Channels Reference

Complete reference for all 12+ messaging channels supported by Clawdbot.

## Channel Overview

| Channel | Protocol | Auth Method | Features |
|---------|----------|-------------|----------|
| WhatsApp | Baileys WebSocket | QR Code | DM, Groups, Media |
| Telegram | grammY | Bot Token | DM, Groups, Channels, Media |
| Slack | Bot API | OAuth/Token | DM, Channels, Threads |
| Discord | discord.js | Bot Token | DM, Servers, Threads |
| iMessage | imsg CLI | System Auth | DM, Groups |
| Signal | Signal-CLI | Phone Number | DM, Groups |
| Microsoft Teams | Bot Framework | Azure AD | DM, Teams, Channels |
| Matrix | matrix-js-sdk | Access Token | DM, Rooms |
| Zalo | API | OAuth | DM, Groups |
| Google Chat | Webhook | Service Account | Spaces |
| WebChat | Browser | Session | Direct |

## WhatsApp

### Setup

```bash
# Add WhatsApp channel
clawdbot channels add whatsapp

# Authenticate via QR code
clawdbot channels auth whatsapp
```

### Configuration

```json
{
  "channels": {
    "whatsapp": {
      "enabled": true,
      "accounts": {
        "default": {
          "sessionPath": "~/.clawdbot/whatsapp-session",
          "markOnlineOnConnect": true,
          "syncFullHistory": false,
          "qrTimeout": 60000
        }
      }
    }
  }
}
```

### Features

- **Direct Messages**: Full support
- **Group Chats**: Mention-based activation
- **Media**: Images, audio, video, documents
- **Reactions**: Supported
- **Status**: Read receipts, online status

### Troubleshooting

```bash
# Re-authenticate
clawdbot channels auth whatsapp

# Clear session
rm -rf ~/.clawdbot/whatsapp-session
clawdbot channels auth whatsapp

# Check status
clawdbot channels status whatsapp
```

## Telegram

### Setup

1. Create bot via [@BotFather](https://t.me/botfather)
2. Get bot token
3. Configure Clawdbot

```bash
clawdbot channels add telegram
```

### Configuration

```json
{
  "channels": {
    "telegram": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "123456789:ABCdefGHIjklMNOpqrSTUvwxYZ",
          "webhookUrl": null,
          "allowedUpdates": ["message", "callback_query"]
        }
      }
    }
  }
}
```

### Features

- **Direct Messages**: Full support
- **Group Chats**: Bot commands, mention activation
- **Channels**: Post and comment support
- **Media**: All Telegram media types
- **Inline Mode**: Inline queries
- **Callback Queries**: Button interactions

### Bot Commands

Register commands with BotFather:
```
/status - Show session status
/new - Start new session
/think - Set thinking level
/help - Show help
```

## Slack

### Setup

1. Create Slack App at [api.slack.com](https://api.slack.com/apps)
2. Enable Socket Mode
3. Get Bot Token and App Token

```bash
clawdbot channels add slack
```

### Configuration

```json
{
  "channels": {
    "slack": {
      "enabled": true,
      "accounts": {
        "workspace": {
          "botToken": "xoxb-your-bot-token",
          "appToken": "xapp-your-app-token",
          "signingSecret": "your-signing-secret"
        }
      }
    }
  }
}
```

### Required Scopes

**Bot Token Scopes:**
- `chat:write` - Send messages
- `channels:history` - Read channel messages
- `groups:history` - Read private channel messages
- `im:history` - Read DMs
- `users:read` - Read user info

**App Token Scopes:**
- `connections:write` - Socket Mode

### Features

- **Direct Messages**: Full support
- **Channels**: Public and private
- **Threads**: Reply threading
- **Blocks**: Rich message formatting
- **Modals**: Interactive dialogs
- **Shortcuts**: Message and global shortcuts

## Discord

### Setup

1. Create Discord Application at [discord.com/developers](https://discord.com/developers/applications)
2. Create Bot and get token
3. Invite bot to server

```bash
clawdbot channels add discord
```

### Configuration

```json
{
  "channels": {
    "discord": {
      "enabled": true,
      "accounts": {
        "default": {
          "botToken": "your-discord-bot-token",
          "intents": ["Guilds", "GuildMessages", "DirectMessages", "MessageContent"]
        }
      }
    }
  }
}
```

### Required Intents

- `Guilds` - Server access
- `GuildMessages` - Server messages
- `DirectMessages` - DM access
- `MessageContent` - Read message content (privileged)

### Features

- **Direct Messages**: Full support
- **Servers**: Multiple server support
- **Threads**: Public and private threads
- **Slash Commands**: Discord commands
- **Embeds**: Rich message formatting
- **Reactions**: Message reactions

## iMessage

### Requirements

- macOS only
- Messages app configured
- `imsg` CLI tool

### Setup

```bash
# Install imsg (macOS)
brew install imsg

clawdbot channels add imessage
```

### Configuration

```json
{
  "channels": {
    "imessage": {
      "enabled": true,
      "accounts": {
        "default": {
          "pollingInterval": 1000
        }
      }
    }
  }
}
```

### Features

- **Direct Messages**: Full support
- **Group Chats**: iMessage groups
- **SMS**: Via iPhone relay
- **Tapbacks**: Reactions

### Limitations

- macOS only
- Requires Messages app
- No end-to-end encryption access

## Signal

### Setup

```bash
# Install signal-cli
brew install signal-cli  # macOS
# or
apt install signal-cli   # Linux

# Register phone number
signal-cli -u +1234567890 register

# Verify with SMS code
signal-cli -u +1234567890 verify CODE

clawdbot channels add signal
```

### Configuration

```json
{
  "channels": {
    "signal": {
      "enabled": true,
      "accounts": {
        "default": {
          "phoneNumber": "+1234567890",
          "configPath": "~/.local/share/signal-cli"
        }
      }
    }
  }
}
```

### Features

- **Direct Messages**: Full E2E encryption
- **Group Chats**: Signal groups
- **Media**: Images, audio, files
- **Disappearing Messages**: Supported

## Microsoft Teams

### Setup

1. Register app in Azure AD
2. Create Bot Channel Registration
3. Configure permissions

```bash
clawdbot channels add teams
```

### Configuration

```json
{
  "channels": {
    "teams": {
      "enabled": true,
      "accounts": {
        "default": {
          "appId": "your-azure-app-id",
          "appPassword": "your-app-password",
          "tenantId": "your-tenant-id"
        }
      }
    }
  }
}
```

### Features

- **Direct Messages**: 1:1 chats
- **Teams**: Team channels
- **Meetings**: Meeting chat
- **Adaptive Cards**: Rich formatting

## Matrix

### Setup

```bash
clawdbot channels add matrix
```

### Configuration

```json
{
  "channels": {
    "matrix": {
      "enabled": true,
      "accounts": {
        "default": {
          "homeserver": "https://matrix.org",
          "userId": "@bot:matrix.org",
          "accessToken": "your-access-token"
        }
      }
    }
  }
}
```

### Features

- **Direct Messages**: Full support
- **Rooms**: Public and private rooms
- **E2E Encryption**: Optional
- **Federation**: Cross-server messaging

## Zalo

### Setup

```bash
clawdbot channels add zalo
```

### Configuration

```json
{
  "channels": {
    "zalo": {
      "enabled": true,
      "accounts": {
        "default": {
          "appId": "your-zalo-app-id",
          "secretKey": "your-secret-key",
          "accessToken": "your-access-token"
        }
      }
    }
  }
}
```

## Google Chat

### Setup

1. Create project in Google Cloud Console
2. Enable Google Chat API
3. Create service account

```bash
clawdbot channels add googlechat
```

### Configuration

```json
{
  "channels": {
    "googlechat": {
      "enabled": true,
      "accounts": {
        "default": {
          "credentialsPath": "~/.clawdbot/google-credentials.json",
          "projectId": "your-project-id"
        }
      }
    }
  }
}
```

## WebChat

Built-in browser-based chat interface.

### Configuration

```json
{
  "channels": {
    "webchat": {
      "enabled": true,
      "port": 18800,
      "theme": "dark"
    }
  }
}
```

### Access

```bash
# Open WebChat
clawdbot webchat

# Or access directly
open http://localhost:18800
```

## Custom Channels

Create custom channels via plugins:

```typescript
const myChannel = {
  id: 'mychannel',
  meta: {
    id: 'mychannel',
    label: 'My Channel',
    blurb: 'Custom channel implementation',
  },
  capabilities: {
    chatTypes: ['direct', 'group'],
  },
  config: {
    listAccountIds: (cfg) => Object.keys(cfg.channels?.mychannel?.accounts ?? {}),
    resolveAccount: (cfg, accountId) =>
      cfg.channels?.mychannel?.accounts?.[accountId ?? 'default'],
  },
  outbound: {
    deliveryMode: 'direct',
    sendText: async ({ text, chatId }) => {
      // Send message implementation
      return { ok: true };
    },
  },
};

export default function (api) {
  api.registerChannel({ plugin: myChannel });
}
```

## Channel CLI Commands

```bash
# List all channels
clawdbot channels list

# Add a channel
clawdbot channels add <channel>

# Remove a channel
clawdbot channels remove <channel>

# Authenticate a channel
clawdbot channels auth <channel>

# Check channel status
clawdbot channels status <channel>

# Reconnect a channel
clawdbot channels reconnect <channel>
```

## Group Chat Activation

Configure how the bot responds in group chats:

```json
{
  "groups": {
    "activation": "mention",
    "mentionPrefix": "@bot",
    "commandPrefix": "/"
  }
}
```

| Mode | Description |
|------|-------------|
| `mention` | Respond only when mentioned |
| `always` | Respond to all messages |
| `command` | Respond only to commands |
