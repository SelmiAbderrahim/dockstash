#!/usr/bin/env bash

# Docker Health Monitor Script
# Comprehensive health monitoring for Docker services
# Usage: ./docker-health-monitor.sh [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_DIR}/.env"

# Default settings
VERBOSE=false
JSON_OUTPUT=false
SERVICE_FILTER=""
TIMEOUT=30
RETRY_COUNT=3

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Usage information
usage() {
    cat << EOF
Docker Health Monitor Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    -v, --verbose          Enable verbose output
    -j, --json             Output in JSON format
    -s, --service NAME     Check specific service only
    -t, --timeout SECONDS  Timeout for health checks (default: 30)
    -r, --retry COUNT      Number of retries (default: 3)
    -h, --help             Show this help message

EXAMPLES:
    $0                              # Check all services
    $0 -s client                    # Check only client service
    $0 -v --json                    # Verbose JSON output
    $0 -t 60 -r 5                   # Custom timeout and retries

SERVICES:
    redis           - Redis caching service
    convex-backend  - Convex backend and dashboard
    client          - React frontend application
    nginx           - Nginx reverse proxy (production)

EOF
}

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -j|--json)
                JSON_OUTPUT=true
                shift
                ;;
            -s|--service)
                SERVICE_FILTER="$2"
                shift 2
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -r|--retry)
                RETRY_COUNT="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "Docker Compose file not found: $COMPOSE_FILE"
        exit 1
    fi

    if [[ ! -f "$ENV_FILE" ]]; then
        log_error "Environment file not found: $ENV_FILE"
        exit 1
    fi

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed or not in PATH"
        exit 1
    fi
}

# Get service health status
get_service_health() {
    local service_name="$1"
    local container_name
    local health_status
    local status_output

    container_name=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps -q "$service_name" 2>/dev/null || echo "")

    if [[ -z "$container_name" ]]; then
        echo "not_found"
        return
    fi

    status_output=$(docker inspect --format='{{.State.Status}}' "$container_name" 2>/dev/null || echo "error")

    if [[ "$status_output" == "running" ]]; then
        health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")

        case "$health_status" in
            "healthy")
                echo "healthy"
                ;;
            "unhealthy")
                echo "unhealthy"
                ;;
            "none")
                echo "running"
                ;;
            *)
                echo "unknown"
                ;;
        esac
    else
        echo "$status_status"
    fi
}

# Get service URL and port information
get_service_info() {
    local service_name="$1"
    local port_info
    local service_url

    port_info=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps "$service_name" --format "{{.Ports}}" 2>/dev/null || echo "")

    case "$service_name" in
        "client")
            service_url="http://localhost:5173"
            ;;
        "convex-backend")
            service_url="http://localhost:3210 (API), http://localhost:6791 (Dashboard)"
            ;;
        "redis")
            service_url="localhost:6379"
            ;;
        "nginx")
            service_url="http://localhost:80"
            ;;
        *)
            service_url="N/A"
            ;;
    esac

    echo "$service_url"
}

# Perform detailed health check for a service
perform_health_check() {
    local service_name="$1"
    local health_status
    local service_url
    local attempt=1
    local check_result

    health_status=$(get_service_health "$service_name")
    service_url=$(get_service_info "$service_name")

    if [[ "$JSON_OUTPUT" == "true" ]]; then
        echo "{\"service\":\"$service_name\",\"status\":\"$health_status\",\"url\":\"$service_url\"}"
        return
    fi

    # Retry logic for unhealthy services
    while [[ $attempt -le $RETRY_COUNT ]] && [[ "$health_status" == "unhealthy" ]]; do
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "Retry $attempt/$RETRY_COUNT for service: $service_name"
        fi
        sleep 2
        health_status=$(get_service_health "$service_name")
        ((attempt++))
    done

    # Output status
    case "$health_status" in
        "healthy")
            log_success "$service_name: HEALTHY ✓ ($service_url)"
            ;;
        "running")
            log_success "$service_name: RUNNING ✓ ($service_url)"
            ;;
        "unhealthy")
            log_error "$service_name: UNHEALTHY ✗ ($service_url)"
            ;;
        "not_found")
            log_error "$service_name: NOT FOUND ✗"
            ;;
        "exited")
            log_error "$service_name: STOPPED ✗ ($service_url)"
            ;;
        *)
            log_warning "$service_name: UNKNOWN ⚠ ($service_url)"
            ;;
    esac

    # Additional verbose information
    if [[ "$VERBOSE" == "true" ]]; then
        local container_info
        container_info=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" ps "$service_name" --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || echo "N/A")
        echo "  Container Info: $container_info"
    fi
}

# Get all services
get_all_services() {
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config --services 2>/dev/null || echo ""
}

# Main health check function
main_health_check() {
    local services
    local overall_healthy=true

    if [[ -n "$SERVICE_FILTER" ]]; then
        services=("$SERVICE_FILTER")
    else
        IFS=$'\n' read -ra services -d '' <<< "$(get_all_services)"
    fi

    if [[ "$JSON_OUTPUT" == "true" ]]; then
        echo "["
        local first=true
        for service in "${services[@]}"; do
            if [[ "$first" == "true" ]]; then
                first=false
            else
                echo ","
            fi
            perform_health_check "$service"
        done
        echo "]"
    else
        log_info "Docker Health Monitor - Checking Services..."
        echo "=========================================="

        for service in "${services[@]}"; do
            perform_health_check "$service"
            local health_status
            health_status=$(get_service_health "$service")

            if [[ "$health_status" != "healthy" && "$health_status" != "running" ]]; then
                overall_healthy=false
            fi
        done

        echo "=========================================="
        if [[ "$overall_healthy" == "true" ]]; then
            log_success "All services are healthy! ✓"
        else
            log_error "Some services are unhealthy! ✗"
            exit 1
        fi
    fi
}

# Main execution
main() {
    parse_args "$@"
    validate_prerequisites

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Docker Health Monitor Started"
        log_info "Compose File: $COMPOSE_FILE"
        log_info "Environment File: $ENV_FILE"
        log_info "Timeout: ${TIMEOUT}s, Retries: $RETRY_COUNT"
        echo ""
    fi

    main_health_check
}

# Execute main function with all arguments
main "$@"