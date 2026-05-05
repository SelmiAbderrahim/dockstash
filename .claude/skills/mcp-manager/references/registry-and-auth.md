# MCP Registry, Managed Configuration, and Advanced Authentication

## MCP Registry

The Anthropic MCP Registry provides a curated catalog of verified MCP servers.

### Registry API

```
GET https://api.anthropic.com/mcp-registry/v0/servers
  ?version=latest
  &visibility=commercial
  &limit=100
  &cursor=<next_cursor>
```

Response structure:

```json
{
  "servers": [
    {
      "server": {
        "name": "server-name",
        "title": "Display Name",
        "description": "What the server does",
        "remotes": [
          { "type": "streamable-http", "url": "https://..." },
          { "type": "sse", "url": "https://..." }
        ],
        "packages": [
          {
            "registryType": "npm",
            "identifier": "@scope/package-name",
            "environmentVariables": [
              { "name": "API_KEY", "description": "..." }
            ]
          }
        ]
      },
      "_meta": {
        "com.anthropic.api/mcp-registry": {
          "displayName": "Friendly Name",
          "oneLiner": "Short description",
          "documentation": "https://docs.example.com",
          "url": "https://mcp.example.com",
          "worksWith": ["claude-code", "claude-api", "claude-desktop"],
          "claudeCodeCopyText": "claude mcp add ...",
          "requiredFields": [
            { "field": "url", "sourceUrl": "https://setup.example.com" }
          ]
        }
      }
    }
  ],
  "metadata": {
    "nextCursor": "cursor_token_or_null"
  }
}
```

### Registry Documentation Endpoint

For AI agents reading this: `https://api.anthropic.com/mcp-registry/docs`

### Full Documentation Index

For complete Claude Code documentation: `https://code.claude.com/docs/llms.txt`

### Availability Flags

| Flag | Meaning |
|------|---------|
| `claude-code` | Works with Claude Code CLI |
| `claude-api` | Works with Claude API (MCP Connector) |
| `claude-desktop` | Works with Claude Desktop app |

### Generating Install Commands

For each server from the registry:

1. **HTTP remote**: `claude mcp add <slug> --transport http <url>`
2. **SSE remote**: `claude mcp add <slug> --transport sse <url>`
3. **stdio (npm)**: `claude mcp add <slug> --transport stdio [--env KEY=VALUE...] -- npx -y <package>`

Slug is derived from display name: lowercase, non-alphanumeric replaced with hyphens.

If the server has a templated URL (contains `{`), it requires user-specific configuration.
Direct the user to the `sourceUrl` from `requiredFields`.

## Managed MCP Configuration (Enterprise)

For organizations needing centralized MCP server control.

### Option 1: Exclusive Control with managed-mcp.json

Deploy a fixed set of servers that users cannot modify.

**File locations:**
- macOS: `/Library/Application Support/ClaudeCode/managed-mcp.json`
- Linux/WSL: `/etc/claude-code/managed-mcp.json`
- Windows: `C:\Program Files\ClaudeCode\managed-mcp.json`

These are system-wide paths requiring administrator privileges.

**Format** (same as `.mcp.json`):

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp/"
    },
    "company-internal": {
      "type": "stdio",
      "command": "/usr/local/bin/company-mcp-server",
      "args": ["--config", "/etc/company/mcp-config.json"],
      "env": {
        "COMPANY_API_URL": "https://internal.company.com"
      }
    }
  }
}
```

When deployed, users CANNOT add servers via `claude mcp add` or config files.

### Option 2: Policy-Based Control (Allowlists/Denylists)

Allow user-configured servers within policy constraints. Configure in managed settings file.

#### Restriction Types

Each entry must have exactly ONE of:

| Field | Matches | Example |
|-------|---------|---------|
| `serverName` | Configured server name | `{ "serverName": "github" }` |
| `serverCommand` | Exact command + args array | `{ "serverCommand": ["npx", "-y", "approved-pkg"] }` |
| `serverUrl` | URL pattern with `*` wildcards | `{ "serverUrl": "https://mcp.company.com/*" }` |

#### Example Configuration

```json
{
  "allowedMcpServers": [
    { "serverName": "github" },
    { "serverName": "sentry" },
    { "serverCommand": ["npx", "-y", "@modelcontextprotocol/server-filesystem"] },
    { "serverUrl": "https://mcp.company.com/*" },
    { "serverUrl": "https://*.internal.corp/*" }
  ],
  "deniedMcpServers": [
    { "serverName": "dangerous-server" },
    { "serverCommand": ["npx", "-y", "unapproved-package"] },
    { "serverUrl": "https://*.untrusted.com/*" }
  ]
}
```

#### Behavior Rules

**Allowlist (`allowedMcpServers`)**:
- `undefined`: No restrictions
- `[]`: Complete lockdown
- List of entries: Only matching servers allowed

**Denylist (`deniedMcpServers`)**:
- `undefined`: Nothing blocked
- `[]`: Nothing blocked
- List of entries: Matching servers blocked (absolute precedence over allowlist)

**Command matching**: Exact array match required. `["npx", "-y", "server"]` does NOT match `["npx", "server"]`.

**URL matching**: Wildcards with `*`. Examples:
- `https://mcp.company.com/*` - All paths on domain
- `https://*.example.com/*` - Any subdomain
- `http://localhost:*/*` - Any port on localhost

**Stdio servers**: When command entries exist in allowlist, stdio servers MUST match a command entry (not just name).
**Remote servers**: When URL entries exist in allowlist, remote servers MUST match a URL pattern (not just name).

#### Combining Options 1 and 2

If `managed-mcp.json` exists, it takes exclusive control AND allowlist/denylist still
filters which managed servers are actually loaded.

## Advanced OAuth Patterns

### OAuth Metadata Discovery Override

When standard `/.well-known/oauth-authorization-server` fails but OIDC works:

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

URL must use `https://`. Requires Claude Code v2.1.64+.

### Public OAuth Clients (No Secret)

If the server uses a public OAuth client with no secret:

```bash
claude mcp add --transport http \
  --client-id your-client-id \
  my-server https://mcp.example.com/mcp
```

Use `--client-id` without `--client-secret`.

### OAuth Flags Summary

| Flag | Purpose | Required |
|------|---------|----------|
| `--client-id` | Pre-configured OAuth app client ID | When server requires it |
| `--client-secret` | Prompt for secret (or read `MCP_CLIENT_SECRET`) | When server requires it |
| `--callback-port` | Fix OAuth redirect port | When server requires specific redirect URI |

These flags only apply to HTTP and SSE transports. No effect on stdio servers.

### Token Storage

- macOS: System keychain
- Linux: Credentials file
- Not stored in config files

## Elicitation

MCP servers can request structured input mid-task:

**Form mode**: Server defines form fields (e.g., username, password). Claude Code shows dialog.
**URL mode**: Server provides a URL. Claude Code opens browser for auth/approval.

To auto-respond without dialogs, use the `Elicitation` hook.

## Popular MCP Servers

### Commonly Used

| Server | Transport | Command |
|--------|-----------|---------|
| GitHub | HTTP | `claude mcp add --transport http github https://api.githubcopilot.com/mcp/` |
| Sentry | HTTP | `claude mcp add --transport http sentry https://mcp.sentry.dev/mcp` |
| Notion | HTTP | `claude mcp add --transport http notion https://mcp.notion.com/mcp` |
| Stripe | HTTP | `claude mcp add --transport http stripe https://mcp.stripe.com` |
| PostgreSQL | stdio | `claude mcp add --transport stdio db -- npx -y @bytebase/dbhub --dsn "postgresql://..."` |

### Finding More Servers

- MCP Registry API: `https://api.anthropic.com/mcp-registry/v0/servers`
- GitHub: `https://github.com/modelcontextprotocol/servers`
- Build your own: `https://modelcontextprotocol.io/quickstart/server`

## MCP Server Author Tips

### Server Instructions

With Tool Search enabled, server instructions become important for discoverability.
Include clear descriptions of:
- What category of tasks your tools handle
- When Claude should search for your tools
- Key capabilities your server provides

### Tool Annotations

```
readOnlyHint: true     # For read-only operations
destructiveHint: false # For non-destructive operations
idempotentHint: true   # If repeated calls have same effect
openWorldHint: true    # If interacting with external systems
```
