#!/bin/bash
# validate-websmith-setup.sh - Verify all WebSmith dependencies and configuration
# Usage: ./validate-websmith-setup.sh

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

echo "=== WebSmith Setup Validation ==="
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
echo "2. Port Range (49000-49999)"
PORTS_IN_USE=$(docker ps --format "{{.Ports}}" 2>/dev/null | grep -oP '\d+(?=->5173)' | wc -l)
PORTS_AVAILABLE=$((1000 - PORTS_IN_USE))
if [ "${PORTS_IN_USE}" -lt 900 ]; then
  check_pass "Port range healthy (${PORTS_AVAILABLE} ports available, ${PORTS_IN_USE} in use)"
else
  check_warn "Port range low (${PORTS_AVAILABLE} ports available)"
fi

echo ""

# 3. Skill files
echo "3. Skill Files"
SKILL_DIR="/home/serverlessbase/serverless-v2/.claude/skills/websmith"

if [ -f "${SKILL_DIR}/SKILL.md" ]; then
  check_pass "SKILL.md exists"
else
  check_fail "SKILL.md missing"
fi

for ref in docker-sandbox-patterns.md ai-generation-patterns.md firecrawl-integration.md builder-ui-patterns.md; do
  if [ -f "${SKILL_DIR}/references/${ref}" ]; then
    check_pass "references/${ref} exists"
  else
    check_fail "references/${ref} missing"
  fi
done

for script in check-sandbox-status.sh cleanup-expired-sandboxes.sh validate-websmith-setup.sh; do
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

# 4. Agent files
echo "4. Agent Files"
AGENT_DIR="/home/serverlessbase/serverless-v2/.claude/agents/websmith"

if [ -f "${AGENT_DIR}/builder-specialist.md" ]; then
  check_pass "builder-specialist.md exists"
else
  check_fail "builder-specialist.md missing"
fi

if [ -f "${AGENT_DIR}/sandbox-specialist.md" ]; then
  check_pass "sandbox-specialist.md exists"
else
  check_fail "sandbox-specialist.md missing"
fi

echo ""

# 5. Rules file
echo "5. Rules File"
RULES_FILE="/home/serverlessbase/serverless-v2/.claude/rules/websmith-patterns.md"

if [ -f "${RULES_FILE}" ]; then
  check_pass "websmith-patterns.md exists"

  # Check for critical content
  if grep -q "Docker Sandbox Rules" "${RULES_FILE}"; then
    check_pass "Docker sandbox rules documented"
  else
    check_warn "Docker sandbox rules section missing"
  fi

  if grep -q "AI Generation Rules" "${RULES_FILE}"; then
    check_pass "AI generation rules documented"
  else
    check_warn "AI generation rules section missing"
  fi

  if grep -q "Firecrawl Integration" "${RULES_FILE}"; then
    check_pass "Firecrawl integration documented"
  else
    check_warn "Firecrawl integration section missing"
  fi

  # Check for forbidden patterns
  if grep -q "E2B\|e2b" "${RULES_FILE}"; then
    check_fail "Rules file contains E2B references (should use Docker only)"
  else
    check_pass "No E2B references found (Docker-only)"
  fi

  if grep -q "dokploy-" "${RULES_FILE}"; then
    check_fail "Rules file contains dokploy- prefix (should use serverless-)"
  else
    check_pass "No dokploy- prefixes found"
  fi
else
  check_fail "websmith-patterns.md missing"
fi

echo ""

# 6. Container service check
echo "6. Container Services"
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
