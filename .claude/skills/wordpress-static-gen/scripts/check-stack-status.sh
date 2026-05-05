#!/bin/bash
# WordPress Static Generation - Stack Status Checker
# Checks the status of all services in a WordPress stack

set -euo pipefail

OUTPUT_JSON=false
WATCH_MODE=false

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

RUNNING="${GREEN}●${NC}"
STOPPED="${RED}○${NC}"
UNHEALTHY="${YELLOW}!${NC}"

show_help() {
    cat << 'EOF'
WordPress Static Generation - Stack Status Checker

Usage:
  ./check-stack-status.sh --app-name "myblog" [options]

Required:
  --app-name NAME    Stack identifier

Optional:
  --json             Output JSON format
  --watch            Continuous monitoring
  --help             Show this help
EOF
}

while [[ $# -gt 0 ]]; do
    case $1 in
        --app-name) APP_NAME="$2"; shift 2 ;;
        --json) OUTPUT_JSON=true; shift ;;
        --watch) WATCH_MODE=true; shift ;;
        --help|-h) show_help; exit 0 ;;
        *) echo "Unknown: $1" >&2; exit 1 ;;
    esac
done

[[ -z "${APP_NAME:-}" ]] && { echo "Missing --app-name" >&2; exit 1; }

get_status() {
    local name="$1"
    docker inspect "$name" &>/dev/null || { echo "not_found"; return; }
    local running=$(docker inspect -f '{{.State.Running}}' "$name" 2>/dev/null)
    [[ "$running" == "true" ]] && echo "running" || echo "stopped"
}

print_status() {
    echo ""
    echo "  WordPress Stack: ${CYAN}${APP_NAME}${NC}"
    echo "  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "  ${YELLOW}Factory${NC}"
    
    for svc in wordpress nginx-admin db redis; do
        local name="${APP_NAME}-${svc}-1"
        docker inspect "$name" &>/dev/null || name="${APP_NAME}_${svc}_1"
        local status=$(get_status "$name")
        local icon="$STOPPED"
        [[ "$status" == "running" ]] && icon="$RUNNING"
        printf "  %b %-15s %s\n" "$icon" "$svc" "$status"
    done
    
    echo ""
    echo "  ${GREEN}Delivery${NC}"
    local name="${APP_NAME}-static-web-1"
    docker inspect "$name" &>/dev/null || name="${APP_NAME}_static-web_1"
    local status=$(get_status "$name")
    local icon="$STOPPED"
    [[ "$status" == "running" ]] && icon="$RUNNING"
    printf "  %b %-15s %s\n" "$icon" "static-web" "$status"
    echo ""
}

print_json() {
    local services=()
    for svc in wordpress nginx-admin db redis static-web; do
        local name="${APP_NAME}-${svc}-1"
        docker inspect "$name" &>/dev/null || name="${APP_NAME}_${svc}_1"
        local status=$(get_status "$name")
        services+=("\"$svc\":\"$status\"")
    done
    echo "{\"app\":\"$APP_NAME\",\"services\":{$(IFS=,; echo "${services[*]}")}}"
}

if $OUTPUT_JSON; then
    print_json
elif $WATCH_MODE; then
    while true; do clear; print_status; sleep 5; done
else
    print_status
fi
