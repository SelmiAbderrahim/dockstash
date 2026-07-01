#!/usr/bin/env bash
# Canary orchestration: runs the canary prompts end-to-end and reports.
#
# Usage:
#   ./prompt-executor/scripts/run_canary.sh [--model MODEL]
#
# Exit codes:
#   0 — canary passed
#   1 — canary failed (one or more steps failed)
#   2 — infrastructure failure (prompt-executor crash, missing env vars)

set -euo pipefail

MODEL="${1:-glm-5.1}"
PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
CANARY_DIR="$PROJECT_ROOT/prompts/claude-to-opencode-migration/canary"
REPORT_FILE="/tmp/canary-report.txt"

# Pre-flight: required env vars
if [ -z "${ZAI_API_KEY:-}" ]; then
  echo "ERROR: ZAI_API_KEY not set"
  exit 2
fi

# Pre-flight: opencode CLI available
if ! command -v opencode &> /dev/null; then
  echo "ERROR: 'opencode' CLI not found in PATH"
  exit 2
fi

# Pre-flight: opencode.jsonc exists
if [ ! -f "$PROJECT_ROOT/.opencode/opencode.jsonc" ]; then
  echo "ERROR: .opencode/opencode.jsonc not found. Did you run prompts 01-12?"
  exit 2
fi

# Clean up any stale report
rm -f "$REPORT_FILE"

# Run the canary via prompt-executor
echo "Running canary with model=$MODEL..."
cd "$PROJECT_ROOT"
python3 prompt-executor/prompt_executor.py run "$CANARY_DIR" \
  --model "$MODEL" \
  --max-retries 1 \
  --period 0

# Check the report
if [ ! -f "$REPORT_FILE" ]; then
  echo "ERROR: Canary did not produce $REPORT_FILE"
  exit 1
fi

if grep -q "CANARY_RESULT=PASS" "$REPORT_FILE"; then
  echo "Canary PASSED"
  cat "$REPORT_FILE"
  exit 0
else
  echo "Canary FAILED"
  cat "$REPORT_FILE"
  exit 1
fi
