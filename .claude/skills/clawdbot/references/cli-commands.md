# Clawdbot CLI Commands Reference

Complete reference for all Clawdbot command-line interface commands.

## Core Commands

### clawdbot

```bash
clawdbot [command] [options]
```

| Command | Description |
|---------|-------------|
| `gateway` | Start the Gateway |
| `onboard` | Run setup wizard |
| `status` | Show status |
| `doctor` | Run diagnostics |
| `version` | Show version |
| `help` | Show help |

### Gateway

```bash
# Start Gateway
clawdbot gateway

# Start with options
clawdbot gateway --port 18800 --debug

# Start in background
clawdbot gateway --daemon

# Watch mode (auto-reload)
clawdbot gateway --watch
```

| Option | Description |
|--------|-------------|
| `--port <port>` | WebSocket port |
| `--config <path>` | Config file path |
| `--debug` | Enable debug mode |
| `--daemon` | Run as daemon |
| `--watch` | Auto-reload on changes |

### Onboard

```bash
# Run full onboarding
clawdbot onboard

# With daemon installation
clawdbot onboard --install-daemon

# Skip specific steps
clawdbot onboard --skip-channels
```

| Option | Description |
|--------|-------------|
| `--install-daemon` | Install as system daemon |
| `--skip-channels` | Skip channel setup |
| `--skip-auth` | Skip authentication |
| `--non-interactive` | Non-interactive mode |

### Status

```bash
# Show status
clawdbot status

# JSON output
clawdbot status --json

# Detailed status
clawdbot status --verbose
```

### Doctor

```bash
# Run all diagnostics
clawdbot doctor

# Specific checks
clawdbot doctor --check gateway
clawdbot doctor --check channels
clawdbot doctor --check plugins
```

## Daemon Commands

```bash
# Start daemon
clawdbot daemon start

# Stop daemon
clawdbot daemon stop

# Restart daemon
clawdbot daemon restart

# Show daemon status
clawdbot daemon status

# View daemon logs
clawdbot daemon logs
clawdbot daemon logs --follow
```

## Channel Commands

```bash
# List channels
clawdbot channels list

# Add channel
clawdbot channels add <channel>
clawdbot channels add whatsapp
clawdbot channels add telegram

# Remove channel
clawdbot channels remove <channel>

# Authenticate channel
clawdbot channels auth <channel>

# Check channel status
clawdbot channels status <channel>

# Reconnect channel
clawdbot channels reconnect <channel>

# Show channel info
clawdbot channels info <channel>
```

### Channel-Specific Commands

```bash
# WhatsApp
clawdbot channels auth whatsapp  # Show QR code
clawdbot channels logout whatsapp

# Telegram
clawdbot channels test telegram  # Send test message
```

## Session Commands

```bash
# List sessions
clawdbot sessions list

# Show session info
clawdbot sessions info <sessionId>

# Reset session
clawdbot sessions reset <sessionId>

# Clear all sessions
clawdbot sessions clear --all

# Export session history
clawdbot sessions export <sessionId> --format json
```

## Plugin Commands

```bash
# List plugins
clawdbot plugins list

# Show plugin info
clawdbot plugins info <pluginId>

# Install plugin
clawdbot plugins install <path>
clawdbot plugins install ~/Projects/my-plugin
clawdbot plugins install @clawdbot/voice-call

# Install with symlink (dev)
clawdbot plugins install -l <path>

# Uninstall plugin
clawdbot plugins uninstall <pluginId>

# Enable/disable plugin
clawdbot plugins enable <pluginId>
clawdbot plugins disable <pluginId>

# Update plugin
clawdbot plugins update <pluginId>
clawdbot plugins update --all

# Check plugin health
clawdbot plugins doctor
```

## Hook Commands

```bash
# List hooks
clawdbot hooks list

# Show hook info
clawdbot hooks info <hookName>

# Enable/disable hook
clawdbot hooks enable <hookName>
clawdbot hooks disable <hookName>

# Check hook eligibility
clawdbot hooks check

# Test hook (dry run)
clawdbot hooks test <hookName> --event command:new
```

## Model Commands

```bash
# List available models
clawdbot models list

# Show model info
clawdbot models info <modelId>

# Check model access
clawdbot models status

# Set default model
clawdbot models set <modelId>

# Test model
clawdbot models test <modelId> --prompt "Hello"
```

## Config Commands

```bash
# Show configuration
clawdbot config show
clawdbot config show agent
clawdbot config show channels.whatsapp

# Set configuration value
clawdbot config set agent.model "anthropic/claude-opus-4-5"
clawdbot config set logging.level "debug"

# Edit configuration
clawdbot config edit

# Validate configuration
clawdbot config check

# Reset to defaults
clawdbot config reset
clawdbot config reset security

# Migrate configuration
clawdbot config migrate
clawdbot config migrate --dry-run
```

## Pairing Commands

```bash
# List pending pairing requests
clawdbot pairing list

# Approve pairing request
clawdbot pairing approve <channel> <code>

# Deny pairing request
clawdbot pairing deny <channel> <code>

# Approve all pending
clawdbot pairing approve-all

# Revoke approved sender
clawdbot pairing revoke <channel> <senderId>

# List approved senders
clawdbot pairing approved
```

## Tool Commands

```bash
# List tools
clawdbot tools list

# Show tool status
clawdbot tools status <toolName>

# Enable/disable tool
clawdbot tools enable <toolName>
clawdbot tools disable <toolName>

# Test tool
clawdbot tools test <toolName>
clawdbot tools test browser --url "https://example.com"
clawdbot tools test camera --capture
```

## Log Commands

```bash
# View logs
clawdbot logs

# Follow logs
clawdbot logs --follow

# Filter by level
clawdbot logs --level error

# Filter by time
clawdbot logs --since "1 hour ago"
clawdbot logs --since "2024-01-01"

# Filter by component
clawdbot logs --component gateway
clawdbot logs --component channels.whatsapp
```

## Audit Commands

```bash
# View audit events
clawdbot audit show

# Filter by type
clawdbot audit show --type pairing
clawdbot audit show --type message

# Filter by sender
clawdbot audit show --sender "alice@telegram"

# Filter by time
clawdbot audit show --since "24 hours ago"

# Export audit log
clawdbot audit export --format json > audit.json
```

## Update Commands

```bash
# Update to latest
clawdbot update

# Update to specific version
clawdbot update --version 1.2.3

# Switch release channel
clawdbot update --channel stable
clawdbot update --channel beta
clawdbot update --channel dev

# Check for updates
clawdbot update --check
```

## Remote Access Commands

```bash
# Tailscale serve (tailnet only)
clawdbot serve --mode tailscale

# Tailscale funnel (public)
clawdbot funnel --password your-secret
clawdbot funnel --magic-link

# Stop remote access
clawdbot serve stop
clawdbot funnel stop
```

## Workspace Commands

```bash
# Initialize workspace
clawdbot workspace init

# Show workspace info
clawdbot workspace info

# List workspace files
clawdbot workspace ls

# Clean workspace
clawdbot workspace clean
```

## Debug Commands

```bash
# Enable debug mode
clawdbot debug

# Show debug info
clawdbot debug info

# Export debug bundle
clawdbot debug export > debug-bundle.zip

# Test connectivity
clawdbot debug ping

# Trace message flow
clawdbot debug trace --message-id <id>
```

## WebChat Commands

```bash
# Open WebChat
clawdbot webchat

# Start WebChat server
clawdbot webchat serve --port 8080

# Generate WebChat URL
clawdbot webchat url
```

## Cron Commands

```bash
# List cron jobs
clawdbot cron list

# Add cron job
clawdbot cron add "daily-summary" "0 9 * * *" --action summarize

# Remove cron job
clawdbot cron remove "daily-summary"

# Enable/disable cron job
clawdbot cron enable "daily-summary"
clawdbot cron disable "daily-summary"

# Run cron job now
clawdbot cron run "daily-summary"
```

## Webhook Commands

```bash
# List webhooks
clawdbot webhooks list

# Add webhook
clawdbot webhooks add /webhook/github --secret your-secret

# Remove webhook
clawdbot webhooks remove /webhook/github

# Test webhook
clawdbot webhooks test /webhook/github --payload '{"test": true}'
```

## Environment Commands

```bash
# Show environment
clawdbot env show

# Set environment variable
clawdbot env set API_KEY "your-key"

# Unset environment variable
clawdbot env unset API_KEY

# Load from file
clawdbot env load .env.local
```

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--help`, `-h` | Show help |
| `--version`, `-V` | Show version |
| `--config <path>` | Config file path |
| `--json` | JSON output |
| `--quiet`, `-q` | Suppress output |
| `--verbose`, `-v` | Verbose output |
| `--debug` | Debug mode |
| `--no-color` | Disable colors |

## Exit Codes

| Code | Description |
|------|-------------|
| 0 | Success |
| 1 | General error |
| 2 | Invalid arguments |
| 3 | Configuration error |
| 4 | Connection error |
| 5 | Authentication error |
| 6 | Permission denied |

## Shell Completion

```bash
# Bash
clawdbot completion bash >> ~/.bashrc

# Zsh
clawdbot completion zsh >> ~/.zshrc

# Fish
clawdbot completion fish > ~/.config/fish/completions/clawdbot.fish
```
