# Clawdbot Gateway Architecture

The Gateway is the central control plane for Clawdbot, managing all connections, sessions, and plugins.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      Clawdbot Gateway                            │
│                   ws://127.0.0.1:18789                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Session    │  │   Channel    │  │   Plugin     │          │
│  │   Manager    │  │   Router     │  │   Host       │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                │                  │                   │
│         ▼                ▼                  ▼                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │  /main       │  │  WhatsApp    │  │  voice-call  │          │
│  │  /user:alice │  │  Telegram    │  │  memory-core │          │
│  │  /user:bob   │  │  Slack       │  │  custom-ext  │          │
│  │  /group:team │  │  Discord     │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Session Manager

Manages AI agent sessions with unique identifiers:

| Session Type | Format | Description |
|--------------|--------|-------------|
| Main | `/main` | Primary session for device owner |
| User | `/user:<id>` | Per-sender DM sessions |
| Group | `/group:<id>` | Group chat sessions |

**Session Properties:**
- `sessionId`: Unique identifier
- `model`: AI model being used
- `thinkingLevel`: Extended thinking depth
- `tokenCount`: Tokens used in session
- `costEstimate`: Estimated API cost
- `createdAt`: Session creation timestamp
- `lastActivity`: Last message timestamp

### Channel Router

Routes messages between messaging platforms and sessions:

```typescript
interface ChannelMessage {
  channel: string;         // 'whatsapp', 'telegram', etc.
  accountId: string;       // Account identifier
  senderId: string;        // Sender identifier
  chatId: string;          // Chat/conversation identifier
  messageId: string;       // Unique message ID
  content: MessageContent; // Text, media, etc.
  timestamp: number;       // Unix timestamp
}
```

### Plugin Host

Executes plugins in-process with the Gateway:

- Loads plugins at startup via jiti (TypeScript runtime)
- Validates configuration using JSON Schema
- Provides plugin API for registration
- Manages plugin lifecycle (start, stop)

## WebSocket Protocol

### Connection

```javascript
const ws = new WebSocket('ws://127.0.0.1:18789');

ws.onopen = () => {
  console.log('Connected to Gateway');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  handleMessage(message);
};
```

### Message Types

**Request:**
```json
{
  "type": "request",
  "id": "req-123",
  "method": "session.status",
  "params": {
    "sessionId": "/main"
  }
}
```

**Response:**
```json
{
  "type": "response",
  "id": "req-123",
  "result": {
    "sessionId": "/main",
    "model": "anthropic/claude-opus-4-5",
    "tokenCount": 1234
  }
}
```

**Event:**
```json
{
  "type": "event",
  "event": "message.received",
  "data": {
    "channel": "whatsapp",
    "senderId": "+1234567890",
    "content": "Hello!"
  }
}
```

## Configuration

### Gateway Settings

```json
{
  "gateway": {
    "host": "127.0.0.1",
    "port": 18789,
    "maxConnections": 100,
    "pingInterval": 30000,
    "messageTimeout": 300000
  }
}
```

### Session Settings

```json
{
  "sessions": {
    "mainSessionId": "/main",
    "defaultModel": "anthropic/claude-opus-4-5",
    "defaultThinkingLevel": "medium",
    "maxConcurrentSessions": 10,
    "sessionTimeout": 3600000
  }
}
```

## Network Ports

| Port | Service | Description |
|------|---------|-------------|
| 18789 | Gateway WebSocket | Main control plane |
| 18793 | Canvas File Server | Media serving |
| 18794 | Debug Interface | Development tools |

## Starting the Gateway

### Command Line

```bash
# Basic start
clawdbot gateway

# With specific config
clawdbot gateway --config /path/to/config.json

# Development mode with auto-reload
clawdbot gateway --watch

# Debug mode
clawdbot gateway --debug

# Specific port
clawdbot gateway --port 18800
```

### Daemon Mode

```bash
# Install as daemon
clawdbot onboard --install-daemon

# Start daemon
clawdbot daemon start

# Stop daemon
clawdbot daemon stop

# Restart daemon
clawdbot daemon restart

# Check status
clawdbot daemon status
```

## Session Management

### Creating Sessions

Sessions are created automatically when:
1. Device owner sends a message (creates `/main`)
2. New user sends a DM (creates `/user:<id>`)
3. Message received in group (creates `/group:<id>`)

### Session Lifecycle

```
┌─────────┐     ┌──────────┐     ┌─────────┐
│ Created │ ──▶ │  Active  │ ──▶ │ Expired │
└─────────┘     └──────────┘     └─────────┘
                     │
                     ▼
               ┌──────────┐
               │  Reset   │ (/new command)
               └──────────┘
```

### Session Commands

| Command | Description |
|---------|-------------|
| `/new` | Reset session, clear history |
| `/status` | Show session info |
| `/think <level>` | Set thinking level |
| `/model <name>` | Change AI model |

## Multi-Agent Coordination

### Agent-to-Agent Tools

```typescript
// List active sessions
const sessions = await sessions_list();

// Get session history
const history = await sessions_history({
  sessionId: '/user:alice'
});

// Send message to another session
await sessions_send({
  sessionId: '/user:bob',
  message: 'Please review this document'
});
```

### Workspace Isolation

Each session runs in isolated workspace:

```
~/.clawdbot/
├── agents/
│   ├── main/
│   │   └── sessions/
│   │       └── 2024-01-15_session.jsonl
│   ├── user_alice/
│   │   └── sessions/
│   └── user_bob/
│       └── sessions/
```

## Error Handling

### Connection Errors

```typescript
ws.onerror = (error) => {
  console.error('Gateway connection error:', error);
  // Attempt reconnection with backoff
  reconnectWithBackoff();
};

ws.onclose = (event) => {
  if (event.code !== 1000) {
    console.log('Unexpected disconnect, reconnecting...');
    reconnectWithBackoff();
  }
};
```

### Request Errors

```json
{
  "type": "error",
  "id": "req-123",
  "error": {
    "code": "SESSION_NOT_FOUND",
    "message": "Session /user:unknown does not exist"
  }
}
```

## Health Checks

### Gateway Status

```bash
# Check if Gateway is running
clawdbot status

# Detailed health check
clawdbot doctor
```

### Programmatic Check

```javascript
const ws = new WebSocket('ws://127.0.0.1:18789');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'request',
    id: 'health',
    method: 'gateway.health'
  }));
};
```

## Performance Tuning

### Memory Management

```json
{
  "gateway": {
    "maxMemoryMB": 1024,
    "gcInterval": 60000
  }
}
```

### Connection Limits

```json
{
  "gateway": {
    "maxConnections": 100,
    "maxMessagesPerSecond": 50,
    "maxPayloadSize": 10485760
  }
}
```

## Logging

### Log Levels

| Level | Description |
|-------|-------------|
| error | Critical errors |
| warn | Warnings |
| info | General information |
| debug | Debugging details |
| trace | Detailed tracing |

### Log Configuration

```json
{
  "logging": {
    "level": "info",
    "file": "~/.clawdbot/logs/gateway.log",
    "maxSize": "10MB",
    "maxFiles": 5
  }
}
```

### Viewing Logs

```bash
# View logs
clawdbot logs

# Follow logs
clawdbot logs --follow

# Filter by level
clawdbot logs --level error
```
