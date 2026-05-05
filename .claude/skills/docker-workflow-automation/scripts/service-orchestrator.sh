#!/usr/bin/env bash

# Docker Service Orchestrator Script
# Advanced Docker Compose service management with dependency resolution
# Usage: ./service-orchestrator.sh <action> [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_DIR}/.env"

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
Docker Service Orchestrator

USAGE:
    $0 <ACTION> [OPTIONS]

ACTIONS:
    start               Start all services with dependency order
    stop                Stop all services gracefully
    restart             Restart all services
    status              Show service status and URLs
    health              Perform health checks
    scale <service> <count>  Scale specific service
    logs [service]      Show service logs

OPTIONS:
    -f, --force         Force operation (skip confirmations)
    -v, --verbose       Enable verbose output
    -q, --quiet         Suppress output (except errors)
    -t, --timeout SEC   Operation timeout (default: 60)
    -p, --profile NAME   Use specific Docker profile
    -h, --help          Show this help message

EXAMPLES:
    $0 start                           # Start all services
    $0 stop --force                    # Force stop all services
    $0 restart --verbose               # Restart with verbose output
    $0 scale client 3                  # Scale client to 3 instances
    $0 logs convex-backend             # Show backend logs
    $0 --profile production start      # Start with production profile

SERVICE DEPENDENCIES:
    redis → convex-backend → client → nginx
    (services start in dependency order)

EOF
}

# Configuration variables
FORCE=false
VERBOSE=false
QUIET=false
TIMEOUT=60
PROFILE=""
ACTION=""
SERVICE=""
SCALE_COUNT=""

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--force)
                FORCE=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -t|--timeout)
                TIMEOUT="$2"
                shift 2
                ;;
            -p|--profile)
                PROFILE="$2"
                shift 2
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            start|stop|restart|status|health|logs)
                ACTION="$1"
                shift
                ;;
            scale)
                ACTION="$1"
                SERVICE="$2"
                SCALE_COUNT="$3"
                shift 3
                ;;
            *)
                if [[ -z "$ACTION" ]]; then
                    log_error "Invalid action: $1"
                    usage
                    exit 1
                else
                    case "$ACTION" in
                        logs)
                            SERVICE="$1"
                            shift
                            ;;
                        *)
                            log_error "Unknown option: $1"
                            usage
                            exit 1
                            ;;
                    esac
                fi
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

    if [[ -z "$ACTION" ]]; then
        log_error "No action specified"
        usage
        exit 1
    fi

    # Validate scale action parameters
    if [[ "$ACTION" == "scale" ]]; then
        if [[ -z "$SERVICE" || -z "$SCALE_COUNT" ]]; then
            log_error "Scale action requires service and count parameters"
            usage
            exit 1
        fi
        if ! [[ "$SCALE_COUNT" =~ ^[0-9]+$ ]]; then
            log_error "Scale count must be a positive integer"
            exit 1
        fi
    fi
}

# Get Docker Compose command with options
get_docker_compose_cmd() {
    local cmd="docker-compose -f $COMPOSE_FILE --env-file $ENV_FILE"

    if [[ -n "$PROFILE" ]]; then
        cmd="$cmd --profile $PROFILE"
    fi

    echo "$cmd"
}

# Check if service exists
service_exists() {
    local service="$1"
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    $compose_cmd config --services | grep -q "^${service}$"
}

# Wait for service to be healthy
wait_for_service_health() {
    local service="$1"
    local max_attempts=30
    local attempt=1

    log_info "Waiting for $service to be healthy..."

    while [[ $attempt -le $max_attempts ]]; do
        local health_status
        health_status=$(docker inspect --format='{{.State.Health.Status}}' \
            "$($compose_cmd ps -q "$service" 2>/dev/null)" 2>/dev/null || echo "none")

        case "$health_status" in
            "healthy")
                log_success "$service is healthy"
                return 0
                ;;
            "unhealthy")
                log_warning "$service is unhealthy, attempt $attempt/$max_attempts"
                ;;
            "none")
                # Service might not have health check defined
                local container_status
                container_status=$(docker inspect --format='{{.State.Status}}' \
                    "$($compose_cmd ps -q "$service" 2>/dev/null)" 2>/dev/null || echo "not_found")

                if [[ "$container_status" == "running" ]]; then
                    log_success "$service is running (no health check)"
                    return 0
                fi
                ;;
        esac

        sleep 2
        ((attempt++))
    done

    log_error "$service failed to become healthy after $max_attempts attempts"
    return 1
}

# Start services with dependency order
start_services() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Starting Docker services..."

    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Command: $compose_cmd up -d"
    fi

    # Start services
    if ! $compose_cmd up -d; then
        log_error "Failed to start services"
        exit 1
    fi

    log_success "Services started successfully"

    # Wait for critical services to be healthy
    if [[ "$VERBOSE" == "true" ]]; then
        log_info "Checking service health..."
    fi

    # Check Redis first
    if service_exists "redis"; then
        wait_for_service_health "redis"
    fi

    # Check Convex backend
    if service_exists "convex-backend"; then
        wait_for_service_health "convex-backend"
    fi

    # Check client service
    if service_exists "client"; then
        wait_for_service_health "client"
    fi

    # Show service URLs
    show_service_urls
}

# Stop services gracefully
stop_services() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Stopping Docker services..."

    if [[ "$FORCE" == "true" ]]; then
        log_info "Force stopping services..."
        $compose_cmd down --remove-orphans --timeout 10
    else
        $compose_cmd down
    fi

    log_success "Services stopped successfully"
}

# Restart services
restart_services() {
    log_info "Restarting Docker services..."
    stop_services
    sleep 3
    start_services
}

# Show service status and URLs
show_service_status() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    log_info "Docker Service Status"
    echo "======================="

    # Show container status
    $compose_cmd ps

    echo ""
    show_service_urls
}

# Show service URLs
show_service_urls() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    if [[ -f "$ENV_FILE" ]]; then
        source "$ENV_FILE"
    fi

    log_info "Service URLs"
    echo "=============="

    # Client Application
    local client_port="${CLIENT_HOST_PORT:-5173}"
    echo "🌐 Client Application: http://localhost:$client_port"

    # Convex Dashboard
    local dashboard_port="${CONVEX_DASHBOARD_HOST_PORT:-6791}"
    echo "📊 Convex Dashboard: http://localhost:$dashboard_port"

    # Convex API
    local api_port="${CONVEX_API_HOST_PORT:-3210}"
    echo "🔗 Convex API: http://localhost:$api_port"

    # Nginx (if running with production profile)
    if docker ps --format "{{.Names}}" | grep -q "nginx"; then
        local nginx_port="${NGINX_HOST_PORT:-80}"
        echo "🌍 Nginx Proxy: http://localhost:$nginx_port"
    fi

    # Redis (for reference)
    local redis_port="${REDIS_HOST_PORT:-6379}"
    echo "🗄️  Redis: localhost:$redis_port"
}

# Perform health checks
perform_health_checks() {
    log_info "Performing service health checks..."

    # Run health monitor script if available
    local health_script="${SCRIPT_DIR}/docker-health-monitor.sh"
    if [[ -f "$health_script" ]]; then
        if [[ "$VERBOSE" == "true" ]]; then
            "$health_script" --verbose
        else
            "$health_script"
        fi
    else
        log_warning "Health monitor script not found, using basic checks"
        show_service_status
    fi
}

# Scale service
scale_service() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    if ! service_exists "$SERVICE"; then
        log_error "Service '$SERVICE' does not exist"
        exit 1
    fi

    log_info "Scaling service '$SERVICE' to $SCALE_COUNT instances..."

    if $compose_cmd up -d --scale "$SERVICE=$SCALE_COUNT"; then
        log_success "Service '$SERVICE' scaled successfully"
        show_service_status
    else
        log_error "Failed to scale service '$SERVICE'"
        exit 1
    fi
}

# Show service logs
show_logs() {
    local compose_cmd
    compose_cmd=$(get_docker_compose_cmd)

    local log_args="-f"
    if [[ "$QUIET" != "true" ]]; then
        log_args="$log_args --tail=100"
    fi

    if [[ -n "$SERVICE" ]]; then
        log_info "Showing logs for service: $SERVICE"
        $compose_cmd logs $log_args "$SERVICE"
    else
        log_info "Showing logs for all services"
        $compose_cmd logs $log_args
    fi
}

# Main execution
main() {
    parse_args "$@"
    validate_prerequisites

    if [[ "$QUIET" != "true" ]]; then
        log_info "Docker Service Orchestrator"
        log_info "Action: $ACTION"
        if [[ -n "$PROFILE" ]]; then
            log_info "Profile: $PROFILE"
        fi
        echo ""
    fi

    case "$ACTION" in
        "start")
            start_services
            ;;
        "stop")
            stop_services
            ;;
        "restart")
            restart_services
            ;;
        "status")
            show_service_status
            ;;
        "health")
            perform_health_checks
            ;;
        "scale")
            scale_service
            ;;
        "logs")
            show_logs
            ;;
        *)
            log_error "Unknown action: $ACTION"
            usage
            exit 1
            ;;
    esac

    if [[ "$QUIET" != "true" ]]; then
        log_success "Operation completed successfully"
    fi
}

# Execute main function with all arguments
main "$@"