#!/bin/bash
# check-sandbox-status.sh - Check running App Studio sandbox containers
# Usage: ./check-sandbox-status.sh [projectId]

set -euo pipefail

SANDBOX_PREFIX="serverless-appstudio-sandbox"

echo "=== App Studio Sandbox Status ==="
echo ""

if [ "${1:-}" != "" ]; then
  # Check specific sandbox
  CONTAINER_NAME="${SANDBOX_PREFIX}-${1}"
  echo "Checking sandbox: ${CONTAINER_NAME}"
  echo ""

  if docker ps -a --filter "name=${CONTAINER_NAME}" --format "{{.Names}}" | grep -q "${CONTAINER_NAME}"; then
    echo "Container Details:"
    docker inspect "${CONTAINER_NAME}" --format "  Name:    {{.Name}}
  Status:  {{.State.Status}}
  Started: {{.State.StartedAt}}
  Ports:   {{range \$key, \$val := .NetworkSettings.Ports}}{{range \$val}}{{.HostPort}}->{{end}}{{end}}
  Network: {{range \$key, \$val := .NetworkSettings.Networks}}{{.NetworkID}} {{end}}
  Memory:  {{.HostConfig.Memory}}
  CPUs:    {{.HostConfig.NanoCpus}}" 2>/dev/null || echo "  Failed to inspect container"

    echo ""
    echo "Recent Logs:"
    docker logs "${CONTAINER_NAME}" --tail 20 2>&1 || echo "  No logs available"
  else
    echo "  Container not found: ${CONTAINER_NAME}"
    exit 1
  fi
else
  # List all App Studio sandboxes
  echo "Running Sandboxes:"
  RUNNING=$(docker ps --filter "name=${SANDBOX_PREFIX}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.CreatedAt}}" 2>/dev/null)

  if [ -z "${RUNNING}" ] || [ "$(echo "${RUNNING}" | wc -l)" -le 1 ]; then
    echo "  No running sandboxes found"
  else
    echo "${RUNNING}"
  fi

  echo ""
  echo "Stopped Sandboxes:"
  STOPPED=$(docker ps -a --filter "name=${SANDBOX_PREFIX}" --filter "status=exited" --format "table {{.Names}}\t{{.Status}}\t{{.CreatedAt}}" 2>/dev/null)

  if [ -z "${STOPPED}" ] || [ "$(echo "${STOPPED}" | wc -l)" -le 1 ]; then
    echo "  No stopped sandboxes found"
  else
    echo "${STOPPED}"
  fi

  echo ""
  echo "Summary:"
  TOTAL_RUNNING=$(docker ps --filter "name=${SANDBOX_PREFIX}" -q 2>/dev/null | wc -l)
  TOTAL_STOPPED=$(docker ps -a --filter "name=${SANDBOX_PREFIX}" --filter "status=exited" -q 2>/dev/null | wc -l)
  echo "  Running: ${TOTAL_RUNNING}"
  echo "  Stopped: ${TOTAL_STOPPED}"
  echo "  Total:   $((TOTAL_RUNNING + TOTAL_STOPPED))"

  echo ""
  echo "Port Usage (50000-50999):"
  docker ps --filter "name=${SANDBOX_PREFIX}" --format "{{.Ports}}" 2>/dev/null | grep -oP '\d+(?=->5173)' | sort -n | while read port; do
    echo "  Port ${port} in use"
  done || echo "  No ports in use"
fi

echo ""
echo "=== Done ==="
