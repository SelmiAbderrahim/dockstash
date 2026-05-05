# Volume Sharing Architecture

This document explains the volume architecture for WordPress static site generation on ServerlessBase, focusing on the critical static_bridge volume that connects the factory and delivery components.

## Overview

The WordPress static generation stack uses four volumes with different purposes and access patterns:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        VOLUME ARCHITECTURE                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    FACTORY VOLUMES                            │   │
│  │              (Only accessed by factory services)              │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                                │   │
│  │  ┌─────────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │ wordpress_data  │  │  db_data   │  │ redis_data │         │   │
│  │  │                 │  │            │  │            │         │   │
│  │  │ /var/www/html   │  │ /var/lib/  │  │   /data    │         │   │
│  │  │                 │  │   mysql    │  │            │         │   │
│  │  │  WordPress      │  │  MariaDB   │  │   Redis    │         │   │
│  │  │  PHP files      │  │  database  │  │   cache    │         │   │
│  │  │  Uploads        │  │  files     │  │   files    │         │   │
│  │  │  Plugins        │  │            │  │            │         │   │
│  │  └─────────────────┘  └────────────┘  └────────────┘         │   │
│  │                                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    BRIDGE VOLUME                              │   │
│  │         (Shared between factory and delivery)                 │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │                                                                │   │
│  │  ┌──────────────────────────────────────────────────────────┐│   │
│  │  │                  static_bridge                            ││   │
│  │  │                                                           ││   │
│  │  │   Factory Mount: /app/static-export (read-write)          ││   │
│  │  │   Delivery Mount: /usr/share/nginx/html (read-only)       ││   │
│  │  │                                                           ││   │
│  │  │   Contents:                                               ││   │
│  │  │   ├── index.html                                          ││   │
│  │  │   ├── about/                                              ││   │
│  │  │   │   └── index.html                                      ││   │
│  │  │   ├── blog/                                               ││   │
│  │  │   │   ├── index.html                                      ││   │
│  │  │   │   └── post-1/                                         ││   │
│  │  │   │       └── index.html                                  ││   │
│  │  │   ├── wp-content/                                         ││   │
│  │  │   │   └── uploads/                                        ││   │
│  │  │   ├── css/                                                ││   │
│  │  │   ├── js/                                                 ││   │
│  │  │   └── sitemap.xml                                         ││   │
│  │  │                                                           ││   │
│  │  └──────────────────────────────────────────────────────────┘│   │
│  │                                                                │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Volume Definitions

### wordpress_data

Primary WordPress installation files:

```yaml
volumes:
  wordpress_data:
    name: "${APP_NAME}_wordpress_data"
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/wordpress/${APP_NAME}/wordpress
```

**Contents:**
- `wp-admin/` - WordPress admin files
- `wp-content/` - Themes, plugins, uploads
- `wp-includes/` - WordPress core
- `wp-config.php` - Configuration
- `index.php` - Entry point

**Access:**
- WordPress: Read-Write (`/var/www/html`)
- Nginx Admin: Read-Only (`/var/www/html:ro`)

### db_data

MariaDB database files:

```yaml
volumes:
  db_data:
    name: "${APP_NAME}_db_data"
    driver: local
```

**Contents:**
- MySQL/MariaDB data files
- Transaction logs
- Binary logs (if enabled)

**Access:**
- MariaDB: Read-Write (`/var/lib/mysql`)

### redis_data

Redis persistence files:

```yaml
volumes:
  redis_data:
    name: "${APP_NAME}_redis_data"
    driver: local
```

**Contents:**
- `dump.rdb` - RDB snapshot
- `appendonly.aof` - AOF log (if enabled)

**Access:**
- Redis: Read-Write (`/data`)

### static_bridge (Critical)

The bridge volume connects factory and delivery:

```yaml
volumes:
  static_bridge:
    name: "${APP_NAME}_static_bridge"
    driver: local
```

**Contents:**
- Generated static HTML files
- Copied assets (CSS, JS, images)
- Sitemaps and feeds

**Access:**
- WordPress: Read-Write (`/app/static-export`)
- Static Web: Read-Only (`/usr/share/nginx/html:ro`)

## Mount Configurations

### Factory Mounts

```yaml
services:
  wordpress:
    volumes:
      # Primary WordPress files
      - wordpress_data:/var/www/html
      # Static output directory
      - static_bridge:/app/static-export

  nginx-admin:
    volumes:
      # WordPress files (read-only)
      - wordpress_data:/var/www/html:ro

  db:
    volumes:
      # Database files
      - db_data:/var/lib/mysql

  redis:
    volumes:
      # Cache persistence
      - redis_data:/data
```

### Delivery Mounts

```yaml
services:
  static-web:
    volumes:
      # Static files (read-only)
      - static_bridge:/usr/share/nginx/html:ro
```

## Data Flow

### Static Generation Flow

```
┌─────────────┐
│  WordPress  │
│  Container  │
└──────┬──────┘
       │
       │ 1. WP2Static crawls WordPress
       │
       ▼
┌─────────────┐
│  WP2Static  │
│   Plugin    │
└──────┬──────┘
       │
       │ 2. Generates static HTML
       │
       ▼
┌─────────────────────────────────────┐
│     /app/static-export              │
│     (static_bridge volume)          │
│                                      │
│  WordPress writes here (RW)         │
└───────────────────┬─────────────────┘
                    │
                    │ 3. Volume shared with delivery
                    │
                    ▼
┌─────────────────────────────────────┐
│  /usr/share/nginx/html              │
│  (static_bridge volume)             │
│                                      │
│  Nginx reads here (RO)              │
└───────────────────┬─────────────────┘
                    │
                    │ 4. Serves to visitors
                    │
                    ▼
┌─────────────────────────────────────┐
│          Public Internet            │
│         (https://domain.com)        │
└─────────────────────────────────────┘
```

## File Permissions

### WordPress Container

```dockerfile
# In WordPress Dockerfile
RUN mkdir -p /app/static-export && \
    chown -R www-data:www-data /app/static-export && \
    chmod -R 755 /app/static-export
```

### Static Web Container

```yaml
static-web:
  volumes:
    # Read-only mount - no write permission needed
    - static_bridge:/usr/share/nginx/html:ro
  user: "nginx"
```

### Permission Matrix

| Volume | WordPress | Nginx Admin | MariaDB | Redis | Static Web |
|--------|-----------|-------------|---------|-------|------------|
| wordpress_data | RW | RO | - | - | - |
| db_data | - | - | RW | - | - |
| redis_data | - | - | - | RW | - |
| static_bridge | RW | - | - | - | RO |

## Volume Initialization

### First Run Setup

When the stack starts for the first time:

1. WordPress initializes `wordpress_data`
2. MariaDB initializes `db_data`
3. Redis initializes `redis_data`
4. `static_bridge` is empty until first generation

### Seeding Static Content

For initial deployment before WordPress is ready:

```bash
# Create initial content
docker run --rm \
  -v myblog_static_bridge:/mnt \
  alpine sh -c 'echo "<h1>Coming Soon</h1>" > /mnt/index.html'
```

## Backup Strategies

### Factory Volumes

```bash
# Backup WordPress files
docker run --rm \
  -v myblog_wordpress_data:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/wordpress_data.tar.gz -C /data .

# Backup database
docker exec myblog_db sh -c 'exec mysqldump -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE' \
  > backups/database.sql
```

### Bridge Volume

```bash
# Backup static content (useful for rollback)
docker run --rm \
  -v myblog_static_bridge:/data:ro \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/static_bridge.tar.gz -C /data .
```

## Restoration

### Restore Factory

```bash
# Stop factory
docker compose --profile factory down

# Restore WordPress files
docker run --rm \
  -v myblog_wordpress_data:/data \
  -v $(pwd)/backups:/backup:ro \
  alpine tar xzf /backup/wordpress_data.tar.gz -C /data

# Restore database
docker exec -i myblog_db sh -c 'exec mysql -u$MYSQL_USER -p$MYSQL_PASSWORD $MYSQL_DATABASE' \
  < backups/database.sql

# Start factory
docker compose --profile factory up -d
```

### Restore Static Content

```bash
# Rollback static content
docker run --rm \
  -v myblog_static_bridge:/data \
  -v $(pwd)/backups:/backup:ro \
  alpine sh -c 'rm -rf /data/* && tar xzf /backup/static_bridge.tar.gz -C /data'
```

## Troubleshooting

### Permission Denied Errors

```bash
# Check ownership
docker exec myblog_wordpress ls -la /app/static-export

# Fix permissions
docker exec myblog_wordpress chown -R www-data:www-data /app/static-export
```

### Volume Not Shared

```bash
# Verify volume exists
docker volume ls | grep static_bridge

# Check volume mount
docker inspect myblog_wordpress | grep -A 10 Mounts
docker inspect myblog_static-web | grep -A 10 Mounts
```

### Stale Content

```bash
# Clear static bridge
docker run --rm \
  -v myblog_static_bridge:/data \
  alpine rm -rf /data/*

# Regenerate
docker exec myblog_wordpress wp wp2static generate --allow-root
```

### Disk Space Issues

```bash
# Check volume usage
docker system df -v | grep myblog

# Clean old static content
docker run --rm \
  -v myblog_static_bridge:/data \
  alpine find /data -type f -mtime +30 -delete
```

## Best Practices

### Volume Naming

- Always use `${APP_NAME}_` prefix for named volumes
- Use descriptive suffixes (`_data`, `_bridge`)
- Avoid generic names that may conflict

### Mount Options

- Use `:ro` for read-only access when writes not needed
- Use `:cached` on macOS for better performance
- Never mount sensitive volumes to untrusted containers

### Cleanup

```bash
# Remove unused volumes
docker volume prune

# Remove specific stack volumes
docker volume rm myblog_wordpress_data myblog_db_data myblog_redis_data myblog_static_bridge
```
