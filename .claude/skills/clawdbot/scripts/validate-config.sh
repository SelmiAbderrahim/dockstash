#!/bin/bash
# Validate Clawdbot Configuration
# Usage: ./validate-config.sh [config-path]

set -e

CONFIG_PATH=${1:-"$HOME/.clawdbot/clawdbot.json"}

echo "=== Clawdbot Configuration Validator ==="
echo ""
echo "Config path: $CONFIG_PATH"
echo ""

# Check if config file exists
if [ ! -f "$CONFIG_PATH" ]; then
    echo "✗ Configuration file not found: $CONFIG_PATH"
    echo ""
    echo "Create one with:"
    echo "  clawdbot onboard"
    exit 1
fi

echo "✓ Configuration file exists"
echo ""

# Check if it's valid JSON
echo "1. Validating JSON syntax..."
if command -v jq &> /dev/null; then
    if jq empty "$CONFIG_PATH" 2>/dev/null; then
        echo "   ✓ Valid JSON"
    else
        echo "   ✗ Invalid JSON syntax"
        echo ""
        echo "   Error details:"
        jq empty "$CONFIG_PATH" 2>&1 | head -5
        exit 1
    fi
elif command -v python3 &> /dev/null; then
    if python3 -c "import json; json.load(open('$CONFIG_PATH'))" 2>/dev/null; then
        echo "   ✓ Valid JSON"
    else
        echo "   ✗ Invalid JSON syntax"
        exit 1
    fi
else
    echo "   ⚠ Cannot validate JSON (jq or python3 not installed)"
fi

# Use clawdbot config check if available
echo ""
echo "2. Running Clawdbot validation..."
if command -v clawdbot &> /dev/null; then
    if clawdbot config check 2>/dev/null; then
        echo "   ✓ Configuration is valid"
    else
        echo "   ⚠ Configuration has issues"
        clawdbot config check 2>&1 | head -10
    fi
else
    echo "   ⚠ Clawdbot not installed, skipping validation"
fi

# Check required sections
echo ""
echo "3. Checking configuration sections..."

check_section() {
    local section=$1
    local required=$2

    if command -v jq &> /dev/null; then
        if jq -e ".$section" "$CONFIG_PATH" > /dev/null 2>&1; then
            echo "   ✓ $section configured"
            return 0
        else
            if [ "$required" = "required" ]; then
                echo "   ✗ $section missing (required)"
                return 1
            else
                echo "   - $section not configured (optional)"
                return 0
            fi
        fi
    fi
}

check_section "agent" "optional"
check_section "gateway" "optional"
check_section "channels" "optional"
check_section "plugins" "optional"
check_section "hooks" "optional"
check_section "security" "optional"
check_section "logging" "optional"

# Check for sensitive data
echo ""
echo "4. Checking for sensitive data..."

SENSITIVE_PATTERNS=(
    "password"
    "secret"
    "apiKey"
    "api_key"
    "token"
    "credential"
)

FOUND_SENSITIVE=0
for pattern in "${SENSITIVE_PATTERNS[@]}"; do
    if grep -qi "$pattern" "$CONFIG_PATH" 2>/dev/null; then
        FOUND_SENSITIVE=1
        break
    fi
done

if [ $FOUND_SENSITIVE -eq 1 ]; then
    echo "   ⚠ Sensitive data found in config file"
    echo "   Consider using environment variables instead:"
    echo "   - Store in ~/.clawdbot/.env"
    echo "   - Use \${VAR_NAME} substitution in config"
else
    echo "   ✓ No obvious sensitive data in config"
fi

# Check file permissions
echo ""
echo "5. Checking file permissions..."
PERMS=$(stat -c %a "$CONFIG_PATH" 2>/dev/null || stat -f %Lp "$CONFIG_PATH" 2>/dev/null)
if [ "$PERMS" = "600" ] || [ "$PERMS" = "644" ]; then
    echo "   ✓ File permissions OK ($PERMS)"
else
    echo "   ⚠ File permissions: $PERMS"
    echo "   Recommended: chmod 600 $CONFIG_PATH"
fi

# Check state directory
echo ""
echo "6. Checking state directory..."
STATE_DIR="$HOME/.clawdbot"
if [ -d "$STATE_DIR" ]; then
    echo "   ✓ State directory exists: $STATE_DIR"

    # Check subdirectories
    [ -d "$STATE_DIR/logs" ] && echo "   - logs/ exists"
    [ -d "$STATE_DIR/extensions" ] && echo "   - extensions/ exists"
    [ -d "$STATE_DIR/hooks" ] && echo "   - hooks/ exists"
    [ -d "$STATE_DIR/history" ] && echo "   - history/ exists"
else
    echo "   ⚠ State directory not found: $STATE_DIR"
fi

# Environment variables
echo ""
echo "7. Checking environment variables..."
ENV_FILE="$HOME/.clawdbot/.env"
if [ -f "$ENV_FILE" ]; then
    echo "   ✓ Environment file exists: $ENV_FILE"

    # Check for common variables (without showing values)
    [ -n "$ANTHROPIC_API_KEY" ] && echo "   - ANTHROPIC_API_KEY set"
    [ -n "$OPENAI_API_KEY" ] && echo "   - OPENAI_API_KEY set"
else
    echo "   - No .env file (using process environment)"
fi

# Summary
echo ""
echo "=== Validation Summary ==="
if command -v clawdbot &> /dev/null && clawdbot config check &> /dev/null; then
    echo "Configuration is valid and ready to use."
else
    echo "Configuration may have issues. Review warnings above."
fi

echo ""
echo "Useful commands:"
echo "  clawdbot config show     - View effective config"
echo "  clawdbot config edit     - Edit configuration"
echo "  clawdbot doctor          - Full system check"
