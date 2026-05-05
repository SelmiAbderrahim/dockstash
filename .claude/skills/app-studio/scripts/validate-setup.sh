#!/bin/bash
# validate-setup.sh - Verify all App Studio dependencies and configuration
# Usage: ./validate-setup.sh

set -euo pipefail

PASS=0
FAIL=0
WARN=0

check_pass() {
  echo "  [PASS] $1"
  PASS=$((PASS + 1))
}

check_fail() {
  echo "  [FAIL] $1"
  FAIL=$((FAIL + 1))
}

check_warn() {
  echo "  [WARN] $1"
  WARN=$((WARN + 1))
}

echo "=== App Studio Setup Validation ==="
echo ""

# 1. Docker availability
echo "1. Docker Environment"
if docker info > /dev/null 2>&1; then
  check_pass "Docker daemon is running"
else
  check_fail "Docker daemon is not running"
fi

if docker network inspect serverless-network > /dev/null 2>&1; then
  check_pass "serverless-network exists"
else
  check_warn "serverless-network does not exist (will be created on first sandbox)"
fi

# Check if node:22-slim image exists
if docker image inspect node:22-slim > /dev/null 2>&1; then
  check_pass "node:22-slim image available"
else
  check_warn "node:22-slim image not pulled (will be pulled on first sandbox creation)"
fi

echo ""

# 2. Port availability
echo "2. Port Range (50000-50999)"
PORTS_IN_USE=$(docker ps --filter "name=serverless-appstudio-sandbox" --format "{{.Ports}}" 2>/dev/null | grep -oP '\d+(?=->5173)' | wc -l)
PORTS_AVAILABLE=$((1000 - PORTS_IN_USE))
if [ "${PORTS_IN_USE}" -lt 900 ]; then
  check_pass "Port range healthy (${PORTS_AVAILABLE} ports available, ${PORTS_IN_USE} in use)"
else
  check_warn "Port range low (${PORTS_AVAILABLE} ports available)"
fi

echo ""

# 3. Skill files
echo "3. Skill Files"
SKILL_DIR="/home/serverlessbase/serverless-v2/.claude/skills/app-studio"

if [ -f "${SKILL_DIR}/SKILL.md" ]; then
  check_pass "SKILL.md exists"
else
  check_fail "SKILL.md missing"
fi

for ref in agent-mode-patterns.md sandbox-lifecycle.md streaming-patterns.md builder-ui-patterns.md; do
  if [ -f "${SKILL_DIR}/references/${ref}" ]; then
    check_pass "references/${ref} exists"
  else
    check_fail "references/${ref} missing"
  fi
done

for script in check-sandbox-status.sh cleanup-expired-sandboxes.sh validate-setup.sh; do
  if [ -f "${SKILL_DIR}/scripts/${script}" ]; then
    if [ -x "${SKILL_DIR}/scripts/${script}" ]; then
      check_pass "scripts/${script} exists and is executable"
    else
      check_warn "scripts/${script} exists but is not executable"
    fi
  else
    check_fail "scripts/${script} missing"
  fi
done

echo ""

# 4. Backend files
echo "4. Backend Service Files"
BACKEND_DIR="/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/services/app-studio"

for svc in sandbox-provider.ts agent-tools.ts agent-handler.ts ai-streaming-service.ts project-service.ts chat-service.ts template-service.ts version-service.ts theme-service.ts mcp-service.ts model-registry.ts deploy-service.ts usage-tracking.ts; do
  if [ -f "${BACKEND_DIR}/${svc}" ]; then
    check_pass "services/app-studio/${svc} exists"
  else
    check_fail "services/app-studio/${svc} missing"
  fi
done

echo ""

# 5. Schema file
echo "5. Database Schema"
SCHEMA_FILE="/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/db/schema/app-studio.ts"

if [ -f "${SCHEMA_FILE}" ]; then
  check_pass "app-studio.ts schema exists"

  # Check for required tables
  for table in appStudioProject appStudioChat appStudioMessage appStudioVersion appStudioTheme appStudioSandbox appStudioUsage appStudioLimitsConfig appStudioUserLimits appStudioMcpServer appStudioMcpToolConsent; do
    if grep -q "${table}" "${SCHEMA_FILE}"; then
      check_pass "Table ${table} defined"
    else
      check_fail "Table ${table} missing from schema"
    fi
  done
else
  check_fail "app-studio.ts schema missing"
fi

echo ""

# 6. Frontend files
echo "6. Frontend Files"
CLIENT_DIR="/home/serverlessbase/serverless-v2/client/src"

if [ -f "${CLIENT_DIR}/types/app-studio.ts" ]; then
  check_pass "types/app-studio.ts exists"
else
  check_fail "types/app-studio.ts missing"
fi

if [ -f "${CLIENT_DIR}/hooks/app-studio/queryKeys.ts" ]; then
  check_pass "hooks/app-studio/queryKeys.ts exists"
else
  check_fail "hooks/app-studio/queryKeys.ts missing"
fi

if [ -d "${CLIENT_DIR}/components/dashboard/app-studio/builder" ]; then
  check_pass "builder components directory exists"
else
  check_fail "builder components directory missing"
fi

echo ""

# 7. Translation files
echo "7. Translation Files"
for lang in en ar fr de es; do
  LOCALE_FILE="/home/serverlessbase/serverless-v2/client/public/locales/${lang}/appStudio.json"
  if [ -f "${LOCALE_FILE}" ]; then
    check_pass "locales/${lang}/appStudio.json exists"
  else
    check_fail "locales/${lang}/appStudio.json missing"
  fi
done

echo ""

# 8. Rules file
echo "8. Rules File"
RULES_FILE="/home/serverlessbase/serverless-v2/.claude/rules/app-studio-patterns.md"

if [ -f "${RULES_FILE}" ]; then
  check_pass "app-studio-patterns.md exists"

  # Check for critical content
  if grep -q "Agent Mode" "${RULES_FILE}"; then
    check_pass "Agent mode rules documented"
  else
    check_warn "Agent mode rules section missing"
  fi

  if grep -q "Docker Sandbox" "${RULES_FILE}" || grep -q "Sandbox" "${RULES_FILE}"; then
    check_pass "Sandbox rules documented"
  else
    check_warn "Sandbox rules section missing"
  fi
else
  check_warn "app-studio-patterns.md not yet created"
fi

echo ""

# 9. Feature flag
echo "9. Feature Flag"
FEATURES_FILE="/home/serverlessbase/serverless-v2/serverlessbase/packages/server/src/constants/platform-features.ts"

if [ -f "${FEATURES_FILE}" ]; then
  if grep -q "app_studio" "${FEATURES_FILE}"; then
    check_pass "app_studio feature flag defined"
  else
    check_fail "app_studio feature flag not found"
  fi
else
  check_fail "platform-features.ts missing"
fi

echo ""

# 10. No forbidden patterns
echo "10. Forbidden Pattern Check"

# Check for E2B references in App Studio code
E2B_REFS=$(grep -rl "E2B\|e2b\|@e2b" "${BACKEND_DIR}" 2>/dev/null | wc -l)
if [ "${E2B_REFS}" -gt 0 ]; then
  check_fail "E2B references found in App Studio code (should use Docker only)"
else
  check_pass "No E2B references found (Docker-only)"
fi

# Check for dokploy- prefix
DOKPLOY_REFS=$(grep -rl "dokploy-" "${BACKEND_DIR}" 2>/dev/null | wc -l)
if [ "${DOKPLOY_REFS}" -gt 0 ]; then
  check_fail "dokploy- prefixes found (should use serverless-)"
else
  check_pass "No dokploy- prefixes found"
fi

echo ""

# 11. Container services
echo "11. Container Services"
for container in serverless-client serverless-postgres serverless-redis; do
  if docker ps --filter "name=${container}" --format "{{.Names}}" 2>/dev/null | grep -q "${container}"; then
    check_pass "${container} is running"
  else
    check_warn "${container} is not running (run 'make start' to start)"
  fi
done

echo ""

# Summary
echo "=== Validation Summary ==="
echo "  Passed:   ${PASS}"
echo "  Failed:   ${FAIL}"
echo "  Warnings: ${WARN}"
echo ""

if [ "${FAIL}" -gt 0 ]; then
  echo "STATUS: FAILED - ${FAIL} issue(s) need resolution"
  exit 1
elif [ "${WARN}" -gt 0 ]; then
  echo "STATUS: PASSED with warnings"
  exit 0
else
  echo "STATUS: ALL CHECKS PASSED"
  exit 0
fi
