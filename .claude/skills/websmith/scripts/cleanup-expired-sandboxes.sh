#!/bin/bash
# cleanup-expired-sandboxes.sh - Remove expired WebSmith sandbox containers
# Usage: ./cleanup-expired-sandboxes.sh [--dry-run] [--max-age-minutes N]
#
# Options:
#   --dry-run              Show what would be removed without removing
#   --max-age-minutes N    Remove sandboxes older than N minutes (default: 15)

set -euo pipefail

SANDBOX_PREFIX="serverless-websmith-sandbox"
DRY_RUN=false
MAX_AGE_MINUTES=15

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --max-age-minutes)
      MAX_AGE_MINUTES="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--dry-run] [--max-age-minutes N]"
      exit 1
      ;;
  esac
done

echo "=== WebSmith Sandbox Cleanup ==="
echo "Max age: ${MAX_AGE_MINUTES} minutes"
echo "Dry run: ${DRY_RUN}"
echo ""

CLEANED=0
ERRORS=0
SKIPPED=0
NOW=$(date +%s)

# Get all WebSmith sandbox containers (running and stopped)
docker ps -a --filter "name=${SANDBOX_PREFIX}" --format "{{.Names}}\t{{.CreatedAt}}\t{{.Status}}" 2>/dev/null | while IFS=$'\t' read -r name created status; do
  # Parse creation time
  CREATED_EPOCH=$(date -d "${created}" +%s 2>/dev/null || echo "0")

  if [ "${CREATED_EPOCH}" = "0" ]; then
    echo "  SKIP: ${name} (unable to parse creation time)"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  AGE_SECONDS=$((NOW - CREATED_EPOCH))
  AGE_MINUTES=$((AGE_SECONDS / 60))

  if [ "${AGE_MINUTES}" -ge "${MAX_AGE_MINUTES}" ]; then
    if [ "${DRY_RUN}" = true ]; then
      echo "  WOULD REMOVE: ${name} (age: ${AGE_MINUTES} min, status: ${status})"
    else
      echo -n "  REMOVING: ${name} (age: ${AGE_MINUTES} min)... "
      if docker stop "${name}" > /dev/null 2>&1 && docker rm "${name}" > /dev/null 2>&1; then
        echo "OK"
        CLEANED=$((CLEANED + 1))
      else
        # Try force remove
        if docker rm -f "${name}" > /dev/null 2>&1; then
          echo "OK (forced)"
          CLEANED=$((CLEANED + 1))
        else
          echo "FAILED"
          ERRORS=$((ERRORS + 1))
        fi
      fi
    fi
  else
    echo "  KEEP: ${name} (age: ${AGE_MINUTES} min, max: ${MAX_AGE_MINUTES} min)"
    SKIPPED=$((SKIPPED + 1))
  fi
done

echo ""
echo "=== Cleanup Summary ==="
echo "  Cleaned: ${CLEANED}"
echo "  Skipped: ${SKIPPED}"
echo "  Errors:  ${ERRORS}"

# Also clean up any orphaned containers that failed to start
echo ""
echo "Checking for orphaned containers..."
ORPHANED=$(docker ps -a --filter "name=${SANDBOX_PREFIX}" --filter "status=created" -q 2>/dev/null | wc -l)
if [ "${ORPHANED}" -gt 0 ]; then
  if [ "${DRY_RUN}" = true ]; then
    echo "  WOULD REMOVE ${ORPHANED} orphaned container(s)"
  else
    echo "  Removing ${ORPHANED} orphaned container(s)..."
    docker ps -a --filter "name=${SANDBOX_PREFIX}" --filter "status=created" -q 2>/dev/null | xargs -r docker rm -f
    echo "  Done"
  fi
else
  echo "  No orphaned containers found"
fi

echo ""
echo "=== Done ==="
