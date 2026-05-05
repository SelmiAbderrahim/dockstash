---
name: mcp-manager
description: |
  Manage MCP (Model Context Protocol) servers in Claude Code. Add, configure, authenticate,
  troubleshoot, and organize MCP server connections. Covers all three transport types
  (HTTP, SSE, stdio), OAuth authentication, scoping (local/project/user), managed enterprise
  configuration, Tool Search, resources, prompts, and the MCP registry.

  Use when: adding MCP servers, configuring .mcp.json, authenticating with OAuth,
  troubleshooting MCP connections, managing server scopes, setting up managed MCP,
  importing servers from Claude Desktop, using Claude Code as an MCP server,
  configuring MCP output limits, or working with MCP resources and prompts.

  Keywords: mcp, model context protocol, mcp server, mcp add, mcp remove, mcp list,
  .mcp.json, oauth, transport, stdio, http, sse, mcp registry, tool search, mcp resources,
  mcp prompts, managed mcp, mcp scope, mcp authenticate
---

# MCP Server Management Guide

## Overview

MCP (Model Context Protocol) connects Claude Code to external tools, databases, and APIs
through an open standard. This skill covers the complete lifecycle of managing MCP servers:
discovery, installation, authentication, configuration, troubleshooting, and enterprise management.

## Quick Reference

### Transport Types

| Transport | Use Case | Command Flag |
|-----------|----------|-------------|
| HTTP (Streamable) | Cloud-based remote servers (recommended) | `--transport http` |
| SSE | Legacy remote servers (deprecated) | `--transport sse` |
| stdio | Local processes with direct system access | `--transport stdio` |

### Scopes

| Scope | Storage | Visibility | Flag |
|-------|---------|------------|------|
| `local` | `~/.claude.json` (under project path) | You only, this project | `--scope local` (default) |
| `project` | `.mcp.json` in project root | Everyone via version control | `--scope project` |
| `user` | `~/.claude.json` | You only, all projects | `--scope user` |

**Precedence**: local > project > user (same-name conflicts resolved by priority).

## Adding MCP Servers

### HTTP Server (Recommended for Remote)

```bash
# Basic
claude mcp add --transport http <name> <url>

# With authentication header
claude mcp add --transport http <name> <url> \
  --header "Authorization: Bearer <token>"

# Examples
claude mcp add --transport http notion https://mcp.notion.com/mcp
claude mcp add --transport http github https://api.githubcopilot.com/mcp/
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```

### SSE Server (Deprecated - Use HTTP Instead)

```bash
claude mcp add --transport sse <name> <url>
claude mcp add --transport sse asana https://mcp.asana.com/sse
```

### stdio Server (Local Processes)

```bash
# Basic syntax - options BEFORE name, command AFTER --
claude mcp add [options] <name> -- <command> [args...]

# With environment variables
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server

# Database connection
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://user:pass@host:5432/db"
```

**Option ordering is critical**: All flags (`--transport`, `--env`, `--scope`, `--header`)
must come BEFORE the server name. The `--` separates the name from the command.

### From JSON Configuration

```bash
# HTTP server with headers
claude mcp add-json weather-api \
  '{"type":"http","url":"https://api.weather.com/mcp","headers":{"Authorization":"Bearer token"}}'

# stdio server with env
claude mcp add-json local-tool \
  '{"type":"stdio","command":"/path/to/cli","args":["--config","file.json"],"env":{"CACHE_DIR":"/tmp"}}'
```

### Import from Claude Desktop

```bash
# Interactive - select which servers to import
claude mcp add-from-claude-desktop

# Add to user scope for cross-project access
claude mcp add-from-claude-desktop --scope user
```

Works on macOS and WSL. Reads Claude Desktop configuration from its standard location.

## Managing Servers

```bash
# List all configured servers
claude mcp list

# Get details for a specific server
claude mcp get <name>

# Remove a server
claude mcp remove <name>

# Check server status (within Claude Code)
/mcp

# Reset project-scoped server approval choices
claude mcp reset-project-choices
```

## OAuth Authentication

Many cloud MCP servers require OAuth 2.0 authentication.

### Standard OAuth Flow

1. Add the server: `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp`
2. In Claude Code, run `/mcp` and follow browser login
3. Tokens are stored securely and refreshed automatically

### Fixed Callback Port

When a server requires a pre-registered redirect URI:

```bash
claude mcp add --transport http \
  --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

### Pre-configured OAuth Credentials

When a server doesn't support dynamic client registration:

```bash
# Interactive secret prompt
claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp

# Via environment variable (CI/non-interactive)
MCP_CLIENT_SECRET=your-secret claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

### Override OAuth Metadata Discovery

If standard discovery fails but OIDC endpoint works:

```json
{
  "mcpServers": {
    "my-server": {
      "type": "http",
      "url": "https://mcp.example.com/mcp",
      "oauth": {
        "authServerMetadataUrl": "https://auth.example.com/.well-known/openid-configuration"
      }
    }
  }
}
```

### Managing OAuth Sessions

- Use `/mcp` menu to "Clear authentication" to revoke access
- If browser redirect fails, paste the full callback URL from browser address bar

## Project-Scoped Configuration (.mcp.json)

The `.mcp.json` file at project root enables team-wide MCP server sharing:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "database": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@bytebase/dbhub", "--dsn", "${DATABASE_URL}"],
      "env": {}
    }
  }
}
```

### Environment Variable Expansion

Supported in `command`, `args`, `env`, `url`, and `headers`:

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": {
        "Authorization": "Bearer ${API_KEY}"
      }
    }
  }
}
```

- `${VAR}` - Expands to value of VAR
- `${VAR:-default}` - Expands to VAR if set, otherwise uses default

## Using Claude Code as an MCP Server

Claude Code can serve as an MCP server for other applications:

```bash
claude mcp serve
```

Claude Desktop configuration:

```json
{
  "mcpServers": {
    "claude-code": {
      "type": "stdio",
      "command": "claude",
      "args": ["mcp", "serve"],
      "env": {}
    }
  }
}
```

Use `which claude` to find the full executable path if `claude` is not in PATH.

## MCP Tool Search

When many MCP tools are configured, Tool Search dynamically loads tools on-demand
instead of preloading all of them.

### Configuration

Set via `ENABLE_TOOL_SEARCH` environment variable:

| Value | Behavior |
|-------|----------|
| (unset) | Enabled by default; disabled when `ANTHROPIC_BASE_URL` is non-first-party |
| `true` | Always enabled |
| `auto` | Activates when MCP tools exceed 10% of context |
| `auto:<N>` | Custom threshold (e.g., `auto:5` for 5%) |
| `false` | Disabled, all tools loaded upfront |

```bash
ENABLE_TOOL_SEARCH=auto:5 claude
```

Requires Sonnet 4+ or Opus 4+. Haiku models do not support tool search.

To disable only the MCPSearch tool:

```json
{
  "permissions": {
    "deny": ["MCPSearch"]
  }
}
```

## MCP Output Limits

| Setting | Default | Environment Variable |
|---------|---------|---------------------|
| Warning threshold | 10,000 tokens | N/A |
| Maximum output | 25,000 tokens | `MAX_MCP_OUTPUT_TOKENS` |

```bash
MAX_MCP_OUTPUT_TOKENS=50000 claude
```

## MCP Startup Timeout

```bash
MCP_TIMEOUT=10000 claude  # 10-second timeout
```

## MCP Resources

Reference MCP resources with `@` mentions:

```
Can you analyze @github:issue://123 and suggest a fix?
Compare @postgres:schema://users with @docs:file://database/user-model
```

Resources are fuzzy-searchable in the @ mention autocomplete.

## MCP Prompts as Commands

MCP server prompts become `/` commands:

```
/mcp__github__list_prs
/mcp__github__pr_review 456
/mcp__jira__create_issue "Bug in login flow" high
```

## Plugin-Provided MCP Servers

Plugins can bundle MCP servers in `.mcp.json` at plugin root or inline in `plugin.json`:

```json
{
  "name": "my-plugin",
  "mcpServers": {
    "plugin-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/api-server",
      "args": ["--port", "8080"]
    }
  }
}
```

Plugin servers start automatically when the plugin is enabled.
Use `/reload-plugins` to connect/disconnect after enabling/disabling plugins.

## Claude.ai Synced Servers

MCP servers added in Claude.ai settings are automatically available in Claude Code
when logged in with a Claude.ai account. Disable with:

```bash
ENABLE_CLAUDEAI_MCP_SERVERS=false claude
```

## Elicitation

MCP servers can request structured input mid-task:
- **Form mode**: Shows dialog with form fields
- **URL mode**: Opens browser for authentication/approval

No configuration needed - dialogs appear automatically.

## Windows Notes

On native Windows (not WSL), stdio servers using `npx` require the `cmd /c` wrapper:

```bash
claude mcp add --transport stdio my-server -- cmd /c npx -y @some/package
```

## Troubleshooting

See [commands-reference.md](./references/commands-reference.md) for complete command syntax.
See [registry-and-auth.md](./references/registry-and-auth.md) for registry browsing, enterprise managed config, and advanced auth patterns.

### Common Issues

| Problem | Solution |
|---------|----------|
| "Connection closed" on Windows | Add `cmd /c` wrapper before `npx` |
| Server not appearing | Restart Claude Code session (servers load on startup) |
| OAuth redirect fails | Copy callback URL from browser, paste in Claude Code |
| Tools consuming too much context | Enable Tool Search: `ENABLE_TOOL_SEARCH=true` |
| Output warning on large results | Increase limit: `MAX_MCP_OUTPUT_TOKENS=50000` |
| Server startup timeout | Increase timeout: `MCP_TIMEOUT=10000` |
| "dynamic client registration" error | Use `--client-id` and `--client-secret` flags |
| Project .mcp.json not loading | Run `claude mcp reset-project-choices` |

### Diagnostic Steps

1. Check server is configured: `claude mcp list`
2. Check server details: `claude mcp get <name>`
3. In Claude Code, run `/mcp` to see status and authenticate
4. Check transport type matches the server's capabilities
5. Verify environment variables are set for stdio servers
6. For OAuth, try "Clear authentication" in `/mcp` menu then re-auth

## Agent

Use the `mcp-manager` agent for complex multi-step MCP management tasks:

```
Agent: mcp-manager
When: Diagnosing connection issues, setting up multiple servers, configuring enterprise managed MCP,
      migrating between transport types, or auditing MCP server configurations
```

## Reference Files

- [Commands Reference](./references/commands-reference.md) - Complete CLI command syntax
- [Registry and Auth](./references/registry-and-auth.md) - MCP registry, managed config, advanced auth
