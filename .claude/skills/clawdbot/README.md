# Clawdbot Skill

A comprehensive Claude skill for integrating and using Clawdbot personal AI assistant.

## Overview

Clawdbot is a self-hosted personal AI assistant that runs locally across multiple operating systems and messaging platforms. This skill provides complete documentation and guidance for:

- Setting up Clawdbot Gateway
- Configuring messaging channels (WhatsApp, Telegram, Slack, Discord, etc.)
- Developing custom plugins
- Creating automation hooks
- Integrating tools (browser control, Canvas, camera)
- Managing multi-agent workflows

## Features

### Messaging Platforms

| Platform | Protocol |
|----------|----------|
| WhatsApp | Baileys WebSocket |
| Telegram | grammY |
| Slack | Bot API |
| Discord | discord.js |
| iMessage | imsg CLI |
| Signal | Signal-CLI |
| Microsoft Teams | Bot Framework |
| Matrix | matrix-js-sdk |
| Zalo | API |
| Google Chat | Webhook |
| WebChat | Browser UI |

### AI Models

- Anthropic Claude (Pro/Max/Opus 4.5)
- OpenAI GPT models
- Extended thinking modes

### Tools

- Browser control with Chrome/Chromium
- Canvas visual workspace
- Camera snapshots
- Screen recording
- Webhooks
- Cron jobs
- Voice (ElevenLabs)

## Installation

```bash
# Install Clawdbot
npm install -g clawdbot@latest

# Run setup wizard
clawdbot onboard --install-daemon
```

## Quick Start

1. **Start Gateway:**
   ```bash
   clawdbot gateway
   ```

2. **Add a channel:**
   ```bash
   clawdbot channels add whatsapp
   clawdbot channels auth whatsapp
   ```

3. **Send a message via WhatsApp and Clawdbot will respond!**

## Usage in Claude

This skill is automatically triggered when you mention:
- "clawdbot"
- "messaging bot"
- "whatsapp bot"
- "telegram integration"
- "multi-agent messaging"

## Directory Structure

```
clawdbot/
├── SKILL.md              # Main skill instructions
├── LICENSE.txt           # MIT License
├── README.md             # This file
├── references/           # Detailed documentation
│   ├── gateway-architecture.md
│   ├── channels-reference.md
│   ├── plugins-guide.md
│   ├── hooks-reference.md
│   ├── tools-reference.md
│   ├── configuration.md
│   ├── security-model.md
│   ├── remote-access.md
│   └── cli-commands.md
└── scripts/              # Helper scripts
    ├── check-clawdbot.sh
    ├── setup-channel.sh
    └── validate-config.sh
```

## Related Agents

This skill works with specialized Clawdbot agents:

- `clawdbot-gateway-expert` - Gateway architecture specialist
- `clawdbot-channels-specialist` - Messaging channels expert
- `clawdbot-plugin-developer` - Plugin development
- `clawdbot-hooks-expert` - Automation hooks
- `clawdbot-tools-specialist` - Tools integration
- `clawdbot-skills-specialist` - Skills platform

## Resources

- [Clawdbot GitHub](https://github.com/clawdbot/clawdbot)
- [Official Documentation](https://clawdbot.com/docs)

## License

MIT License - See LICENSE.txt for details.

This skill documentation is based on the Clawdbot project. Clawdbot itself is licensed under its own terms.
