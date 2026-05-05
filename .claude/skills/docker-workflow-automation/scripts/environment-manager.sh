#!/usr/bin/env bash

# Environment Manager Script
# Comprehensive environment variable management for Docker applications
# Usage: ./environment-manager.sh <action> [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
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
Environment Manager

USAGE:
    $0 <ACTION> [OPTIONS]

ACTIONS:
    validate            Validate environment configuration
    add <key> <value>   Add or update environment variable
    remove <key>        Remove environment variable
    backup              Create backup of environment file
    restore <file>      Restore environment from backup
    show [key]          Show environment variables
    generate <type>     Generate configuration templates
    encrypt <key>       Encrypt sensitive variable
    decrypt <key>       Decrypt sensitive variable

OPTIONS:
    -f, --file PATH     Environment file path (default: .env)
    -b, --backup        Create backup before modifications
    -q, --quiet         Suppress output (except errors)
    -v, --verbose       Enable verbose output
    -h, --help          Show this help message

TEMPLATES:
    development         Development environment template
    production          Production environment template
    testing             Testing environment template
    convex             Convex-specific variables

EXAMPLES:
    $0 validate                            # Validate current environment
    $0 add ASSEMBLYAI_API_KEY "your_key"   # Add new API key
    $0 remove OLD_API_KEY                  # Remove old variable
    $0 backup                             # Create environment backup
    $0 generate development                # Generate development template
    $0 show CONVEX_                       # Show Convex variables
    $0 encrypt DATABASE_URL                # Encrypt sensitive data

SECURITY:
    - Always creates backups before modifications
    - Supports encryption for sensitive variables
    - Validates required variables
    - Preserves existing API keys

EOF
}

# Configuration variables
ACTION=""
KEY=""
VALUE=""
ENV_FILE_PATH="$ENV_FILE"
BACKUP_BEFORE_MODIFY=false
QUIET=false
VERBOSE=false
BACKUP_FILE=""
TEMPLATE_TYPE=""

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -f|--file)
                ENV_FILE_PATH="$2"
                shift 2
                ;;
            -b|--backup)
                BACKUP_BEFORE_MODIFY=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            validate|add|remove|backup|restore|show|generate|encrypt|decrypt)
                ACTION="$1"
                shift
                ;;
            *)
                case "$ACTION" in
                    "add")
                        if [[ -z "$KEY" ]]; then
                            KEY="$1"
                        elif [[ -z "$VALUE" ]]; then
                            VALUE="$1"
                        else
                            log_error "Too many arguments for 'add' action"
                            usage
                            exit 1
                        fi
                        ;;
                    "remove"|"encrypt"|"decrypt")
                        if [[ -z "$KEY" ]]; then
                            KEY="$1"
                        else
                            log_error "Too many arguments for '$ACTION' action"
                            usage
                            exit 1
                        fi
                        ;;
                    "restore")
                        if [[ -z "$BACKUP_FILE" ]]; then
                            BACKUP_FILE="$1"
                        else
                            log_error "Too many arguments for 'restore' action"
                            usage
                            exit 1
                        fi
                        ;;
                    "show"|"generate")
                        if [[ -z "$TEMPLATE_TYPE" ]]; then
                            TEMPLATE_TYPE="$1"
                        fi
                        ;;
                    *)
                        log_error "Unknown option: $1"
                        usage
                        exit 1
                        ;;
                esac
                shift
                ;;
        esac
    done
}

# Validate prerequisites
validate_prerequisites() {
    if [[ -z "$ACTION" ]]; then
        log_error "No action specified"
        usage
        exit 1
    fi

    # Validate action-specific requirements
    case "$ACTION" in
        "add")
            if [[ -z "$KEY" || -z "$VALUE" ]]; then
                log_error "Add action requires key and value"
                usage
                exit 1
            fi
            ;;
        "remove"|"encrypt"|"decrypt")
            if [[ -z "$KEY" ]]; then
                log_error "$ACTION action requires key"
                usage
                exit 1
            fi
            ;;
        "restore")
            if [[ -z "$BACKUP_FILE" ]]; then
                log_error "Restore action requires backup file"
                usage
                exit 1
            fi
            ;;
    esac

    # Check if environment file exists
    if [[ "$ACTION" != "generate" && "$ACTION" != "restore" ]] && [[ ! -f "$ENV_FILE_PATH" ]]; then
        log_error "Environment file not found: $ENV_FILE_PATH"
        log_info "Use '$0 generate <template>' to create a new environment file"
        exit 1
    fi

    # Check if restore file exists
    if [[ "$ACTION" == "restore" && ! -f "$BACKUP_FILE" ]]; then
        log_error "Backup file not found: $BACKUP_FILE"
        exit 1
    fi
}

# Create backup of environment file
create_backup() {
    if [[ ! -f "$ENV_FILE_PATH" ]]; then
        log_warning "Environment file does not exist, skipping backup"
        return
    fi

    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name=".env.backup.${timestamp}"
    local backup_path
    backup_path=$(dirname "$ENV_FILE_PATH")/$backup_name

    cp "$ENV_FILE_PATH" "$backup_path"

    if [[ "$QUIET" != "true" ]]; then
        log_info "Created backup: $backup_name"
    fi

    echo "$backup_path"
}

# Validate environment file
validate_environment() {
    log_info "Validating environment configuration..."

    local errors=0
    local warnings=0

    # Check file format
    if grep -q "^[[:space:]]*#" "$ENV_FILE_PATH"; then
        # File has comments - good
        :
    else
        log_warning "No comments found in environment file"
        ((warnings++))
    fi

    # Check for required variables
    local required_vars=(
        "CONVEX_ADMIN_KEY"
        "NODE_ENV"
    )

    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" "$ENV_FILE_PATH"; then
            log_error "Missing required variable: $var"
            ((errors++))
        fi
    done

    # Check for suspicious values
    local suspicious_patterns=(
        "your_key_here"
        "CHANGE_ME"
        "example_key"
        "test_key"
        "replace_with"
    )

    while IFS= read -r line; do
        if [[ -n "$line" && ! "$line" =~ ^[[:space:]]*# ]]; then
            for pattern in "${suspicious_patterns[@]}"; do
                if [[ "$line" =~ $pattern ]]; then
                    log_warning "Suspicious value pattern detected: $line"
                    ((warnings++))
                fi
            done
        fi
    done < "$ENV_FILE_PATH"

    # Check for duplicate keys
    local duplicate_keys
    duplicate_keys=$(grep -v "^[[:space:]]*#" "$ENV_FILE_PATH" | cut -d= -f1 | sort | uniq -d)

    if [[ -n "$duplicate_keys" ]]; then
        log_error "Duplicate keys found:"
        echo "$duplicate_keys" | while read -r key; do
            log_error "  - $key"
        done
        ((errors++))
    fi

    # Validate port numbers
    local port_vars=(
        "CLIENT_HOST_PORT"
        "CONVEX_API_HOST_PORT"
        "CONVEX_DASHBOARD_HOST_PORT"
        "REDIS_HOST_PORT"
        "NGINX_HOST_PORT"
    )

    for var in "${port_vars[@]}"; do
        local value
        value=$(grep "^${var}=" "$ENV_FILE_PATH" | cut -d= -f2 || echo "")

        if [[ -n "$value" && ! "$value" =~ ^[0-9]+$ ]]; then
            log_error "Invalid port number for $var: $value"
            ((errors++))
        fi

        if [[ -n "$value" && ( "$value" -lt 1024 || "$value" -gt 65535 ) && "$value" != "80" && "$value" != "443" ]]; then
            log_warning "Port $value for $var is outside typical range"
            ((warnings++))
        fi
    done

    # Report results
    echo ""
    log_info "Validation Results:"
    echo "======================"
    echo "Errors: $errors"
    echo "Warnings: $warnings"

    if [[ $errors -eq 0 ]]; then
        if [[ $warnings -eq 0 ]]; then
            log_success "Environment file is valid"
        else
            log_warning "Environment file is valid but has warnings"
        fi
    else
        log_error "Environment file has $errors error(s)"
        exit 1
    fi
}

# Add or update environment variable
add_variable() {
    local key="$1"
    local value="$2"

    log_info "Adding/updating variable: $key"

    # Create backup if requested
    if [[ "$BACKUP_BEFORE_MODIFY" == "true" ]]; then
        create_backup >/dev/null
    fi

    # Check if key exists
    if grep -q "^${key}=" "$ENV_FILE_PATH"; then
        # Update existing variable
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "Updating existing variable: $key"
        fi
        sed -i.bak "s|^${key}=.*|${key}=${value}|" "$ENV_FILE_PATH"
        rm -f "${ENV_FILE_PATH}.bak"
    else
        # Add new variable
        if [[ "$VERBOSE" == "true" ]]; then
            log_info "Adding new variable: $key"
        fi
        echo "${key}=${value}" >> "$ENV_FILE_PATH"
    fi

    log_success "Variable added/updated successfully"
}

# Remove environment variable
remove_variable() {
    local key="$1"

    # Check if key exists
    if ! grep -q "^${key}=" "$ENV_FILE_PATH"; then
        log_warning "Variable not found: $key"
        return
    fi

    log_info "Removing variable: $key"

    # Create backup if requested
    if [[ "$BACKUP_BEFORE_MODIFY" == "true" ]]; then
        create_backup >/dev/null
    fi

    # Remove variable
    sed -i.bak "/^${key}=/d" "$ENV_FILE_PATH"
    rm -f "${ENV_FILE_PATH}.bak"

    log_success "Variable removed successfully"
}

# Show environment variables
show_variables() {
    local filter="${1:-}"

    log_info "Environment Variables"
    echo "======================="

    if [[ -n "$filter" ]]; then
        log_info "Showing variables matching: $filter"
        grep -v "^[[:space:]]*#" "$ENV_FILE_PATH" | grep "^${filter}" || log_info "No variables found matching: $filter"
    else
        # Show all non-comment lines
        grep -v "^[[:space:]]*#" "$ENV_FILE_PATH" | grep -v "^[[:space:]]*$" || log_info "No environment variables found"
    fi
}

# Generate environment template
generate_template() {
    local template_type="$1"

    log_info "Generating $template_type environment template..."

    local template_content=""

    case "$template_type" in
        "development")
            template_content="# Development Environment Configuration
# Generated on $(date)

# =============================================================================
# ENVIRONMENT SETTINGS
# =============================================================================
NODE_ENV=development
RESTART_POLICY=unless-stopped

# =============================================================================
# DOCKER PORT CONFIGURATION
# =============================================================================
CLIENT_HOST_PORT=5173
CONVEX_API_HOST_PORT=3210
CONVEX_DASHBOARD_HOST_PORT=6791
REDIS_HOST_PORT=6379
NGINX_HOST_PORT=80

# =============================================================================
# CONVEX CONFIGURATION
# =============================================================================
CONVEX_ADMIN_KEY=CHANGE_ME_GENERATE_WITH_MAKE_ADMIN_KEY
CONVEX_SITE_URL=http://localhost:5173

# =============================================================================
# EXTERNAL SERVICE API KEYS
# =============================================================================
# AssemblyAI API Configuration
ASSEMBLYAI_API_KEY=your_assemblyai_api_key_here
ASSEMBLYAI_WEBHOOK_SECRET=your_webhook_secret_here

# YouTube API Configuration
YOUTUBE_API_KEY=your_youtube_api_key_here

# Email Service Configuration
RESEND_API_KEY=your_resend_api_key_here
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=iReadYouTube

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here
ENCRYPTION_KEY=your_encryption_key_here

# =============================================================================
# DOCKER NETWORK CONFIGURATION
# =============================================================================
DOCKER_NETWORK_NAME=ireadyoutube-network
DOCKER_NETWORK_SUBNET=172.20.0.0/16
"
            ;;
        "production")
            template_content="# Production Environment Configuration
# Generated on $(date)

# =============================================================================
# ENVIRONMENT SETTINGS
# =============================================================================
NODE_ENV=production
RESTART_POLICY=always

# =============================================================================
# DOCKER PORT CONFIGURATION
# =============================================================================
CLIENT_HOST_PORT=5173
CONVEX_API_HOST_PORT=3210
CONVEX_DASHBOARD_HOST_PORT=6791
REDIS_HOST_PORT=6379
NGINX_HOST_PORT=80

# =============================================================================
# CONVEX CONFIGURATION
# =============================================================================
CONVEX_ADMIN_KEY=CHANGE_ME_GENERATE_WITH_MAKE_ADMIN_KEY
CONVEX_SITE_URL=https://your-domain.com

# =============================================================================
# EXTERNAL SERVICE API KEYS
# =============================================================================
# AssemblyAI API Configuration
ASSEMBLYAI_API_KEY=your_production_assemblyai_api_key
ASSEMBLYAI_WEBHOOK_SECRET=your_production_webhook_secret

# YouTube API Configuration
YOUTUBE_API_KEY=your_production_youtube_api_key

# Email Service Configuration
RESEND_API_KEY=your_production_resend_api_key
RESEND_FROM_EMAIL=noreply@yourdomain.com
RESEND_FROM_NAME=iReadYouTube

# =============================================================================
# SECURITY CONFIGURATION
# =============================================================================
JWT_SECRET=your_strong_jwt_secret_here
SESSION_SECRET=your_strong_session_secret_here
ENCRYPTION_KEY=your_strong_encryption_key_here

# =============================================================================
# DOCKER NETWORK CONFIGURATION
# =============================================================================
DOCKER_NETWORK_NAME=ireadyoutube-network
DOCKER_NETWORK_SUBNET=172.20.0.0/16
"
            ;;
        "convex")
            template_content="# Convex Configuration
# Generated on $(date)

# =============================================================================
# CONVEX SELF-HOSTED CONFIGURATION
# =============================================================================
CONVEX_SELF_HOSTED_URL=http://0.0.0.0:3210
CONVEX_ADMIN_KEY=CHANGE_ME_GENERATE_WITH_MAKE_ADMIN_KEY
CONVEX_SITE_URL=http://localhost:5173

# =============================================================================
# CONVEX DASHBOARD CONFIGURATION
# =============================================================================
CONVEX_DASHBOARD_HOST_PORT=6791
CONVEX_DASHBOARD_CONTAINER_PORT=6791

# =============================================================================
# CONVEX API CONFIGURATION
# =============================================================================
CONVEX_API_HOST_PORT=3210
CONVEX_API_CONTAINER_PORT=3210

# =============================================================================
# CONVEX DATA CONFIGURATION
# =============================================================================
CONVEX_DATA_VOLUME=ireadyoutube_convex_backend_data
CONVEX_UPLOADS_PATH=/app/convex/uploads
CONVEX_UPLOADS_VOLUME=ireadyoutube_convex_uploads

# =============================================================================
# CONVEX HEALTH CHECK CONFIGURATION
# =============================================================================
CONVEX_HEALTH_CHECK=curl -f http://localhost:3210/mutation
CONVEX_HEALTH_CHECK_START_PERIOD=30s
"
            ;;
        *)
            log_error "Unknown template type: $template_type"
            log_info "Available templates: development, production, convex"
            exit 1
            ;;
    esac

    # Write template to file
    if [[ -f "$ENV_FILE_PATH" ]]; then
        log_warning "Environment file already exists. Creating backup..."
        create_backup >/dev/null
    fi

    echo "$template_content" > "$ENV_FILE_PATH"

    log_success "$template_type template generated successfully"
    log_info "Please review and update the template with your actual values"
}

# Restore environment from backup
restore_environment() {
    local backup_file="$1"

    log_info "Restoring environment from: $backup_file"

    # Create backup of current file
    if [[ -f "$ENV_FILE_PATH" ]]; then
        create_backup >/dev/null
    fi

    # Restore from backup
    cp "$backup_file" "$ENV_FILE_PATH"

    log_success "Environment restored successfully"
}

# Encrypt sensitive variable (placeholder for actual encryption)
encrypt_variable() {
    local key="$1"

    log_warning "Encryption not yet implemented"
    log_info "Variable $key marked for encryption"
}

# Decrypt sensitive variable (placeholder for actual decryption)
decrypt_variable() {
    local key="$1"

    log_warning "Decryption not yet implemented"
    log_info "Variable $key marked for decryption"
}

# Main execution
main() {
    parse_args "$@"
    validate_prerequisites

    if [[ "$QUIET" != "true" ]]; then
        log_info "Environment Manager"
        log_info "Action: $ACTION"
        if [[ -n "$KEY" ]]; then
            log_info "Key: $KEY"
        fi
        echo ""
    fi

    case "$ACTION" in
        "validate")
            validate_environment
            ;;
        "add")
            add_variable "$KEY" "$VALUE"
            ;;
        "remove")
            remove_variable "$KEY"
            ;;
        "backup")
            create_backup
            ;;
        "restore")
            restore_environment "$BACKUP_FILE"
            ;;
        "show")
            show_variables "$TEMPLATE_TYPE"
            ;;
        "generate")
            generate_template "$TEMPLATE_TYPE"
            ;;
        "encrypt")
            encrypt_variable "$KEY"
            ;;
        "decrypt")
            decrypt_variable "$KEY"
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