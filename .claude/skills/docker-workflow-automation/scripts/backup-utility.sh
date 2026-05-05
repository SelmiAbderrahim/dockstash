#!/usr/bin/env bash

# Docker Backup Utility Script
# Comprehensive backup and restore for Docker volumes and configuration
# Usage: ./backup-utility.sh <action> [options]

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
COMPOSE_FILE="${PROJECT_DIR}/docker/docker-compose.yml"
ENV_FILE="${PROJECT_DIR}/.env"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Default backup settings
DEFAULT_VOLUMES=(
    "ireadyoutube_redis_data"
    "ireadyoutube_convex_backend_data"
    "ireadyoutube_convex_uploads"
)

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
Docker Backup Utility

USAGE:
    $0 <ACTION> [OPTIONS]

ACTIONS:
    backup              Create backup of all volumes and configs
    restore <file>      Restore from backup file
    list                List available backups
    verify <file>       Verify backup file integrity
    clean <days>        Remove backups older than specified days

OPTIONS:
    -v, --volumes LIST  Comma-separated list of volumes to backup
    -e, --exclude LIST  Comma-separated list of volumes to exclude
    -c, --compress      Use compression (default: enabled)
    -f, --force         Skip confirmations
    -q, --quiet         Suppress output (except errors)
    -h, --help          Show this help message

EXAMPLES:
    $0 backup                           # Backup all volumes
    $0 backup --volumes redis_data      # Backup specific volume
    $0 restore backup-20241112.tar.gz   # Restore from backup
    $0 list                             # List available backups
    $0 verify backup-20241112.tar.gz    # Verify backup integrity
    $0 clean 30                         # Remove backups older than 30 days

BACKUP FILES:
    Format: convex-backup-YYYYMMDD_HHMMSS.tar.gz
    Location: ${BACKUP_DIR}/
    Includes: Volume data, configuration files, environment backup

EOF
}

# Configuration variables
ACTION=""
BACKUP_FILE=""
VOLUMES_TO_BACKUP=()
VOLUMES_TO_EXCLUDE=()
COMPRESS=true
FORCE=false
QUIET=false

# Parse command line arguments
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            -v|--volumes)
                IFS=',' read -ra VOLUMES_TO_BACKUP <<< "$2"
                shift 2
                ;;
            -e|--exclude)
                IFS=',' read -ra VOLUMES_TO_EXCLUDE <<< "$2"
                shift 2
                ;;
            -c|--compress)
                COMPRESS=true
                shift
                ;;
            -f|--force)
                FORCE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            backup|restore|list|verify|clean)
                ACTION="$1"
                shift
                ;;
            *.tar.gz)
                BACKUP_FILE="$1"
                shift
                ;;
            [0-9]*)
                if [[ "$ACTION" == "clean" ]]; then
                    CLEAN_DAYS="$1"
                fi
                shift
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

    if [[ -z "$ACTION" ]]; then
        log_error "No action specified"
        usage
        exit 1
    fi

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Validate action-specific requirements
    case "$ACTION" in
        "restore")
            if [[ -z "$BACKUP_FILE" ]]; then
                log_error "Restore action requires backup file"
                usage
                exit 1
            fi
            if [[ ! -f "$BACKUP_FILE" ]]; then
                # Try to find in backup directory
                if [[ -f "${BACKUP_DIR}/${BACKUP_FILE}" ]]; then
                    BACKUP_FILE="${BACKUP_DIR}/${BACKUP_FILE}"
                else
                    log_error "Backup file not found: $BACKUP_FILE"
                    exit 1
                fi
            fi
            ;;
        "verify")
            if [[ -z "$BACKUP_FILE" ]]; then
                log_error "Verify action requires backup file"
                usage
                exit 1
            fi
            ;;
        "clean")
            if [[ -z "${CLEAN_DAYS:-}" ]]; then
                log_error "Clean action requires number of days"
                usage
                exit 1
            fi
            if ! [[ "$CLEAN_DAYS" =~ ^[0-9]+$ ]]; then
                log_error "Days must be a positive integer"
                exit 1
            fi
            ;;
    esac
}

# Get all Docker volumes for the project
get_project_volumes() {
    local volumes=()

    if [[ ${#VOLUMES_TO_BACKUP[@]} -gt 0 ]]; then
        # Use specified volumes
        volumes=("${VOLUMES_TO_BACKUP[@]}")
    else
        # Get all volumes from Docker Compose
        local compose_volumes
        compose_volumes=$(docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" config --volumes 2>/dev/null || echo "")

        if [[ -n "$compose_volumes" ]]; then
            while IFS= read -r volume; do
                if [[ -n "$volume" ]]; then
                    volumes+=("$volume")
                fi
            done <<< "$compose_volumes"
        fi

        # Add default volumes if none found
        if [[ ${#volumes[@]} -eq 0 ]]; then
            volumes=("${DEFAULT_VOLUMES[@]}")
        fi
    fi

    # Filter out excluded volumes
    if [[ ${#VOLUMES_TO_EXCLUDE[@]} -gt 0 ]]; then
        local filtered_volumes=()
        for volume in "${volumes[@]}"; do
            local exclude=false
            for excluded in "${VOLUMES_TO_EXCLUDE[@]}"; do
                if [[ "$volume" == "$excluded" ]]; then
                    exclude=true
                    break
                fi
            done
            if [[ "$exclude" == "false" ]]; then
                filtered_volumes+=("$volume")
            fi
        done
        volumes=("${filtered_volumes[@]}")
    fi

    # Output volumes as space-separated string
    printf '%s ' "${volumes[@]}"
}

# Check if Docker volume exists
volume_exists() {
    local volume="$1"
    docker volume inspect "$volume" >/dev/null 2>&1
}

# Create backup
create_backup() {
    local timestamp
    timestamp=$(date +"%Y%m%d_%H%M%S")
    local backup_name="convex-backup-${timestamp}.tar.gz"
    local backup_path="${BACKUP_DIR}/${backup_name}"
    local temp_dir
    temp_dir=$(mktemp -d)

    log_info "Creating backup: $backup_name"

    # Get volumes to backup
    local volumes
    volumes=$(get_project_volumes)

    if [[ "$QUIET" != "true" ]]; then
        log_info "Volumes to backup: $volumes"
    fi

    # Create backup structure
    mkdir -p "${temp_dir}/volumes"
    mkdir -p "${temp_dir}/config"
    mkdir -p "${temp_dir}/metadata"

    # Backup Docker volumes
    for volume in $volumes; do
        if volume_exists "$volume"; then
            log_info "Backing up volume: $volume"

            if [[ "$COMPRESS" == "true" ]]; then
                docker run --rm \
                    -v "$volume":/volume_data \
                    -v "$temp_dir/volumes":/backup \
                    alpine sh -c "cd /volume_data && tar czf /backup/${volume}.tar.gz ."
            else
                docker run --rm \
                    -v "$volume":/volume_data \
                    -v "$temp_dir/volumes":/backup \
                    alpine sh -c "cd /volume_data && tar cf /backup/${volume}.tar ."
            fi
        else
            log_warning "Volume '$volume' not found, skipping"
        fi
    done

    # Backup configuration files
    log_info "Backing up configuration files"

    # Copy Docker Compose file
    cp "$COMPOSE_FILE" "${temp_dir}/config/docker-compose.yml"

    # Create environment backup (without sensitive data)
    cp "$ENV_FILE" "${temp_dir}/config/.env"

    # Create metadata
    cat > "${temp_dir}/metadata/backup-info.txt" << EOF
Backup Information
=================
Backup Date: $(date)
Timestamp: $timestamp
Hostname: $(hostname)
User: $(whoami)
Project Directory: $PROJECT_DIR

Volumes Backed Up:
$volumes

Backup Type: Full
Compression: $COMPRESS
EOF

    # Create final backup archive
    log_info "Creating backup archive..."

    cd "$temp_dir"
    if [[ "$COMPRESS" == "true" ]]; then
        tar czf "$backup_path" .
    else
        tar cf "$backup_path" .
    fi

    # Cleanup temp directory
    rm -rf "$temp_dir"

    # Verify backup was created
    if [[ -f "$backup_path" ]]; then
        local backup_size
        backup_size=$(du -h "$backup_path" | cut -f1)
        log_success "Backup created successfully: $backup_name ($backup_size)"
        log_info "Backup location: $backup_path"
    else
        log_error "Backup creation failed"
        exit 1
    fi
}

# Restore from backup
restore_backup() {
    local backup_path="$1"
    local temp_dir
    temp_dir=$(mktemp -d)

    log_info "Restoring from backup: $backup_path"

    # Verify backup file
    if ! verify_backup "$backup_path"; then
        log_error "Backup verification failed"
        exit 1
    fi

    # Confirmation prompt
    if [[ "$FORCE" != "true" ]]; then
        echo ""
        log_warning "This will REPLACE all current data with the backup content."
        echo "The following will be affected:"
        echo "- Docker volumes (Redis, Convex data, uploads)"
        echo "- Configuration files will be preserved"
        echo ""
        read -p "Are you sure you want to continue? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Restore cancelled"
            exit 0
        fi
    fi

    # Extract backup
    log_info "Extracting backup..."
    if [[ "$backup_path" == *.tar.gz ]]; then
        tar xzf "$backup_path" -C "$temp_dir"
    else
        tar xf "$backup_path" -C "$temp_dir"
    fi

    # Stop services
    log_info "Stopping Docker services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down

    # Restore volumes
    if [[ -d "$temp_dir/volumes" ]]; then
        for volume_file in "$temp_dir/volumes"/*.tar*; do
            if [[ -f "$volume_file" ]]; then
                local volume_name
                volume_name=$(basename "$volume_file" .tar.gz)
                if [[ "$volume_file" == *.tar ]]; then
                    volume_name=$(basename "$volume_file" .tar)
                fi

                log_info "Restoring volume: $volume_name"

                # Ensure volume exists
                if ! volume_exists "$volume_name"; then
                    docker volume create "$volume_name"
                fi

                # Extract volume data
                if [[ "$volume_file" == *.tar.gz ]]; then
                    docker run --rm \
                        -v "$volume_name":/volume_data \
                        -v "$volume_file":/backup.tar.gz \
                        alpine sh -c "cd /volume_data && tar xzf /backup.tar.gz"
                else
                    docker run --rm \
                        -v "$volume_name":/volume_data \
                        -v "$volume_file":/backup.tar \
                        alpine sh -c "cd /volume_data && tar xf /backup.tar"
                fi
            fi
        done
    fi

    # Cleanup temp directory
    rm -rf "$temp_dir"

    # Restart services
    log_info "Restarting Docker services..."
    docker-compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d

    log_success "Backup restored successfully"
    log_info "Services are starting up, please wait for them to be ready..."
}

# List available backups
list_backups() {
    log_info "Available Backups"
    echo "=================="

    if [[ ! -d "$BACKUP_DIR" ]] || [[ -z "$(ls -A "$BACKUP_DIR" 2>/dev/null)" ]]; then
        log_info "No backups found in $BACKUP_DIR"
        return
    fi

    local count=1
    for backup_file in "$BACKUP_DIR"/convex-backup-*.tar.gz; do
        if [[ -f "$backup_file" ]]; then
            local filename
            filename=$(basename "$backup_file")
            local size
            size=$(du -h "$backup_file" | cut -f1)
            local date_str
            date_str=$(echo "$filename" | sed 's/convex-backup-\(.*\)\.tar\.gz/\1/' | sed 's/_/ /')
            local formatted_date
            formatted_date=$(date -d "${date_str:0:8} ${date_str:9:2}:${date_str:11:2}:${date_str:13:2}" 2>/dev/null || echo "$date_str")

            printf "%3d. %-30s %10s  %s\n" "$count" "$filename" "$size" "$formatted_date"
            ((count++))
        fi
    done
}

# Verify backup integrity
verify_backup() {
    local backup_path="$1"

    log_info "Verifying backup: $backup_path"

    if [[ ! -f "$backup_path" ]]; then
        log_error "Backup file not found: $backup_path"
        return 1
    fi

    # Check file is readable
    if [[ ! -r "$backup_path" ]]; then
        log_error "Backup file is not readable: $backup_path"
        return 1
    fi

    # Check file format
    if file "$backup_path" | grep -q "gzip compressed"; then
        # Verify gzip integrity
        if gzip -t "$backup_path" 2>/dev/null; then
            log_success "Backup file integrity verified"
        else
            log_error "Backup file is corrupted"
            return 1
        fi
    elif file "$backup_path" | grep -q "tar archive"; then
        # Verify tar integrity
        if tar tf "$backup_path" >/dev/null 2>&1; then
            log_success "Backup file integrity verified"
        else
            log_error "Backup file is corrupted"
            return 1
        fi
    else
        log_error "Backup file is not a valid tar archive"
        return 1
    fi

    return 0
}

# Clean old backups
clean_backups() {
    local days="$1"
    local cutoff_date
    cutoff_date=$(date -d "$days days ago" +%Y%m%d_%H%M%S 2>/dev/null || date -v-${days}d +%Y%m%d_%H%M%S)

    log_info "Removing backups older than $days days (before $cutoff_date)"

    local removed_count=0
    for backup_file in "$BACKUP_DIR"/convex-backup-*.tar.gz; do
        if [[ -f "$backup_file" ]]; then
            local filename
            filename=$(basename "$backup_file")
            local backup_timestamp
            backup_timestamp=$(echo "$filename" | sed 's/convex-backup-\(.*\)\.tar\.gz/\1/')

            if [[ "$backup_timestamp" < "$cutoff_date" ]]; then
                log_info "Removing old backup: $filename"
                rm -f "$backup_file"
                ((removed_count++))
            fi
        fi
    done

    log_success "Removed $removed_count old backup(s)"
}

# Main execution
main() {
    parse_args "$@"
    validate_prerequisites

    if [[ "$QUIET" != "true" ]]; then
        log_info "Docker Backup Utility"
        log_info "Action: $ACTION"
        echo ""
    fi

    case "$ACTION" in
        "backup")
            create_backup
            ;;
        "restore")
            restore_backup "$BACKUP_FILE"
            ;;
        "list")
            list_backups
            ;;
        "verify")
            verify_backup "$BACKUP_FILE"
            ;;
        "clean")
            clean_backups "$CLEAN_DAYS"
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