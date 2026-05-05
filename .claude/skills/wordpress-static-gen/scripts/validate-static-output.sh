#!/bin/bash
# WordPress Static Generation - Output Validator
# Validates that static site generation completed successfully

set -euo pipefail

EXPECTED_PAGES=1
VERBOSE=false
CHECK_METHOD="volume"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }
log_debug() { $VERBOSE && echo -e "${BLUE}[DEBUG]${NC} $1"; }

show_help() {
    cat << 'EOF'
WordPress Static Generation - Output Validator

Usage:
  ./validate-static-output.sh --volume "myblog_static_bridge" [options]

Required:
  --volume NAME       Docker volume name to check

Optional:
  --expected-pages N  Minimum expected HTML pages (default: 1)
  --verbose           Show detailed output
  --help              Show this help message

Exit codes: 0=passed, 1=critical error, 2=warnings
EOF
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --volume) VOLUME_NAME="$2"; shift 2 ;;
        --expected-pages) EXPECTED_PAGES="$2"; shift 2 ;;
        --verbose|-v) VERBOSE=true; shift ;;
        --help|-h) show_help; exit 0 ;;
        *) log_error "Unknown: $1"; exit 1 ;;
    esac
done

[[ -z "${VOLUME_NAME:-}" ]] && { log_error "Missing --volume"; exit 1; }

ERRORS=0
WARNINGS=0

run_check() {
    docker run --rm -v "${VOLUME_NAME}:/data:ro" alpine sh -c "$1"
}

log_info "Checking access..."
docker volume inspect "$VOLUME_NAME" &>/dev/null || { log_error "Volume not found"; exit 1; }

log_info "Checking index.html..."
run_check "test -f /data/index.html" || { log_error "index.html missing"; ERRORS=$((ERRORS + 1)); }

log_info "Counting HTML pages..."
HTML_COUNT=$(run_check "find /data -name '*.html' -type f | wc -l" | tr -d '[:space:]')
[[ "$HTML_COUNT" -lt "$EXPECTED_PAGES" ]] && { log_warn "HTML count ($HTML_COUNT) < expected ($EXPECTED_PAGES)"; WARNINGS=$((WARNINGS + 1)); }

log_info "Checking CSS files..."
CSS_COUNT=$(run_check "find /data -name '*.css' -type f | wc -l" | tr -d '[:space:]')
[[ "$CSS_COUNT" -eq 0 ]] && { log_warn "No CSS files"; WARNINGS=$((WARNINGS + 1)); }

log_info "Checking images..."
IMG_COUNT=$(run_check "find /data \( -name '*.jpg' -o -name '*.png' -o -name '*.webp' \) | wc -l" | tr -d '[:space:]')

TOTAL_SIZE=$(run_check "du -sh /data 2>/dev/null | cut -f1" || echo "N/A")

echo ""
echo "========================================"
echo "        VALIDATION SUMMARY"
echo "========================================"
echo "  HTML Pages:  $HTML_COUNT"
echo "  CSS Files:   $CSS_COUNT"
echo "  Images:      $IMG_COUNT"
echo "  Total Size:  $TOTAL_SIZE"
echo ""

[[ $ERRORS -gt 0 ]] && { log_error "FAILED ($ERRORS errors)"; exit 1; }
[[ $WARNINGS -gt 0 ]] && { log_warn "PASSED ($WARNINGS warnings)"; exit 2; }
log_info "PASSED - all checks succeeded"
