#!/bin/bash
# Check Clawdbot Installation
# Usage: ./check-clawdbot.sh

set -e

echo "=== Clawdbot Installation Check ==="
echo ""

# Check Node.js version
echo "1. Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    echo "   ✓ Node.js installed: $NODE_VERSION"

    # Check if version >= 22
    MAJOR_VERSION=$(echo $NODE_VERSION | sed 's/v//' | cut -d. -f1)
    if [ "$MAJOR_VERSION" -lt 22 ]; then
        echo "   ⚠ Warning: Node.js >= 22 required (you have $NODE_VERSION)"
    fi
else
    echo "   ✗ Node.js not installed"
    echo "   Install: https://nodejs.org/"
    exit 1
fi

# Check npm
echo ""
echo "2. Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    echo "   ✓ npm installed: $NPM_VERSION"
else
    echo "   ✗ npm not installed"
    exit 1
fi

# Check Clawdbot
echo ""
echo "3. Checking Clawdbot..."
if command -v clawdbot &> /dev/null; then
    CLAWDBOT_VERSION=$(clawdbot --version 2>/dev/null || echo "unknown")
    echo "   ✓ Clawdbot installed: $CLAWDBOT_VERSION"
else
    echo "   ✗ Clawdbot not installed"
    echo ""
    echo "   To install Clawdbot:"
    echo "   npm install -g clawdbot@latest"
    echo ""
    echo "   Then run onboarding:"
    echo "   clawdbot onboard --install-daemon"
    exit 1
fi

# Check Clawdbot config
echo ""
echo "4. Checking configuration..."
CONFIG_PATH="$HOME/.clawdbot/clawdbot.json"
if [ -f "$CONFIG_PATH" ]; then
    echo "   ✓ Config file exists: $CONFIG_PATH"
else
    echo "   ⚠ Config file not found: $CONFIG_PATH"
    echo "   Run: clawdbot onboard"
fi

# Check Gateway status
echo ""
echo "5. Checking Gateway status..."
if clawdbot status &> /dev/null; then
    echo "   ✓ Gateway is running"
else
    echo "   ⚠ Gateway is not running"
    echo "   Start with: clawdbot gateway"
fi

# Check configured channels
echo ""
echo "6. Checking channels..."
if [ -f "$CONFIG_PATH" ]; then
    # Extract enabled channels (basic check)
    if grep -q '"whatsapp"' "$CONFIG_PATH" 2>/dev/null; then
        echo "   - WhatsApp configured"
    fi
    if grep -q '"telegram"' "$CONFIG_PATH" 2>/dev/null; then
        echo "   - Telegram configured"
    fi
    if grep -q '"slack"' "$CONFIG_PATH" 2>/dev/null; then
        echo "   - Slack configured"
    fi
    if grep -q '"discord"' "$CONFIG_PATH" 2>/dev/null; then
        echo "   - Discord configured"
    fi
fi

# Summary
echo ""
echo "=== Summary ==="
if command -v clawdbot &> /dev/null; then
    echo "Clawdbot is installed and ready to use."
    echo ""
    echo "Quick commands:"
    echo "  clawdbot status      - Show status"
    echo "  clawdbot gateway     - Start Gateway"
    echo "  clawdbot channels list - List channels"
    echo "  clawdbot doctor      - Run diagnostics"
else
    echo "Clawdbot needs to be installed."
    echo ""
    echo "Installation:"
    echo "  npm install -g clawdbot@latest"
    echo "  clawdbot onboard --install-daemon"
fi
