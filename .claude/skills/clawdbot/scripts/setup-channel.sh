#!/bin/bash
# Setup Clawdbot Channel
# Usage: ./setup-channel.sh [channel]
# Example: ./setup-channel.sh whatsapp

set -e

CHANNEL=${1:-}

# Check if clawdbot is installed
if ! command -v clawdbot &> /dev/null; then
    echo "Error: Clawdbot is not installed"
    echo "Install with: npm install -g clawdbot@latest"
    exit 1
fi

# If no channel specified, show menu
if [ -z "$CHANNEL" ]; then
    echo "=== Clawdbot Channel Setup ==="
    echo ""
    echo "Available channels:"
    echo "  1) whatsapp    - WhatsApp (QR code auth)"
    echo "  2) telegram    - Telegram (Bot token)"
    echo "  3) slack       - Slack (OAuth)"
    echo "  4) discord     - Discord (Bot token)"
    echo "  5) imessage    - iMessage (macOS only)"
    echo "  6) signal      - Signal (Phone number)"
    echo "  7) teams       - Microsoft Teams"
    echo "  8) matrix      - Matrix"
    echo "  9) webchat     - WebChat (Browser)"
    echo ""
    read -p "Select channel (1-9) or name: " SELECTION

    case $SELECTION in
        1|whatsapp) CHANNEL="whatsapp" ;;
        2|telegram) CHANNEL="telegram" ;;
        3|slack) CHANNEL="slack" ;;
        4|discord) CHANNEL="discord" ;;
        5|imessage) CHANNEL="imessage" ;;
        6|signal) CHANNEL="signal" ;;
        7|teams) CHANNEL="teams" ;;
        8|matrix) CHANNEL="matrix" ;;
        9|webchat) CHANNEL="webchat" ;;
        *) CHANNEL="$SELECTION" ;;
    esac
fi

echo ""
echo "Setting up channel: $CHANNEL"
echo ""

# Channel-specific instructions
case $CHANNEL in
    whatsapp)
        echo "WhatsApp Setup:"
        echo "1. Adding WhatsApp channel..."
        clawdbot channels add whatsapp

        echo ""
        echo "2. Authenticating..."
        echo "   A QR code will appear. Scan it with WhatsApp mobile app:"
        echo "   WhatsApp > Settings > Linked Devices > Link a Device"
        echo ""
        clawdbot channels auth whatsapp
        ;;

    telegram)
        echo "Telegram Setup:"
        echo ""
        echo "1. Create a bot with @BotFather on Telegram:"
        echo "   - Open Telegram and search for @BotFather"
        echo "   - Send /newbot and follow instructions"
        echo "   - Copy the bot token"
        echo ""
        read -p "Enter your Telegram bot token: " BOT_TOKEN

        if [ -n "$BOT_TOKEN" ]; then
            echo ""
            echo "2. Adding Telegram channel..."
            clawdbot channels add telegram

            # Update config with token
            CONFIG_PATH="$HOME/.clawdbot/clawdbot.json"
            if [ -f "$CONFIG_PATH" ]; then
                echo "3. Configuring bot token..."
                # Note: This is a simplified approach
                # In production, use clawdbot config set
                clawdbot config set channels.telegram.accounts.default.botToken "$BOT_TOKEN"
            fi

            echo ""
            echo "4. Testing connection..."
            clawdbot channels status telegram
        fi
        ;;

    slack)
        echo "Slack Setup:"
        echo ""
        echo "1. Create a Slack App:"
        echo "   - Go to https://api.slack.com/apps"
        echo "   - Click 'Create New App' > 'From scratch'"
        echo "   - Enable Socket Mode in 'Socket Mode'"
        echo "   - Add Bot Token Scopes: chat:write, channels:history, im:history"
        echo ""
        echo "2. Get your tokens:"
        read -p "   Bot Token (xoxb-...): " BOT_TOKEN
        read -p "   App Token (xapp-...): " APP_TOKEN

        if [ -n "$BOT_TOKEN" ] && [ -n "$APP_TOKEN" ]; then
            echo ""
            echo "3. Adding Slack channel..."
            clawdbot channels add slack

            clawdbot config set channels.slack.accounts.workspace.botToken "$BOT_TOKEN"
            clawdbot config set channels.slack.accounts.workspace.appToken "$APP_TOKEN"

            echo ""
            echo "4. Testing connection..."
            clawdbot channels status slack
        fi
        ;;

    discord)
        echo "Discord Setup:"
        echo ""
        echo "1. Create a Discord Application:"
        echo "   - Go to https://discord.com/developers/applications"
        echo "   - Click 'New Application'"
        echo "   - Go to 'Bot' > 'Add Bot'"
        echo "   - Enable 'Message Content Intent'"
        echo "   - Copy the bot token"
        echo ""
        read -p "Enter your Discord bot token: " BOT_TOKEN

        if [ -n "$BOT_TOKEN" ]; then
            echo ""
            echo "2. Adding Discord channel..."
            clawdbot channels add discord

            clawdbot config set channels.discord.accounts.default.botToken "$BOT_TOKEN"

            echo ""
            echo "3. Invite bot to your server:"
            echo "   Go to OAuth2 > URL Generator"
            echo "   Select 'bot' scope"
            echo "   Select permissions: Send Messages, Read Messages"
            echo "   Copy and open the generated URL"

            echo ""
            echo "4. Testing connection..."
            clawdbot channels status discord
        fi
        ;;

    imessage)
        echo "iMessage Setup (macOS only):"
        echo ""

        if [[ "$OSTYPE" != "darwin"* ]]; then
            echo "Error: iMessage is only supported on macOS"
            exit 1
        fi

        echo "1. Checking imsg CLI..."
        if ! command -v imsg &> /dev/null; then
            echo "   Installing imsg..."
            brew install imsg
        fi

        echo ""
        echo "2. Adding iMessage channel..."
        clawdbot channels add imessage

        echo ""
        echo "3. Testing connection..."
        clawdbot channels status imessage
        ;;

    webchat)
        echo "WebChat Setup:"
        echo ""
        echo "1. Adding WebChat channel..."
        clawdbot channels add webchat

        echo ""
        echo "2. WebChat is now available at:"
        echo "   http://localhost:18800"
        echo ""
        echo "   Open in browser:"
        if command -v open &> /dev/null; then
            read -p "   Open WebChat now? (y/n): " OPEN_NOW
            if [ "$OPEN_NOW" = "y" ]; then
                clawdbot webchat
            fi
        fi
        ;;

    *)
        echo "Setting up $CHANNEL channel..."
        clawdbot channels add "$CHANNEL"

        echo ""
        echo "Check channel status:"
        clawdbot channels status "$CHANNEL"
        ;;
esac

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Next steps:"
echo "  clawdbot status           - Check overall status"
echo "  clawdbot channels list    - List all channels"
echo "  clawdbot gateway          - Start Gateway (if not running)"
