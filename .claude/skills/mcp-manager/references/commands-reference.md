# MCP CLI Commands Reference

## `claude mcp add`

Add an MCP server connection.

### Syntax

```bash
claude mcp add [options] <name> [-- <command> [args...]]
```

**Option ordering**: All options must come BEFORE the server name. The `--` separates
the server name from the command/args for stdio servers.

### Options

| Flag | Description | Example |
|------|-------------|---------|
| `--transport <type>` | Transport type: `http`, `sse`, `stdio` | `--transport http` |
| `--scope <scope>` | Storage scope: `local` (default), `project`, `user` | `--scope project` |
| `--env <KEY=VALUE>` | Environment variable (repeatable) | `--env API_KEY=abc` |
| `--header <HEADER>` | HTTP header (repeatable) | `--header "Authorization: Bearer tok"` |
| `--client-id <ID>` | Pre-configured OAuth client ID | `--client-id my-app-id` |
| `--client-secret` | Prompt for OAuth client secret (or read from `MCP_CLIENT_SECRET`) | `--client-secret` |
| `--callback-port <PORT>` | Fixed OAuth callback port | `--callback-port 8080` |

### Examples

```bash
# HTTP remote server
claude mcp add --transport http notion https://mcp.notion.com/mcp

# HTTP with auth header
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"

# SSE remote server (deprecated)
claude mcp add --transport sse asana https://mcp.asana.com/sse

# stdio local server
claude mcp add --transport stdio --env AIRTABLE_API_KEY=YOUR_KEY airtable \
  -- npx -y airtable-mcp-server

# stdio with database DSN
claude mcp add --transport stdio db -- npx -y @bytebase/dbhub \
  --dsn "postgresql://readonly:pass@prod.db.com:5432/analytics"

# Project-scoped (shared via .mcp.json)
claude mcp add --transport http paypal --scope project https://mcp.paypal.com/mcp

# User-scoped (cross-project)
claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic

# With pre-configured OAuth
claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp

# CI/non-interactive OAuth
MCP_CLIENT_SECRET=your-secret claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```

## `claude mcp add-json`

Add an MCP server from a JSON configuration object.

### Syntax

```bash
claude mcp add-json [options] <name> '<json>'
```

### Examples

```bash
# HTTP server with headers
claude mcp add-json weather-api \
  '{"type":"http","url":"https://api.weather.com/mcp","headers":{"Authorization":"Bearer token"}}'

# stdio server with env and args
claude mcp add-json local-tool \
  '{"type":"stdio","command":"/path/to/cli","args":["--config","file.json"],"env":{"CACHE_DIR":"/tmp"}}'

# HTTP with pre-configured OAuth
claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"clientId":"your-id","callbackPort":8080}}' \
  --client-secret

# HTTP with fixed callback port only (dynamic client registration)
claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"callbackPort":8080}}'
```

## `claude mcp add-from-claude-desktop`

Import MCP servers from Claude Desktop configuration.

```bash
claude mcp add-from-claude-desktop
claude mcp add-from-claude-desktop --scope user
```

Works on macOS and WSL only. Shows interactive selection dialog.
Duplicate names get numerical suffix (e.g., `server_1`).

## `claude mcp list`

List all configured MCP servers.

```bash
claude mcp list
```

## `claude mcp get`

Get details for a specific server.

```bash
claude mcp get <name>
```

Shows configuration, scope, transport type, and OAuth credential status.

## `claude mcp remove`

Remove a configured server.

```bash
claude mcp remove <name>
```

## `claude mcp reset-project-choices`

Reset approval choices for project-scoped servers from `.mcp.json`.

```bash
claude mcp reset-project-choices
```

## `claude mcp serve`

Start Claude Code as an MCP server (stdio transport).

```bash
claude mcp serve
```

Exposes Claude's tools (Read, Edit, LS, etc.) to connecting MCP clients.

## `/mcp` (In-Session Command)

Within Claude Code, check server status, authenticate, and manage connections.

```
/mcp
```

Features:
- View all connected servers and their status
- Authenticate with OAuth servers via browser
- Clear authentication for a server
- See plugin-provided servers
- See Claude.ai synced servers

## Scope Details

### Local Scope (Default)

Stored in `~/.claude.json` under the project path. Private to you, only accessible in current project.

### Project Scope

Stored in `.mcp.json` at project root. Designed for version control sharing.

**Format**:

```json
{
  "mcpServers": {
    "server-name": {
      "command": "/path/to/server",
      "args": [],
      "env": {}
    }
  }
}
```

Requires approval on first use. Reset with `claude mcp reset-project-choices`.

### User Scope

Stored in `~/.claude.json`. Available across all projects, private to your account.

### Precedence

When same-name servers exist at multiple scopes: **local > project > user**.

## Environment Variable Expansion in .mcp.json

Supported syntax:
- `${VAR}` - Expand to value
- `${VAR:-default}` - Expand with default fallback

Supported locations: `command`, `args`, `env`, `url`, `headers`

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

If a required variable is not set and has no default, config parsing fails.

## Dynamic Tool Updates

Claude Code supports MCP `list_changed` notifications. When a server sends this notification,
Claude Code automatically refreshes available tools, prompts, and resources without
requiring disconnect/reconnect.
