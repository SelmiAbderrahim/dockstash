# Clawdbot Hooks Reference

Complete reference for Clawdbot's event-driven automation system.

## Overview

Hooks are TypeScript-based event handlers that automate actions in response to agent commands and lifecycle events.

## Hook Types

| Type | Description |
|------|-------------|
| Hooks | Internal handlers for agent events |
| Webhooks | External HTTP endpoints |
| Plugin Hooks | Hooks embedded in plugins |

## Discovery Locations

Hooks are discovered from these locations (in precedence order):

1. **Workspace hooks**: `<workspace>/hooks/`
2. **Managed hooks**: `~/.clawdbot/hooks/`
3. **Bundled hooks**: Shipped with Clawdbot

## Hook Structure

### Directory Layout

```
my-hook/
├── HOOK.md        # Metadata and documentation (required)
└── handler.ts     # Implementation (required)
```

### HOOK.md

```markdown
---
name: my-hook
description: Description of what this hook does
events:
  - command:new
  - command:reset
enabled: true
---

# My Hook

Documentation for the hook...
```

### handler.ts

```typescript
import type { HookHandler, HookEvent } from 'clawdbot';

const handler: HookHandler = async (event: HookEvent) => {
  // Handle event
};

export default handler;
```

## Event Categories

### Command Events

Triggered when users issue commands:

| Event | Trigger |
|-------|---------|
| `command:new` | `/new` command issued |
| `command:reset` | `/reset` command issued |
| `command:stop` | `/stop` command issued |
| `command:think` | `/think` command issued |
| `command:model` | `/model` command issued |

```typescript
const handler: HookHandler = async (event) => {
  if (event.type !== 'command') return;

  switch (event.action) {
    case 'new':
      console.log('Session reset');
      break;
    case 'stop':
      console.log('Generation stopped');
      break;
  }
};
```

### Agent Events

Triggered during agent lifecycle:

| Event | Trigger |
|-------|---------|
| `agent:bootstrap` | Before agent starts |
| `agent:complete` | After agent completes |
| `agent:error` | When agent errors |

```typescript
const handler: HookHandler = async (event) => {
  if (event.type !== 'agent') return;

  if (event.action === 'bootstrap') {
    // Modify bootstrap files
    event.bootstrap.files.push({
      path: 'CONTEXT.md',
      content: '# Additional Context\n...'
    });
  }
};
```

### Gateway Events

Triggered during Gateway lifecycle:

| Event | Trigger |
|-------|---------|
| `gateway:startup` | After Gateway initializes |
| `gateway:shutdown` | Before Gateway shuts down |
| `gateway:error` | When Gateway errors |

```typescript
const handler: HookHandler = async (event) => {
  if (event.type !== 'gateway') return;

  if (event.action === 'startup') {
    console.log('Gateway started');
  }
};
```

### Tool Events

Triggered during tool execution:

| Event | Trigger |
|-------|---------|
| `tool_result_persist` | When tool results are persisted |
| `tool:execute` | Before tool executes |
| `tool:complete` | After tool completes |

```typescript
const handler: HookHandler = async (event) => {
  if (event.type !== 'tool_result_persist') return;

  // Modify tool result
  event.result = {
    ...event.result,
    metadata: { processedBy: 'my-hook' }
  };
};
```

## Event Context

### HookEvent Interface

```typescript
interface HookEvent {
  type: 'command' | 'agent' | 'gateway' | 'tool_result_persist';
  action: string;
  sessionId: string;
  timestamp: number;
  messages: string[];  // Writable - add messages for user

  // Command events
  command?: {
    name: string;
    args: string[];
  };

  // Agent events
  bootstrap?: {
    files: BootstrapFile[];
  };

  // Tool events
  tool?: {
    name: string;
    input: any;
  };
  result?: any;
}
```

### Adding User Messages

```typescript
const handler: HookHandler = async (event) => {
  // Add message to be sent to user
  event.messages.push('Hook processed successfully!');

  // Add multiple messages
  event.messages.push(
    'Line 1',
    'Line 2',
    'Line 3'
  );
};
```

## Built-in Hooks

### session-memory

Preserves context snapshots on `/new`:

```yaml
---
name: session-memory
description: Preserves context snapshots when session resets
events:
  - command:new
---
```

### command-logger

Logs all commands:

```yaml
---
name: command-logger
description: Records all commands to log file
events:
  - command:*
---
```

Log location: `~/.clawdbot/logs/commands.log`

### boot-md

Runs workspace initialization:

```yaml
---
name: boot-md
description: Runs BOOT.md on gateway startup
events:
  - gateway:startup
---
```

### soul-evil

Conditionally swaps SOUL.md:

```yaml
---
name: soul-evil
description: Conditionally loads SOUL_EVIL.md
events:
  - agent:bootstrap
---
```

## Creating Hooks

### Step 1: Create Directory

```bash
mkdir -p ~/.clawdbot/hooks/my-hook
```

### Step 2: Create HOOK.md

```markdown
---
name: my-hook
description: My custom hook
events:
  - command:new
enabled: true
config:
  logFile: "~/.clawdbot/logs/my-hook.log"
---

# My Hook

This hook does X when Y happens.

## Configuration

- `logFile`: Path to log file
```

### Step 3: Create handler.ts

```typescript
import type { HookHandler } from 'clawdbot';
import fs from 'fs/promises';
import path from 'path';

const handler: HookHandler = async (event, config) => {
  if (event.type !== 'command' || event.action !== 'new') return;

  const logFile = config.logFile || '~/.clawdbot/logs/my-hook.log';
  const logPath = logFile.replace('~', process.env.HOME || '');

  await fs.appendFile(
    logPath,
    JSON.stringify({
      timestamp: new Date().toISOString(),
      sessionId: event.sessionId,
      action: 'session_reset'
    }) + '\n'
  );

  event.messages.push('Session logged!');
};

export default handler;
```

## Configuration

### In clawdbot.json

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "my-hook": {
          "enabled": true,
          "config": {
            "logFile": "~/logs/my-hook.log"
          }
        },
        "command-logger": {
          "enabled": false
        }
      }
    },
    "webhooks": {
      "enabled": true,
      "endpoints": [
        {
          "path": "/webhook/github",
          "secret": "your-secret",
          "handler": "github-webhook"
        }
      ]
    }
  }
}
```

### Environment Variables

```typescript
const handler: HookHandler = async (event, config) => {
  const apiKey = process.env.MY_HOOK_API_KEY;
  // Use apiKey...
};
```

## CLI Commands

```bash
# List all hooks
clawdbot hooks list

# Show hook info
clawdbot hooks info my-hook

# Enable hook
clawdbot hooks enable my-hook

# Disable hook
clawdbot hooks disable my-hook

# Check hook eligibility
clawdbot hooks check

# Test hook (dry run)
clawdbot hooks test my-hook --event command:new
```

## Webhooks

### Setup

```json
{
  "hooks": {
    "webhooks": {
      "enabled": true,
      "port": 18795,
      "endpoints": [
        {
          "path": "/webhook/github",
          "secret": "github-webhook-secret",
          "handler": "github-webhook"
        }
      ]
    }
  }
}
```

### Webhook Handler

```typescript
// hooks/github-webhook/handler.ts
import type { WebhookHandler } from 'clawdbot';

const handler: WebhookHandler = async (req, res, config) => {
  const signature = req.headers['x-hub-signature-256'];
  const body = await req.json();

  // Verify signature
  if (!verifySignature(body, signature, config.secret)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  // Process webhook
  if (body.action === 'opened' && body.pull_request) {
    // Handle PR opened
    await sendMessage(`New PR: ${body.pull_request.title}`);
  }

  res.json({ ok: true });
};

export default handler;
```

## Plugin Hooks

Hooks can be embedded in plugins:

```typescript
// In plugin index.ts
import { registerPluginHooksFromDir } from 'clawdbot';

export default function (api) {
  // Register hooks from directory
  registerPluginHooksFromDir(api, './hooks');
}
```

```
my-plugin/
├── clawdbot.plugin.json
├── index.ts
└── hooks/
    └── my-plugin-hook/
        ├── HOOK.md
        └── handler.ts
```

## Best Practices

### Keep Handlers Lightweight

```typescript
// Good - lightweight
const handler: HookHandler = async (event) => {
  event.messages.push('Quick notification');
};

// Bad - heavy processing blocks command
const handler: HookHandler = async (event) => {
  await heavyProcessing();  // Don't block!
};
```

### Handle Errors Gracefully

```typescript
const handler: HookHandler = async (event) => {
  try {
    await riskyOperation();
  } catch (error) {
    // Log but don't throw - let other hooks run
    console.error('Hook error:', error);
  }
};
```

### Use Specific Events

```yaml
# Good - specific events
events:
  - command:new
  - command:reset

# Bad - catches everything (overhead)
events:
  - command:*
  - agent:*
  - gateway:*
```

### Test Thoroughly

```bash
# Test with specific event
clawdbot hooks test my-hook --event command:new

# Test with mock data
clawdbot hooks test my-hook --event command:new --data '{"sessionId": "test"}'
```

## Debugging

### Enable Debug Logging

```json
{
  "hooks": {
    "debug": true
  }
}
```

### Check Hook Status

```bash
clawdbot hooks check
```

### View Hook Logs

```bash
# If using command-logger
tail -f ~/.clawdbot/logs/commands.log
```

## Examples

### Session Summary Hook

```typescript
// Summarize session before reset
const handler: HookHandler = async (event) => {
  if (event.type !== 'command' || event.action !== 'new') return;

  const summary = await summarizeSession(event.sessionId);
  await saveToMemory(event.sessionId, summary);

  event.messages.push(`Session summary saved: ${summary.messageCount} messages`);
};
```

### Notification Hook

```typescript
// Send notification on long-running completions
const handler: HookHandler = async (event) => {
  if (event.type !== 'agent' || event.action !== 'complete') return;

  if (event.duration > 60000) {  // > 1 minute
    await sendNotification(`Task complete: ${event.sessionId}`);
  }
};
```

### Audit Hook

```typescript
// Audit all tool executions
const handler: HookHandler = async (event) => {
  if (event.type !== 'tool') return;

  await logAudit({
    timestamp: event.timestamp,
    sessionId: event.sessionId,
    tool: event.tool?.name,
    input: event.tool?.input,
    result: event.result
  });
};
```
