# Nginx Static Serving Configuration

This document provides nginx configuration guidance for serving static WordPress content in the ServerlessBase platform.

## Overview

The static-web nginx container serves pre-generated HTML content from the shared volume. This configuration is optimized for performance, security, and reliability.

## Base Configuration

### Static Site Server Block

```nginx
server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml
        application/json
        application/rss+xml
        application/atom+xml
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check
    location /healthz {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Static file handling
    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }
}
```

## Caching Configuration

### Browser Caching

Configure aggressive caching for static assets:

```nginx
# HTML files - short cache
location ~* \.html$ {
    expires 1h;
    add_header Cache-Control "public, must-revalidate";
}

# CSS and JavaScript - long cache with versioning
location ~* \.(css|js)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# Images - long cache
location ~* \.(ico|gif|jpe?g|png|webp|svg|avif)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    access_log off;
}

# Fonts - long cache
location ~* \.(woff2?|ttf|eot|otf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    add_header Access-Control-Allow-Origin "*";
    access_log off;
}

# Media files - long cache
location ~* \.(mp4|webm|ogg|mp3|wav|pdf)$ {
    expires 1y;
    add_header Cache-Control "public";
    access_log off;
}
```

### ETag Configuration

Enable ETags for cache validation:

```nginx
etag on;
if_modified_since before;
```

## Security Configuration

### Deny Hidden Files

```nginx
# Deny access to hidden files
location ~ /\. {
    deny all;
    access_log off;
    log_not_found off;
}

# Deny access to backup files
location ~ ~$ {
    deny all;
    access_log off;
}
```

### Content Security Policy

```nginx
# CSP header for static sites
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    connect-src 'self';
    frame-ancestors 'self';
" always;
```

### CORS Configuration

For assets that need cross-origin access:

```nginx
location ~* \.(eot|ttf|woff|woff2|svg)$ {
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Methods "GET, OPTIONS";
    add_header Access-Control-Allow-Headers "Origin, X-Requested-With, Content-Type, Accept";
}
```

## Performance Optimization

### Connection Handling

```nginx
# Optimize connection handling
keepalive_timeout 65;
keepalive_requests 100;

# Optimize file serving
sendfile on;
tcp_nopush on;
tcp_nodelay on;

# Buffer sizes
client_body_buffer_size 10K;
client_header_buffer_size 1k;
client_max_body_size 8m;
large_client_header_buffers 2 1k;
```

### Open File Cache

```nginx
# Cache file descriptors
open_file_cache max=1000 inactive=20s;
open_file_cache_valid 30s;
open_file_cache_min_uses 2;
open_file_cache_errors on;
```

## Error Pages

### Custom Error Pages

```nginx
# Custom error pages
error_page 404 /404.html;
error_page 500 502 503 504 /50x.html;

location = /404.html {
    internal;
}

location = /50x.html {
    internal;
}
```

### 404.html Template

Create a static 404 page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found</title>
    <style>
        body {
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 2rem;
        }
        h1 { font-size: 4rem; margin: 0; color: #333; }
        p { color: #666; margin: 1rem 0; }
        a { color: #0066cc; text-decoration: none; }
        a:hover { text-decoration: underline; }
    </style>
</head>
<body>
    <div class="container">
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/">Return to homepage</a>
    </div>
</body>
</html>
```

## WordPress-Specific Configuration

### Pretty URLs

Handle WordPress permalink structure:

```nginx
# Support for WordPress permalinks
location / {
    try_files $uri $uri/ $uri/index.html $uri.html /index.html;
}

# Blog post URLs (date-based)
location ~ ^/\d{4}/\d{2}/ {
    try_files $uri $uri/ $uri/index.html =404;
}

# Category and tag archives
location ~ ^/(category|tag)/ {
    try_files $uri $uri/ $uri/index.html =404;
}
```

### Feed Handling

```nginx
# RSS/Atom feeds
location ~* /feed/?$ {
    try_files $uri $uri/ /feed/index.xml /feed.xml =404;
    add_header Content-Type "application/rss+xml; charset=utf-8";
}
```

### Sitemap Handling

```nginx
# Sitemap files
location ~* sitemap.*\.xml$ {
    try_files $uri $uri/ =404;
    add_header Content-Type "application/xml; charset=utf-8";
}
```

## Complete Configuration Template

```nginx
# /etc/nginx/conf.d/static.conf

server {
    listen 80;
    server_name _;

    root /usr/share/nginx/html;
    index index.html index.htm;

    # Character encoding
    charset utf-8;

    # Logging
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log warn;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml
        application/json
        application/rss+xml
        image/svg+xml;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Health check
    location /healthz {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }

    # Deny hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Static assets with caching
    location ~* \.(css|js)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(ico|gif|jpe?g|png|webp|svg|avif)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    location ~* \.(woff2?|ttf|eot|otf)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Access-Control-Allow-Origin "*";
        access_log off;
    }

    # HTML files
    location ~* \.html$ {
        expires 1h;
        add_header Cache-Control "public, must-revalidate";
    }

    # RSS/Sitemap
    location ~* \.(xml|rss)$ {
        expires 1h;
        add_header Content-Type "application/xml; charset=utf-8";
    }

    # Error pages
    error_page 404 /404.html;
    error_page 500 502 503 504 /50x.html;

    # Main location
    location / {
        try_files $uri $uri/ $uri/index.html $uri.html /index.html;
    }
}
```

## Docker Integration

### Dockerfile

```dockerfile
FROM nginx:alpine

# Remove default config
RUN rm /etc/nginx/conf.d/default.conf

# Copy custom config
COPY nginx.conf /etc/nginx/conf.d/static.conf

# Copy error pages
COPY 404.html /usr/share/nginx/html/404.html
COPY 50x.html /usr/share/nginx/html/50x.html

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget -q --spider http://localhost/healthz || exit 1

EXPOSE 80
```

### Docker Compose Service

```yaml
static-web:
  image: nginx:alpine
  restart: always
  volumes:
    - static_bridge:/usr/share/nginx/html:ro
    - ./nginx/static.conf:/etc/nginx/conf.d/default.conf:ro
  healthcheck:
    test: ["CMD", "wget", "-q", "--spider", "http://localhost/healthz"]
    interval: 30s
    timeout: 10s
    retries: 3
```

## Monitoring

### Access Log Format

```nginx
log_format static '$remote_addr - $remote_user [$time_local] '
                  '"$request" $status $body_bytes_sent '
                  '"$http_referer" "$http_user_agent" '
                  'rt=$request_time';
```

### Metrics Endpoint

```nginx
# Nginx status (internal only)
location /nginx_status {
    stub_status on;
    allow 127.0.0.1;
    allow 10.0.0.0/8;
    allow 172.16.0.0/12;
    deny all;
}
```
