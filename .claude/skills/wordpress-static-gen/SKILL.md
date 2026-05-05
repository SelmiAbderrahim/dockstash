---
name: wordpress-static-gen
description: Comprehensive guide for deploying WordPress with static site generation on ServerlessBase. Use when creating WordPress stacks, configuring WP2Static plugin, managing static content workflow, or implementing wake/sleep cost-saving patterns.
license: MIT
metadata:
  version: "1.0.0"
  author: "ServerlessBase Team"
  category: "cms-deployment"
  dependencies: "docker-compose, nginx, wordpress, mariadb, wp2static"
  project: "ServerlessBase - WordPress Static Generation"
---

# WordPress Static Site Generation

This skill provides comprehensive guidance for deploying WordPress with static site generation capabilities on the ServerlessBase platform.

## Overview

The WordPress Static Generation architecture implements a "Split Stack" pattern that separates content editing from content delivery:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SPLIT STACK ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────────────────────────────┐                            │
│  │     THE FACTORY (Backend)           │                            │
│  │     admin.example.com               │                            │
│  │     restart: no (sleeps)            │                            │
│  ├─────────────────────────────────────┤                            │
│  │  ┌───────────┐  ┌───────────┐       │                            │
│  │  │ WordPress │  │  MariaDB  │       │                            │
│  │  │ PHP-FPM   │  │   10.6    │       │                            │
│  │  └─────┬─────┘  └───────────┘       │                            │
│  │        │                             │                            │
│  │  ┌─────┴─────┐  ┌───────────┐       │                            │
│  │  │   Nginx   │  │   Redis   │       │                            │
│  │  │  (admin)  │  │  (cache)  │       │                            │
│  │  └───────────┘  └───────────┘       │                            │
│  └──────────────────┬──────────────────┘                            │
│                     │                                                │
│            WP2Static Plugin                                          │
│            (generates HTML)                                          │
│                     │                                                │
│                     ▼                                                │
│  ┌──────────────────────────────────────┐                           │
│  │         STATIC BRIDGE VOLUME         │                           │
│  │         /app/static-export           │                           │
│  └──────────────────┬───────────────────┘                           │
│                     │                                                │
│                     ▼                                                │
│  ┌─────────────────────────────────────┐                            │
│  │     THE DELIVERY (Frontend)         │                            │
│  │     example.com                     │                            │
│  │     restart: always (never sleeps)  │                            │
│  ├─────────────────────────────────────┤                            │
│  │  ┌───────────────────────────────┐  │                            │
│  │  │     Nginx (static-web)        │  │                            │
│  │  │  Serves static HTML/CSS/JS    │  │                            │
│  │  │  Low resource, high perf      │  │                            │
│  │  └───────────────────────────────┘  │                            │
│  └─────────────────────────────────────┘                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## When to Use This Skill

This skill should be used when:

- Creating a new WordPress stack with static site generation
- Configuring WP2Static plugin for static export
- Setting up the wake/sleep cost-saving pattern
- Troubleshooting static generation issues
- Understanding volume sharing between factory and delivery
- Configuring Traefik routing for split domains
- Implementing the complete WordPress → Static HTML workflow

## Key Concepts

### Split Stack Pattern

| Component | Domain | Restart Policy | Purpose |
|-----------|--------|----------------|---------|
| Factory (Backend) | `admin.example.com` | `no` (manual) | Content editing, WP admin |
| Delivery (Frontend) | `example.com` | `always` | Serve static content 24/7 |

### Cost-Saving Workflow

1. **Wake** - Start factory services when editing is needed
2. **Edit** - Make content changes in WordPress admin
3. **Generate** - Run WP2Static to export static HTML
4. **Sleep** - Stop factory services to save resources

### Volume Architecture

```yaml
volumes:
  wordpress_data:    # WordPress files (factory only)
  db_data:           # MariaDB data (factory only)
  redis_data:        # Redis cache (factory only)
  static_bridge:     # Shared between factory and delivery
```

## Process Workflow

### Creating a New WordPress Stack

To create a new WordPress stack with static generation:

1. Generate the compose file using `scripts/generate-wp-compose.sh`
2. Configure environment variables from `assets/env-templates/.env.wordpress`
3. Deploy via ServerlessBase compose service
4. Configure domains in Traefik
5. Install and configure WP2Static plugin
6. Set up the wake/sleep automation

### Generating Static Content

To generate static content from WordPress:

1. Wake the factory services if sleeping
2. Log in to WordPress admin at `admin.example.com`
3. Make content edits as needed
4. Navigate to WP2Static settings
5. Configure output to `/app/static-export`
6. Click "Generate Static Site"
7. Verify output with `scripts/validate-static-output.sh`
8. Sleep factory services when done

## Configuration

### Environment Variables

Reference `assets/env-templates/.env.wordpress` for required variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `APP_NAME` | Yes | Unique stack identifier |
| `DOMAIN` | Yes | Primary domain for static site |
| `WORDPRESS_DB_USER` | Yes | Database username |
| `WORDPRESS_DB_PASSWORD` | Yes | Database password |
| `WORDPRESS_DB_NAME` | Yes | Database name |

### WP2Static Configuration

Reference `references/wp2static-configuration.md` for detailed plugin setup:

- Output directory: `/app/static-export`
- URL rewriting settings
- Deployment options
- Caching considerations

### Nginx Configuration

Reference `references/nginx-static-serving.md` for:

- Static file serving optimization
- Caching headers
- Security headers
- Error page handling

## Docker Compose Templates

### Full Stack Template

Use `assets/compose-templates/full-stack.yml` for complete deployments including:

- WordPress PHP-FPM
- Nginx (admin access)
- MariaDB 10.6
- Redis caching
- Static web server

### Static Only Template

Use `assets/compose-templates/static-only.yml` for:

- Migrating existing static content
- Serving pre-generated HTML
- Minimal resource footprint

## Traefik Integration

### Routing Rules

```yaml
labels:
  # Admin access (factory)
  - "traefik.http.routers.${APP_NAME}-admin.rule=Host(`admin.${DOMAIN}`)"
  - "traefik.http.routers.${APP_NAME}-admin.entrypoints=websecure"
  - "traefik.http.routers.${APP_NAME}-admin.tls.certresolver=letsencrypt"

  # Public access (delivery)
  - "traefik.http.routers.${APP_NAME}-static.rule=Host(`${DOMAIN}`)"
  - "traefik.http.routers.${APP_NAME}-static.entrypoints=websecure"
  - "traefik.http.routers.${APP_NAME}-static.tls.certresolver=letsencrypt"
```

## Scripts Reference

### generate-wp-compose.sh

Generate a customized WordPress compose file:

```bash
./scripts/generate-wp-compose.sh \
  --app-name "myblog" \
  --domain "myblog.com" \
  --output "./docker-compose.yml"
```

### validate-static-output.sh

Verify static generation completed successfully:

```bash
./scripts/validate-static-output.sh \
  --volume "myblog_static_bridge" \
  --expected-pages 50
```

### check-stack-status.sh

Check the status of all stack services:

```bash
./scripts/check-stack-status.sh --app-name "myblog"
```

## API Endpoints

### Stack Lifecycle (tRPC)

| Procedure | Input | Description |
|-----------|-------|-------------|
| `wordpress.create` | CreateInput | Create new WordPress stack |
| `wordpress.wake` | { stackId } | Start factory services |
| `wordpress.sleep` | { stackId } | Stop factory services |
| `wordpress.status` | { stackId } | Get stack status |
| `wordpress.generateStatic` | { stackId } | Trigger static generation |

### Static Generation Status

| Procedure | Input | Description |
|-----------|-------|-------------|
| `wordpress.getGenerationHistory` | { stackId } | Get generation history |
| `wordpress.getGenerationStatus` | { stackId, jobId } | Get specific job status |

## Troubleshooting

### Static Site Not Updating

1. Verify WP2Static output directory is `/app/static-export`
2. Check volume mount in static-web service
3. Verify nginx has read access to volume
4. Check for WP2Static generation errors

### Factory Won't Wake

1. Check container health status
2. Verify database credentials
3. Check available system resources
4. Review container logs

### Static Files Return 404

1. Verify index.html exists in static_bridge volume
2. Check nginx root configuration
3. Verify volume is mounted correctly
4. Check file permissions

### Performance Issues

1. Enable Redis caching in WordPress
2. Configure OPcache settings
3. Review nginx caching headers
4. Monitor container resource usage

## Best Practices

### Security

- Use strong, unique passwords for all services
- Restrict admin domain access (IP whitelist or VPN)
- Keep WordPress and plugins updated during wake periods
- Enable SSL/TLS for all domains

### Performance

- Keep factory sleeping when not editing
- Use Redis for WordPress object caching
- Configure aggressive caching on static-web
- Minimize plugins in WordPress

### Reliability

- Regular database backups during wake periods
- Test static generation before sleeping
- Monitor static-web uptime
- Implement health checks

## Related Documentation

- `references/wp2static-configuration.md` - WP2Static plugin setup
- `references/nginx-static-serving.md` - Nginx configuration
- `references/docker-compose-patterns.md` - Compose patterns
- `references/volume-sharing.md` - Volume architecture details
