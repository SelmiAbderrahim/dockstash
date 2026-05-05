# Production Deployment Guide

## Overview

Comprehensive production deployment guide for Docker-based applications in the iReadYouTube project. This guide covers production-specific configurations, security considerations, and deployment strategies.

## 🚀 Production Environment Setup

### 1. Production Environment Configuration

```bash
# Initialize production environment
make prod-setup

# This performs:
# - Sets NODE_ENV=production
# - Configures production restart policies
# - Optimizes volume mounts for production
# - Validates production configuration
```

### 2. Environment Variables for Production

```bash
# Production-specific environment configuration
echo "# Production Environment Settings" >> .env
echo "NODE_ENV=production" >> .env
echo "RESTART_POLICY=always" >> .env
echo "CONVEX_SITE_URL=https://your-domain.com" >> .env
echo "CLIENT_VOLUME_SOURCE=" >> .env  # Use built-in code, not development mounts
```

### 3. Production Configuration Template

```bash
# Generate production environment template
./scripts/environment-manager.sh generate production

# Review and update production-specific values:
# - Set production URLs and domains
# - Configure production API keys
# - Set appropriate security values
# - Configure production ports and networking
```

## 🔒 Production Security Configuration

### 1. SSL/TLS Configuration

```yaml
# docker-compose.yml production SSL setup
services:
  nginx:
    profiles:
      - production
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    environment:
      - SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
      - SSL_KEY_PATH=/etc/nginx/ssl/key.pem
```

### 2. Security Headers and Hardening

```nginx
# nginx/nginx.conf - Security configuration
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Hide server information
    server_tokens off;

    # Forward to application
    location / {
        proxy_pass http://client:5173;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 3. Container Security

```yaml
# Production security hardening
services:
  client:
    build:
      target: production
    user: "1000:1000"
    read_only: true
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    cap_add:
      - CHOWN
      - SETGID
      - SETUID
    tmpfs:
      - /tmp:noexec,nosuid,size=100m
```

## 🏗️ Production Build Process

### 1. Multi-Stage Dockerfile

```dockerfile
# client/Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

WORKDIR /app

# Copy production dependencies
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json

USER nodejs

EXPOSE 5173
CMD ["npm", "start"]
```

### 2. Optimized Docker Compose for Production

```yaml
# docker-compose.yml - Production optimizations
version: '3.8'

services:
  client:
    image: ${DOCKER_REGISTRY}/ireadyoutube-client:${VERSION:-latest}
    build:
      context: ../client
      dockerfile: Dockerfile
      target: production
    restart: always
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
      update_config:
        parallelism: 1
        delay: 10s
        failure_action: rollback
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3

  convex-backend:
    image: ${DOCKER_REGISTRY}/ireadyoutube-backend:${VERSION:-latest}
    build:
      context: ../client
      dockerfile: Dockerfile.backend
    restart: always
    deploy:
      replicas: 2
      resources:
        limits:
          memory: 1G
          cpus: '1.0'
        reservations:
          memory: 512M
          cpus: '0.5'

  nginx:
    image: nginx:alpine
    profiles:
      - production
    restart: always
    depends_on:
      - client
      - convex-backend
    deploy:
      replicas: 2
```

## 🚀 Deployment Strategies

### 1. Blue-Green Deployment

```bash
# Blue-Green deployment script
#!/bin/bash

# Current active environment (blue or green)
CURRENT_ENV=$(docker ps --format "{{.Names}}" | grep -E "(blue|green)" | head -1 | grep -oE "(blue|green)" || echo "blue")
NEW_ENV="green"

if [[ "$CURRENT_ENV" == "green" ]]; then
    NEW_ENV="blue"
fi

echo "Deploying to $NEW_ENV environment (current: $CURRENT_ENV)"

# Deploy to new environment
export COMPOSE_PROJECT_NAME="ireadyoutube-$NEW_ENV"
docker-compose --profile production up -d

# Health check new deployment
./scripts/docker-health-monitor.sh --verbose

# Switch traffic (using load balancer)
# This would be automated with your load balancer API
echo "Switching traffic to $NEW_ENV..."

# Keep old environment for rollback
# Clean up old environment after successful switch
echo "Deployment completed. Current environment: $NEW_ENV"
```

### 2. Rolling Updates

```bash
# Rolling update deployment
docker-compose --profile production up -d --no-deps client
docker-compose --profile production up -d --no-deps convex-backend

# Monitor rollout
watch -n 2 'docker-compose ps'
```

### 3. Canary Deployment

```yaml
# Canary deployment with traffic splitting
services:
  client:
    deploy:
      replicas: 4
      labels:
        - "traefik.docker.network=web"
        - "traefik.http.routers.client.rule=Host(`your-domain.com`)"
        - "traefik.http.services.client.loadbalancer.server.port=5173"

  client-canary:
    image: ${DOCKER_REGISTRY}/ireadyoutube-client:${CANARY_VERSION}
    deploy:
      replicas: 1
      labels:
        - "traefik.http.routers.client-canary.rule=Host(`your-domain.com`) && PathPrefix(`/canary`)"
        - "traefik.http.services.client-canary.loadbalancer.server.port=5173"
```

## 📊 Production Monitoring

### 1. Health Monitoring Setup

```bash
# Production health monitoring
#!/bin/bash

# Continuous health monitoring
while true; do
    ./scripts/docker-health-monitor.sh --json > /var/log/health-checks/$(date +%Y%m%d_%H%M%S).json

    # Alert on failures
    if [[ $? -ne 0 ]]; then
        echo "Health check failed at $(date)" | mail -s "Production Alert" admin@yourdomain.com
    fi

    sleep 300  # Check every 5 minutes
done
```

### 2. Log Aggregation

```yaml
# Centralized logging with ELK stack
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.5.0
    environment:
      - discovery.type=single-node
      - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
    volumes:
      - elasticsearch_data:/usr/share/elasticsearch/data

  logstash:
    image: docker.elastic.co/logstash/logstash:8.5.0
    volumes:
      - ./logstash/pipeline:/usr/share/logstash/pipeline:ro
    depends_on:
      - elasticsearch

  kibana:
    image: docker.elastic.co/kibana/kibana:8.5.0
    ports:
      - "5601:5601"
    depends_on:
      - elasticsearch
```

### 3. Metrics Collection

```yaml
# Prometheus and Grafana monitoring
services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards:ro
```

## 🔄 Production Deployment Pipeline

### 1. Automated Deployment Script

```bash
#!/bin/bash
# deploy-production.sh

set -euo pipefail

# Configuration
VERSION="${1:-latest}"
ENVIRONMENT="production"
BACKUP_REQUIRED=true
HEALTH_CHECK_TIMEOUT=300

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Pre-deployment checks
pre_deployment_checks() {
    log_info "Running pre-deployment checks..."

    # Validate environment
    ./scripts/environment-manager.sh validate

    # Check disk space
    if [[ $(df / | awk 'NR==2 {print $5}' | sed 's/%//') -gt 80 ]]; then
        log_error "Disk space usage > 80%, aborting deployment"
        exit 1
    fi

    # Check Docker daemon
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon not responding"
        exit 1
    fi

    log_info "Pre-deployment checks passed"
}

# Backup current deployment
backup_deployment() {
    if [[ "$BACKUP_REQUIRED" == "true" ]]; then
        log_info "Creating backup of current deployment..."
        ./scripts/backup-utility.sh backup
        log_info "Backup completed"
    fi
}

# Pull and build new images
deploy_new_images() {
    log_info "Deploying new images (version: $VERSION)..."

    # Build new images
    export VERSION="$VERSION"
    docker-compose --profile production build --no-cache

    # Deploy with rolling update
    docker-compose --profile production up -d --no-deps client
    docker-compose --profile production up -d --no-deps convex-backend

    log_info "New images deployed"
}

# Health check deployment
health_check_deployment() {
    log_info "Performing health checks (timeout: ${HEALTH_CHECK_TIMEOUT}s)..."

    local start_time=$(date +%s)
    local end_time=$((start_time + HEALTH_CHECK_TIMEOUT))

    while [[ $(date +%s) -lt $end_time ]]; do
        if ./scripts/docker-health-monitor.sh >/dev/null 2>&1; then
            log_info "Health checks passed"
            return 0
        fi

        log_warning "Health checks failed, retrying in 30 seconds..."
        sleep 30
    done

    log_error "Health checks failed after ${HEALTH_CHECK_TIMEOUT}s"
    return 1
}

# Rollback on failure
rollback_deployment() {
    log_error "Deployment failed, initiating rollback..."

    # Stop current deployment
    docker-compose --profile production down

    # Restore from backup (most recent)
    local latest_backup=$(ls -t backups/ | head -1)
    ./scripts/backup-utility.sh restore "backups/$latest_backup"

    log_error "Rollback completed"
    exit 1
}

# Post-deployment verification
post_deployment_verification() {
    log_info "Running post-deployment verification..."

    # Check service URLs
    local urls=(
        "https://your-domain.com"
        "https://your-domain.com/health"
    )

    for url in "${urls[@]}"; do
        if ! curl -f -s "$url" >/dev/null; then
            log_error "Failed to reach $url"
            return 1
        fi
    done

    log_info "Post-deployment verification passed"
}

# Main deployment process
main() {
    log_info "Starting production deployment (version: $VERSION)"

    pre_deployment_checks
    backup_deployment
    deploy_new_images

    if ! health_check_deployment; then
        rollback_deployment
    fi

    post_deployment_verification

    log_info "Production deployment completed successfully"

    # Send notification
    echo "Production deployment successful (version: $VERSION)" | \
        mail -s "Deployment Success" admin@yourdomain.com
}

# Execute main function
main "$@"
```

### 2. CI/CD Integration

```yaml
# .github/workflows/production-deploy.yml
name: Production Deployment

on:
  push:
    tags:
      - 'v*'

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v2

      - name: Login to Container Registry
        uses: docker/login-action@v2
        with:
          registry: ${{ secrets.DOCKER_REGISTRY }}
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push images
        run: |
          export VERSION=${GITHUB_REF#refs/tags/}
          docker-compose --profile production build
          docker-compose --profile production push

      - name: Deploy to production
        uses: appleboy/ssh-action@v0.1.5
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            cd /opt/ireadyoutube
            git pull origin main
            ./deploy-production.sh ${GITHUB_REF#refs/tags/}
```

## 🔧 Production Maintenance

### 1. Regular Maintenance Tasks

```bash
# Daily maintenance script
#!/bin/bash

# Health monitoring
./scripts/docker-health-monitor.sh --json > /var/log/health/$(date +%Y%m%d).json

# Log rotation
logrotate /etc/logrotate.d/ireadyoutube

# Backup verification
./scripts/backup-utility.sh verify $(ls -t backups/ | head -1)

# Security scans
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image --severity HIGH,CRITICAL ireadyoutube-client:latest
```

### 2. Scaling Operations

```bash
# Auto-scaling based on load
#!/bin/bash

# Monitor CPU usage
CPU_USAGE=$(docker stats --no-stream --format "table {{.CPUPerc}}" | tail -n +2 | sed 's/%//' | awk '{sum+=$1} END {print sum/NR}')

if (( $(echo "$CPU_USAGE > 70" | bc -l) )); then
    echo "High CPU usage detected ($CPU_USAGE%), scaling up..."
    docker-compose --profile production up -d --scale client=5
elif (( $(echo "$CPU_USAGE < 30" | bc -l) )); then
    echo "Low CPU usage detected ($CPU_USAGE%), scaling down..."
    docker-compose --profile production up -d --scale client=2
fi
```

### 3. Disaster Recovery Planning

```bash
# Disaster recovery procedures
# 1. Complete environment backup
make backup

# 2. Document recovery steps
echo "Disaster Recovery Steps:" > DISASTER_RECOVERY.md
echo "1. SSH into production server" >> DISASTER_RECOVERY.md
echo "2. cd /opt/ireadyoutube" >> DISASTER_RECOVERY.md
echo "3. make clean" >> DISASTER_RECOVERY.md
echo "4. make prod-setup" >> DISASTER_RECOVERY.md
echo "5. restore from latest backup" >> DISASTER_RECOVERY.md
echo "6. make prod-deploy" >> DISASTER_RECOVERY.md

# 3. Test recovery procedures regularly
# Schedule monthly disaster recovery tests
0 2 1 * * /opt/ireadyoutube/scripts/disaster-recovery-test.sh
```

## 📋 Production Checklist

### Pre-Deployment Checklist

- [ ] Environment variables configured for production
- [ ] SSL certificates installed and valid
- [ ] Security headers configured
- [ ] Container security hardening applied
- [ ] Resource limits set appropriately
- [ ] Backup strategy implemented
- [ ] Monitoring and alerting configured
- [ ] Log aggregation setup
- [ ] Performance testing completed
- [ ] Security scans passed

### Post-Deployment Verification

- [ ] All services healthy
- [ ] Application URLs accessible
- [ ] SSL certificates working
- [ ] Database connectivity verified
- [ ] External API integrations working
- [ ] Monitoring data flowing
- [ ] Log aggregation working
- [ ] Backup creation successful
- [ ] Performance within acceptable ranges
- [ ] Security scans passing

### Ongoing Maintenance

- [ ] Daily health checks
- [ ] Weekly backup verification
- [ ] Monthly security scans
- [ ] Quarterly disaster recovery tests
- [ ] Regular dependency updates
- [ ] Performance monitoring
- [ ] Capacity planning
- [ ] Security patch management

---

This production deployment guide ensures secure, reliable, and maintainable deployments for Docker-based applications in production environments.