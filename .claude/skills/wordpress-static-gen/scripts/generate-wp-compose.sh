#!/bin/bash
# WordPress Static Generation - Compose File Generator
# Generates a customized docker-compose.yml for WordPress static site deployments
#
# Usage:
#   ./generate-wp-compose.sh --app-name "myblog" --domain "myblog.com" [--output "./docker-compose.yml"]

set -euo pipefail

# Default values
OUTPUT_FILE="./docker-compose.yml"
INCLUDE_PHPMYADMIN=true

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1" >&2; }

show_help() {
    cat << 'EOF'
WordPress Static Generation - Compose File Generator

Usage:
  ./generate-wp-compose.sh --app-name "myblog" --domain "myblog.com" [options]

Required Options:
  --app-name NAME      Unique stack identifier
  --domain DOMAIN      Primary domain for the static site

Optional:
  --output PATH        Output file path (default: ./docker-compose.yml)
  --no-phpmyadmin      Exclude phpMyAdmin service
  --help               Show this help message
EOF
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --app-name) APP_NAME="$2"; shift 2 ;;
        --domain) DOMAIN="$2"; shift 2 ;;
        --output) OUTPUT_FILE="$2"; shift 2 ;;
        --no-phpmyadmin) INCLUDE_PHPMYADMIN=false; shift ;;
        --help|-h) show_help; exit 0 ;;
        *) log_error "Unknown option: $1"; exit 1 ;;
    esac
done

# Validate required arguments
[[ -z "${APP_NAME:-}" ]] && { log_error "Missing --app-name"; exit 1; }
[[ -z "${DOMAIN:-}" ]] && { log_error "Missing --domain"; exit 1; }
[[ ! "$APP_NAME" =~ ^[a-z0-9-]+$ ]] && { log_error "App name must be lowercase alphanumeric with hyphens"; exit 1; }

# Create output directory
OUTPUT_DIR=$(dirname "$OUTPUT_FILE")
[[ ! -d "$OUTPUT_DIR" ]] && mkdir -p "$OUTPUT_DIR"

log_info "Generating docker-compose.yml for $APP_NAME ($DOMAIN)"

# phpMyAdmin service
PHPMYADMIN_SERVICE=""
if $INCLUDE_PHPMYADMIN; then
    PHPMYADMIN_SERVICE='
  phpmyadmin:
    image: phpmyadmin/phpmyadmin:latest
    restart: "no"
    environment:
      - PMA_HOST=db
      - PMA_PORT=3306
      - UPLOAD_LIMIT=${PMA_UPLOAD_LIMIT:-256M}
    depends_on:
      db:
        condition: service_healthy
    networks:
      - serverless-network
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.'"${APP_NAME}"'-pma.rule=Host(`pma.'"${DOMAIN}"'`)"
      - "traefik.http.routers.'"${APP_NAME}"'-pma.entrypoints=websecure"
      - "traefik.http.routers.'"${APP_NAME}"'-pma.tls.certresolver=letsencrypt"
      - "traefik.http.services.'"${APP_NAME}"'-pma.loadbalancer.server.port=80"'
fi

cat > "$OUTPUT_FILE" << EOF
# WordPress Static Generation Stack
# App Name: ${APP_NAME}
# Domain: ${DOMAIN}
# Generated: $(date -Iseconds)

services:
  # THE FACTORY (Backend - Sleeping)
  wordpress:
    image: wordpress:php8.3-fpm
    restart: "no"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: \${WORDPRESS_DB_USER:-wordpress}
      WORDPRESS_DB_PASSWORD: \${WORDPRESS_DB_PASSWORD}
      WORDPRESS_DB_NAME: \${WORDPRESS_DB_NAME:-wordpress}
      WORDPRESS_CONFIG_EXTRA: |
        define('WP_REDIS_HOST', 'redis');
        define('WP_REDIS_PORT', 6379);
        define('WP_CACHE', true);
      PHP_MEMORY_LIMIT: \${PHP_MEMORY_LIMIT:-512M}
      PHP_UPLOAD_MAX_FILESIZE: \${PHP_UPLOAD_MAX_FILESIZE:-256M}
      PHP_POST_MAX_SIZE: \${PHP_POST_MAX_SIZE:-256M}
    volumes:
      - wordpress_data:/var/www/html
      - static_bridge:/app/static-export
    depends_on:
      db:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - internal
    healthcheck:
      test: ["CMD-SHELL", "php-fpm-healthcheck || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  nginx-admin:
    image: nginx:alpine
    restart: "no"
    volumes:
      - wordpress_data:/var/www/html:ro
    depends_on:
      wordpress:
        condition: service_healthy
    networks:
      - serverless-network
      - internal
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${APP_NAME}-admin.rule=Host(\`admin.${DOMAIN}\`)"
      - "traefik.http.routers.${APP_NAME}-admin.entrypoints=websecure"
      - "traefik.http.routers.${APP_NAME}-admin.tls.certresolver=letsencrypt"
      - "traefik.http.services.${APP_NAME}-admin.loadbalancer.server.port=80"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: mariadb:10.6
    restart: "no"
    environment:
      MYSQL_DATABASE: \${WORDPRESS_DB_NAME:-wordpress}
      MYSQL_USER: \${WORDPRESS_DB_USER:-wordpress}
      MYSQL_PASSWORD: \${WORDPRESS_DB_PASSWORD}
      MYSQL_RANDOM_ROOT_PASSWORD: "yes"
    volumes:
      - db_data:/var/lib/mysql
    networks:
      - internal
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 30s
      timeout: 10s
      retries: 5
      start_period: 60s

  redis:
    image: redis:7-alpine
    restart: "no"
    command: redis-server --maxmemory \${REDIS_MAXMEMORY:-256mb} --maxmemory-policy allkeys-lru
    volumes:
      - redis_data:/data
    networks:
      - internal
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3
${PHPMYADMIN_SERVICE}

  # THE DELIVERY (Frontend - Always On)
  static-web:
    image: nginx:alpine
    restart: always
    volumes:
      - static_bridge:/usr/share/nginx/html:ro
    networks:
      - serverless-network
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.${APP_NAME}-static.rule=Host(\`${DOMAIN}\`) || Host(\`www.${DOMAIN}\`)"
      - "traefik.http.routers.${APP_NAME}-static.entrypoints=websecure"
      - "traefik.http.routers.${APP_NAME}-static.tls.certresolver=letsencrypt"
      - "traefik.http.services.${APP_NAME}-static.loadbalancer.server.port=80"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  wordpress_data:
    name: "${APP_NAME}_wordpress_data"
  db_data:
    name: "${APP_NAME}_db_data"
  redis_data:
    name: "${APP_NAME}_redis_data"
  static_bridge:
    name: "${APP_NAME}_static_bridge"

networks:
  serverless-network:
    external: true
  internal:
    driver: bridge
    internal: true
EOF

log_info "Generated: $OUTPUT_FILE"
log_info "Domains: admin.${DOMAIN}, ${DOMAIN}"
