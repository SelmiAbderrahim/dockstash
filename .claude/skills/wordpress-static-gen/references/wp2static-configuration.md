# WP2Static Plugin Configuration

This document provides comprehensive configuration guidance for the WP2Static plugin in the ServerlessBase WordPress static generation workflow.

## Overview

WP2Static is a WordPress plugin that generates a static HTML version of your WordPress site. In the ServerlessBase architecture, it exports to a shared volume that the static-web nginx container serves.

## Installation

### Manual Installation

1. Download WP2Static from WordPress plugin repository
2. Upload to `/wp-content/plugins/` via FTP or file manager
3. Activate the plugin in WordPress admin

### Automated Installation (Recommended)

Use the plugin installer service in docker-compose:

```yaml
plugin-installer:
  image: wordpress:cli
  volumes:
    - wordpress_data:/var/www/html
  entrypoint: >
    sh -c '
      wp plugin install wp2static --activate --allow-root ||
      wp plugin activate wp2static --allow-root
    '
  depends_on:
    wordpress:
      condition: service_healthy
```

## Configuration Settings

### Output Directory

**Critical Setting:** Configure WP2Static to export to the shared volume:

| Setting | Value | Description |
|---------|-------|-------------|
| Destination URL | `https://yourdomain.com` | Public static site URL |
| Output Directory | `/app/static-export` | Path inside container |
| Deploy Method | `Local Directory` | For volume-based sharing |

### URL Handling

Configure URL rewriting for static export:

```
Detection Settings:
├── Detect URLs in: All common locations
├── Use relative URLs: Enabled (recommended)
├── Rewrite URLs: Enabled
└── Remove query strings: Enabled
```

### Detection Rules

Customize which URLs WP2Static detects:

```
Include Patterns:
/wp-content/uploads/*
/wp-content/themes/*/assets/*
/wp-includes/css/*
/wp-includes/js/*

Exclude Patterns:
/wp-admin/*
/wp-json/*
/xmlrpc.php
/wp-login.php
/wp-cron.php
```

## Export Configuration

### Basic Export Settings

```yaml
WP2Static Settings:
  Base URL: "https://yourdomain.com"
  Output Path: "/app/static-export"

Detection:
  Detect posts: true
  Detect pages: true
  Detect categories: true
  Detect tags: true
  Detect custom post types: true
  Detect media: true

Processing:
  Remove WP artifacts: true
  Use relative URLs: true
  Rename homepage: true (index.html)
  Generate sitemap: true
```

### Advanced Export Options

```yaml
Performance:
  Crawl increment: 50  # URLs per batch
  Crawl delay: 0       # Seconds between requests

Cleanup:
  Delete temp files: true
  Clean output before export: true

Redirects:
  Export .htaccess: false  # Not needed for nginx
  Handle 404s: true
```

## Integration with ServerlessBase

### Volume Mount Configuration

The static output directory must be mounted as a shared volume:

```yaml
volumes:
  static_bridge:
    name: "${APP_NAME}_static_bridge"

services:
  wordpress:
    volumes:
      - static_bridge:/app/static-export

  static-web:
    volumes:
      - static_bridge:/usr/share/nginx/html:ro
```

### File Permissions

Ensure WordPress can write to the export directory:

```bash
# Inside WordPress container
chown -R www-data:www-data /app/static-export
chmod -R 755 /app/static-export
```

## Automation

### WP-CLI Integration

Automate static generation via WP-CLI:

```bash
# Generate static site
wp wp2static generate --allow-root

# Deploy to output directory
wp wp2static deploy --allow-root

# Check generation status
wp wp2static status --allow-root
```

### Scheduled Generation

Create a cron job for automated regeneration:

```bash
# Inside WordPress container crontab
# Regenerate static site daily at 3 AM
0 3 * * * /usr/local/bin/wp wp2static generate --path=/var/www/html --allow-root
```

### API Triggering

Trigger generation via WordPress REST API:

```bash
# Trigger generation
curl -X POST \
  -H "Authorization: Bearer $WP_AUTH_TOKEN" \
  "https://admin.yourdomain.com/wp-json/wp2static/v1/generate"

# Check status
curl -H "Authorization: Bearer $WP_AUTH_TOKEN" \
  "https://admin.yourdomain.com/wp-json/wp2static/v1/status"
```

## Troubleshooting

### Common Issues

#### Generation Fails with Memory Error

Increase PHP memory limit:

```yaml
environment:
  PHP_MEMORY_LIMIT: 512M
```

#### Missing CSS/JS Files

Check detection settings:

1. Enable "Detect assets" option
2. Add custom patterns for theme assets
3. Verify relative URL rewriting

#### Broken Links After Export

Configure URL rewriting:

1. Enable "Use relative URLs"
2. Set correct base URL
3. Check for hardcoded absolute URLs in content

#### Export Directory Not Writable

Fix permissions:

```bash
docker exec wordpress chown -R www-data:www-data /app/static-export
```

### Debug Mode

Enable debug logging:

```php
// In wp-config.php
define('WP2STATIC_DEBUG', true);
```

View logs:

```bash
docker exec wordpress cat /var/www/html/wp-content/debug.log
```

## Performance Optimization

### Pre-Generation Caching

Enable Redis caching before generation:

```php
// In wp-config.php
define('WP_REDIS_HOST', 'redis');
define('WP_CACHE', true);
```

### Incremental Generation

For large sites, use incremental mode:

```yaml
WP2Static Settings:
  Incremental mode: true
  Only detect changes since: last_generation
```

### Batch Processing

Configure batch size based on server resources:

| Server Memory | Recommended Batch Size |
|---------------|----------------------|
| 512MB | 25 URLs |
| 1GB | 50 URLs |
| 2GB+ | 100 URLs |

## Addons

### WP2Static Addons for Enhanced Functionality

| Addon | Purpose |
|-------|---------|
| WP2Static Advanced Crawling | Better URL detection |
| WP2Static CloudFront | CDN deployment |
| WP2Static FTP | FTP deployment |

### Installation

```bash
wp plugin install wp2static-addon-advanced-crawling --activate --allow-root
```

## Best Practices

### Security

- Regenerate after security updates
- Exclude admin pages from detection
- Remove sensitive paths from export

### Performance

- Use caching during generation
- Schedule generation during low-traffic periods
- Clean temporary files after export

### Content

- Test links after generation
- Verify forms work (may need external service)
- Check media files are included
