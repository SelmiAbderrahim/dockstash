# Docker Compose Patterns for WordPress Static Generation

This document provides Docker Compose patterns and best practices for the WordPress static generation architecture on ServerlessBase.

## Overview

The WordPress static generation stack uses a split architecture with two main components:

1. **Factory** - WordPress backend (sleeps when not in use)
2. **Delivery** - Nginx static server (always running)

## Service Definitions

### WordPress Service

```yaml
wordpress:
  image: wordpress:php8.3-fpm
  restart: no  # Manual control for wake/sleep
  environment:
    # Database configuration
    WORDPRESS_DB_HOST: db
    WORDPRESS_DB_USER: ${WORDPRESS_DB_USER}
    WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD}
    WORDPRESS_DB_NAME: ${WORDPRESS_DB_NAME}

    # Redis caching
    WORDPRESS_CONFIG_EXTRA: |
      define('WP_REDIS_HOST', 'redis');
      define('WP_REDIS_PORT', 6379);
      define('WP_CACHE', true);

    # PHP settings
    PHP_UPLOAD_MAX_FILESIZE: ${PHP_UPLOAD_MAX_FILESIZE:-256M}
    PHP_POST_MAX_SIZE: ${PHP_POST_MAX_SIZE:-256M}
    PHP_MEMORY_LIMIT: ${PHP_MEMORY_LIMIT:-512M}
    PHP_MAX_EXECUTION_TIME: ${PHP_MAX_EXECUTION_TIME:-300}

    # OPcache settings
    PHP_OPCACHE_MEMORY: ${PHP_OPCACHE_MEMORY:-128}
    PHP_OPCACHE_VALIDATE: ${PHP_OPCACHE_VALIDATE:-0}
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
  deploy:
    resources:
      limits:
        cpus: "${WORDPRESS_CPU_LIMIT:-1.0}"
        memory: "${WORDPRESS_MEMORY_LIMIT:-1G}"
  healthcheck:
    test: ["CMD-SHELL", "php-fpm-healthcheck || exit 1"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 30s
```

### Nginx Admin Service

```yaml
nginx-admin:
  image: nginx:alpine
  restart: no  # Sleeps with WordPress
  environment:
    NGINX_CLIENT_MAX_BODY_SIZE: ${NGINX_CLIENT_MAX_BODY_SIZE:-256M}
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
    - "traefik.http.routers.${APP_NAME}-admin.rule=Host(`admin.${DOMAIN}`)"
    - "traefik.http.routers.${APP_NAME}-admin.entrypoints=websecure"
    - "traefik.http.routers.${APP_NAME}-admin.tls.certresolver=letsencrypt"
    - "traefik.http.services.${APP_NAME}-admin.loadbalancer.server.port=80"
  deploy:
    resources:
      limits:
        cpus: "${NGINX_CPU_LIMIT:-0.5}"
        memory: "${NGINX_MEMORY_LIMIT:-256M}"
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost/healthz"]
    interval: 30s
    timeout: 10s
    retries: 3
```

### MariaDB Service

```yaml
db:
  image: mariadb:10.6
  restart: no  # Part of factory, sleeps with WordPress
  environment:
    MYSQL_DATABASE: ${WORDPRESS_DB_NAME:-wordpress}
    MYSQL_USER: ${WORDPRESS_DB_USER:-wordpress}
    MYSQL_PASSWORD: ${WORDPRESS_DB_PASSWORD}
    MYSQL_RANDOM_ROOT_PASSWORD: "yes"
  volumes:
    - db_data:/var/lib/mysql
  networks:
    - internal
  deploy:
    resources:
      limits:
        cpus: "${DB_CPU_LIMIT:-1.0}"
        memory: "${DB_MEMORY_LIMIT:-1G}"
  healthcheck:
    test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
    interval: 30s
    timeout: 10s
    retries: 5
    start_period: 60s
```

### Redis Service

```yaml
redis:
  image: redis:7-alpine
  restart: no  # Part of factory
  command: >
    redis-server
    --maxmemory ${REDIS_MAXMEMORY:-256mb}
    --maxmemory-policy ${REDIS_MAXMEMORY_POLICY:-allkeys-lru}
  volumes:
    - redis_data:/data
  networks:
    - internal
  deploy:
    resources:
      limits:
        cpus: "${REDIS_CPU_LIMIT:-0.5}"
        memory: "${REDIS_MEMORY_LIMIT:-512M}"
  healthcheck:
    test: ["CMD", "redis-cli", "ping"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 10s
```

### Static Web Service

```yaml
static-web:
  image: nginx:alpine
  restart: always  # Never sleeps - serves public traffic
  volumes:
    - static_bridge:/usr/share/nginx/html:ro
  networks:
    - serverless-network
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.${APP_NAME}-static.rule=Host(`${DOMAIN}`) || Host(`www.${DOMAIN}`)"
    - "traefik.http.routers.${APP_NAME}-static.entrypoints=websecure"
    - "traefik.http.routers.${APP_NAME}-static.tls.certresolver=letsencrypt"
    - "traefik.http.services.${APP_NAME}-static.loadbalancer.server.port=80"
    # Redirect www to non-www
    - "traefik.http.middlewares.${APP_NAME}-www-redirect.redirectregex.regex=^https://www\\.(.+)"
    - "traefik.http.middlewares.${APP_NAME}-www-redirect.redirectregex.replacement=https://$${1}"
    - "traefik.http.middlewares.${APP_NAME}-www-redirect.redirectregex.permanent=true"
    - "traefik.http.routers.${APP_NAME}-static.middlewares=${APP_NAME}-www-redirect"
  deploy:
    resources:
      limits:
        cpus: "${STATIC_CPU_LIMIT:-0.25}"
        memory: "${STATIC_MEMORY_LIMIT:-128M}"
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost/healthz"]
    interval: 30s
    timeout: 10s
    retries: 3
    start_period: 5s
```

## Volume Configuration

```yaml
volumes:
  # WordPress files (factory only)
  wordpress_data:
    name: "${APP_NAME}_wordpress_data"

  # Database storage (factory only)
  db_data:
    name: "${APP_NAME}_db_data"

  # Redis persistence (factory only)
  redis_data:
    name: "${APP_NAME}_redis_data"

  # Shared between factory and delivery
  static_bridge:
    name: "${APP_NAME}_static_bridge"
```

## Network Configuration

```yaml
networks:
  # External network for Traefik routing
  serverless-network:
    external: true

  # Internal network for service communication
  internal:
    driver: bridge
    internal: true  # No external access
```

## Restart Policy Reference

| Service | Restart Policy | Reason |
|---------|----------------|--------|
| wordpress | no | Manual wake/sleep control |
| nginx-admin | no | Sleeps with WordPress |
| db | no | Part of factory |
| redis | no | Part of factory |
| static-web | always | Always serves public traffic |

## Resource Limits Reference

### Factory Services (sleeping most of the time)

| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| WordPress | 1.0 | 1G |
| MariaDB | 1.0 | 1G |
| Redis | 0.5 | 512M |
| Nginx Admin | 0.5 | 256M |

### Delivery Services (always running)

| Service | CPU Limit | Memory Limit |
|---------|-----------|--------------|
| Static Web | 0.25 | 128M |

## Health Check Patterns

### PHP-FPM Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "php-fpm-healthcheck || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

### Nginx Health Check

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "--spider", "http://localhost/healthz"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 5s
```

### MariaDB Health Check

```yaml
healthcheck:
  test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
  interval: 30s
  timeout: 10s
  retries: 5
  start_period: 60s
```

### Redis Health Check

```yaml
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 10s
```

## Dependency Patterns

### Service Startup Order

```
┌─────────┐
│  redis  │──┐
└─────────┘  │
             ├──▶┌───────────┐    ┌──────────────┐
┌─────────┐  │   │ wordpress │───▶│ nginx-admin  │
│   db    │──┘   └───────────┘    └──────────────┘
└─────────┘

┌─────────────┐
│ static-web  │  (Independent, no dependencies)
└─────────────┘
```

### Depends On Configuration

```yaml
wordpress:
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_healthy

nginx-admin:
  depends_on:
    wordpress:
      condition: service_healthy
```

## Traefik Label Patterns

### Standard HTTPS Router

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.${APP_NAME}.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.${APP_NAME}.entrypoints=websecure"
  - "traefik.http.routers.${APP_NAME}.tls.certresolver=letsencrypt"
  - "traefik.http.services.${APP_NAME}.loadbalancer.server.port=80"
```

### WWW Redirect Middleware

```yaml
labels:
  - "traefik.http.middlewares.${APP_NAME}-www.redirectregex.regex=^https://www\\.(.+)"
  - "traefik.http.middlewares.${APP_NAME}-www.redirectregex.replacement=https://$${1}"
  - "traefik.http.middlewares.${APP_NAME}-www.redirectregex.permanent=true"
  - "traefik.http.routers.${APP_NAME}.middlewares=${APP_NAME}-www"
```

### Rate Limiting (Admin)

```yaml
labels:
  - "traefik.http.middlewares.${APP_NAME}-admin-ratelimit.ratelimit.average=100"
  - "traefik.http.middlewares.${APP_NAME}-admin-ratelimit.ratelimit.burst=50"
  - "traefik.http.routers.${APP_NAME}-admin.middlewares=${APP_NAME}-admin-ratelimit"
```

## Profiles

Use profiles to manage factory vs delivery services:

```yaml
services:
  wordpress:
    profiles: ["factory"]

  nginx-admin:
    profiles: ["factory"]

  db:
    profiles: ["factory"]

  redis:
    profiles: ["factory"]

  static-web:
    profiles: ["delivery"]
```

### Starting Services by Profile

```bash
# Start factory (for editing)
docker compose --profile factory up -d

# Start delivery (for serving)
docker compose --profile delivery up -d

# Start both
docker compose --profile factory --profile delivery up -d

# Stop factory (save resources)
docker compose --profile factory down
```

## Environment Variable Substitution

### Default Values

```yaml
environment:
  # With default value
  PHP_MEMORY_LIMIT: ${PHP_MEMORY_LIMIT:-512M}

  # Required (no default)
  WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD:?Database password required}
```

### Variable File

```bash
# .env file
APP_NAME=myblog
DOMAIN=myblog.com
WORDPRESS_DB_USER=wordpress
WORDPRESS_DB_PASSWORD=securepassword123
WORDPRESS_DB_NAME=wordpress
```
