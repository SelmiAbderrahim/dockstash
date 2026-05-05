# Clawdbot Plugins Guide

Complete guide for developing and distributing Clawdbot plugins.

## Overview

Plugins extend Clawdbot with modular features including:
- Gateway RPC methods
- CLI commands
- Agent tools
- Background services
- Custom messaging channels
- OAuth providers
- Skills

## Plugin Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Clawdbot Gateway                         │
├─────────────────────────────────────────────────────────────┤
│                      Plugin Host                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ voice    │  │ memory   │  │ custom   │  │ oauth    │   │
│  │ -call    │  │ -core    │  │ -plugin  │  │ -google  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Plugin Structure

### Minimal Plugin

```
my-plugin/
├── clawdbot.plugin.json    # Manifest (required)
└── index.ts                # Entry point (required)
```

### Full Plugin

```
my-plugin/
├── clawdbot.plugin.json    # Manifest
├── index.ts                # Entry point
├── package.json            # NPM package
├── tsconfig.json           # TypeScript config
├── src/
│   ├── commands/           # CLI commands
│   ├── tools/              # Agent tools
│   ├── services/           # Background services
│   └── utils/              # Utilities
├── skills/                 # Bundled skills
│   └── my-skill/
│       └── SKILL.md
└── test/
    └── plugin.test.ts
```

## Manifest File

### Basic Manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "Description of what the plugin does",
  "main": "index.ts"
}
```

### Full Manifest

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A comprehensive plugin example",
  "author": "Your Name",
  "license": "MIT",
  "main": "index.ts",
  "skills": ["skills/my-skill"],
  "configSchema": {
    "type": "object",
    "properties": {
      "apiKey": {
        "type": "string",
        "description": "API key for external service"
      },
      "enabled": {
        "type": "boolean",
        "default": true
      },
      "maxRetries": {
        "type": "number",
        "default": 3,
        "minimum": 1,
        "maximum": 10
      }
    },
    "required": ["apiKey"]
  },
  "uiHints": {
    "apiKey": {
      "label": "API Key",
      "sensitive": true,
      "placeholder": "Enter your API key"
    },
    "enabled": {
      "label": "Enable Plugin"
    },
    "maxRetries": {
      "label": "Max Retries",
      "description": "Number of retry attempts"
    }
  }
}
```

## Plugin Implementation

### Entry Point

```typescript
// index.ts
import type { PluginApi, PluginConfig } from 'clawdbot';

interface MyPluginConfig {
  apiKey: string;
  enabled: boolean;
  maxRetries: number;
}

export default function (api: PluginApi<MyPluginConfig>) {
  const config = api.config;
  const logger = api.logger;

  logger.info('My Plugin initialized', { enabled: config.enabled });

  // Register features...
}
```

### Object Form

```typescript
export default {
  id: 'my-plugin',
  name: 'My Plugin',
  configSchema: { /* ... */ },

  register(api) {
    // Register features...
  },

  unregister(api) {
    // Cleanup...
  }
};
```

## Registering Features

### Gateway RPC Methods

```typescript
api.registerGatewayMethod('myplugin.status', ({ params, respond }) => {
  respond(true, {
    status: 'ok',
    version: '1.0.0',
    uptime: process.uptime()
  });
});

api.registerGatewayMethod('myplugin.process', async ({ params, respond }) => {
  try {
    const result = await processData(params.data);
    respond(true, { result });
  } catch (error) {
    respond(false, { error: error.message });
  }
});
```

### HTTP Handlers

```typescript
api.registerHttpHandler({
  method: 'POST',
  path: '/myplugin/webhook',
  handler: async (req, res) => {
    const body = await req.json();
    // Process webhook
    res.json({ ok: true });
  }
});

api.registerHttpHandler({
  method: 'GET',
  path: '/myplugin/health',
  handler: (req, res) => {
    res.json({ status: 'healthy' });
  }
});
```

### CLI Commands

```typescript
api.registerCli(({ program }) => {
  program
    .command('myplugin')
    .description('My plugin commands')
    .addCommand(
      new program.Command('status')
        .description('Show plugin status')
        .action(async () => {
          console.log('Plugin is running');
        })
    )
    .addCommand(
      new program.Command('config')
        .description('Show configuration')
        .action(async () => {
          console.log(JSON.stringify(api.config, null, 2));
        })
    );
}, { commands: ['myplugin'] });
```

### Auto-Reply Commands

Commands that respond without AI invocation:

```typescript
api.registerCommand({
  name: 'ping',
  description: 'Ping the plugin',
  handler: (ctx) => ({
    text: `Pong! Latency: ${Date.now() - ctx.timestamp}ms`,
  }),
});

api.registerCommand({
  name: 'stats',
  description: 'Show statistics',
  aliases: ['status', 'info'],
  handler: async (ctx) => {
    const stats = await getStats();
    return {
      text: `Messages: ${stats.messages}\nUsers: ${stats.users}`,
    };
  },
});
```

### Agent Tools

```typescript
api.registerTool({
  name: 'myplugin_search',
  description: 'Search for data using the plugin',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query'
      },
      limit: {
        type: 'number',
        description: 'Maximum results',
        default: 10
      }
    },
    required: ['query']
  },
  handler: async ({ query, limit }) => {
    const results = await search(query, limit);
    return {
      content: JSON.stringify(results, null, 2)
    };
  }
});
```

### Background Services

```typescript
api.registerService({
  id: 'my-background-service',
  start: async () => {
    api.logger.info('Service starting...');

    // Start background tasks
    const interval = setInterval(() => {
      checkStatus();
    }, 60000);

    // Return cleanup function
    return () => {
      clearInterval(interval);
    };
  },
  stop: async () => {
    api.logger.info('Service stopping...');
  }
});
```

### Custom Channels

```typescript
api.registerChannel({
  plugin: {
    id: 'mychannel',
    meta: {
      id: 'mychannel',
      label: 'My Channel',
      selectionLabel: 'My Channel (API)',
      docsPath: '/channels/mychannel',
      blurb: 'Custom messaging channel',
      aliases: ['mc']
    },
    capabilities: {
      chatTypes: ['direct', 'group']
    },
    config: {
      listAccountIds: (cfg) =>
        Object.keys(cfg.channels?.mychannel?.accounts ?? {}),
      resolveAccount: (cfg, accountId) =>
        cfg.channels?.mychannel?.accounts?.[accountId ?? 'default']
    },
    outbound: {
      deliveryMode: 'direct',
      sendText: async ({ text, chatId, account }) => {
        // Send message
        return { ok: true };
      },
      sendMedia: async ({ media, chatId, account }) => {
        // Send media
        return { ok: true };
      }
    },
    inbound: {
      // Webhook or polling setup
    }
  }
});
```

### OAuth Providers

```typescript
api.registerProvider({
  id: 'myservice',
  label: 'My Service',
  auth: [{
    id: 'oauth',
    label: 'OAuth',
    kind: 'oauth',
    run: async (ctx) => {
      // OAuth flow
      const tokens = await ctx.oauth({
        authUrl: 'https://myservice.com/oauth/authorize',
        tokenUrl: 'https://myservice.com/oauth/token',
        clientId: 'your-client-id',
        scopes: ['read', 'write']
      });

      return {
        profiles: [{
          profileId: 'myservice:default',
          credential: {
            type: 'oauth',
            provider: 'myservice',
            access: tokens.access_token,
            refresh: tokens.refresh_token,
            expires: Date.now() + tokens.expires_in * 1000
          }
        }],
        defaultModel: 'myservice/model-1'
      };
    }
  }, {
    id: 'apikey',
    label: 'API Key',
    kind: 'apikey',
    run: async (ctx) => {
      const apiKey = await ctx.prompter.prompt('Enter API Key:');
      return {
        profiles: [{
          profileId: 'myservice:apikey',
          credential: {
            type: 'apikey',
            provider: 'myservice',
            key: apiKey
          }
        }]
      };
    }
  }]
});
```

## Plugin Configuration

### In clawdbot.json

```json
{
  "plugins": {
    "enabled": true,
    "allow": ["my-plugin", "voice-call"],
    "deny": ["untrusted-plugin"],
    "load": {
      "paths": [
        "~/Projects/my-plugin"
      ]
    },
    "entries": {
      "my-plugin": {
        "enabled": true,
        "config": {
          "apiKey": "your-api-key",
          "maxRetries": 5
        }
      }
    },
    "slots": {
      "memory": "memory-core"
    }
  }
}
```

### Exclusive Slots

Some plugins are mutually exclusive:

```json
{
  "plugins": {
    "slots": {
      "memory": "memory-lancedb"
    }
  }
}
```

## Plugin Discovery

Plugins are discovered from these locations:

1. **Configured paths**: `plugins.load.paths`
2. **Workspace extensions**: `.clawdbot/extensions/`
3. **Global extensions**: `~/.clawdbot/extensions/`
4. **Bundled extensions**: (disabled by default)

## CLI Management

```bash
# List all plugins
clawdbot plugins list

# Show plugin info
clawdbot plugins info my-plugin

# Install from path
clawdbot plugins install ~/Projects/my-plugin

# Install with symlink (dev mode)
clawdbot plugins install -l ~/Projects/my-plugin

# Install from npm
clawdbot plugins install @clawdbot/voice-call

# Enable/disable
clawdbot plugins enable my-plugin
clawdbot plugins disable my-plugin

# Update
clawdbot plugins update my-plugin

# Check health
clawdbot plugins doctor
```

## Distribution

### Package Structure

```json
{
  "name": "@myscope/my-plugin",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "clawdbot": {
    "extensions": ["dist/index.js"]
  },
  "scripts": {
    "build": "tsc",
    "prepublish": "npm run build"
  }
}
```

### Publishing

```bash
# Build
npm run build

# Test locally
clawdbot plugins install -l .

# Publish to npm
npm publish
```

## Testing

### Unit Tests

```typescript
// test/plugin.test.ts
import { describe, it, expect } from 'vitest';
import plugin from '../index';

describe('My Plugin', () => {
  it('should register successfully', () => {
    const mockApi = createMockApi();
    plugin(mockApi);
    expect(mockApi.registeredMethods).toContain('myplugin.status');
  });
});
```

### Integration Tests

```bash
# Run with Clawdbot test harness
clawdbot test plugins my-plugin
```

## Best Practices

### Security

- Never store secrets in code
- Use config for sensitive values
- Validate all inputs
- Handle errors gracefully

### Performance

- Avoid blocking operations
- Use async/await properly
- Implement timeouts
- Cache when appropriate

### Compatibility

- Check Clawdbot version
- Handle missing features gracefully
- Document requirements
- Test with multiple versions

### Logging

```typescript
// Use plugin logger
api.logger.info('Message', { context: data });
api.logger.warn('Warning', { issue: 'description' });
api.logger.error('Error', { error: err.message });

// Don't use console.log
```

## Official Plugins

| Plugin | Description |
|--------|-------------|
| `voice-call` | Twilio voice integration |
| `memory-core` | Basic memory/recall |
| `memory-lancedb` | LanceDB vector memory |
| `zalo` | Zalo messaging |
| `matrix` | Matrix protocol |
| `teams` | Microsoft Teams |
| `nostr` | Nostr protocol |
| `oauth-google` | Google OAuth |
| `oauth-gemini` | Gemini OAuth |
