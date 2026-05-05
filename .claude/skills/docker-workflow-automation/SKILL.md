---
name: docker-workflow-automation
description: Comprehensive Docker workflow automation skill that enforces DOCKER-ONLY development patterns for iReadYouTube project. Provides complete service orchestration, environment management, and production deployment while strictly forbidding host machine commands and Docker prune operations. Use when managing Docker-based development environments, orchestrating container services, or implementing production-ready container workflows.
license: MIT
metadata:
  version: "1.0"
  author: "Docker Workflow Specialist"
  category: "infrastructure"
  project: "iReadYouTube"
  environment: "docker-only"
---

# Docker Workflow Automation

## Overview

**Comprehensive Docker workflow automation** for iReadYouTube project that enforces strict **DOCKER-ONLY development patterns** with complete service orchestration, environment management, and production deployment capabilities.

**Keywords**: docker automation, container orchestration, service management, environment variables, production deployment, health monitoring, backup restore, docker compose, self-hosted convex

**🚨 CRITICAL POLICY**: This skill enforces ABSOLUTE **DOCKER-ONLY DEVELOPMENT** - **NEVER** run commands directly on host machine. All operations must be performed through Docker containers using the provided Makefile commands.

## When to Use This Skill

- **Service Orchestration**: Managing multi-container applications with Docker Compose
- **Development Environment**: Setting up and maintaining Docker-only development workflows
- **Environment Management**: Managing single .env file policy and variable preservation
- **Production Deployment**: Deploying containerized applications to production
- **Health Monitoring**: Monitoring container health and debugging service issues
- **Backup & Recovery**: Implementing data backup and disaster recovery strategies
- **Performance Optimization**: Optimizing Docker workflows for development and production

## 🚨 ABSOLUTE FORBIDDEN PATTERNS

**NEVER** use these commands - they violate the Docker-only policy:

### Host Machine Commands (FORBIDDEN)
```bash
# ❌ ABSOLUTELY FORBIDDEN - Host machine npm commands
cd client && npm install           # WRONG - Use 'make install' instead
cd client && npm run dev          # WRONG - Use 'make start' instead
cd client && npm test             # WRONG - Use 'make test' instead
npx convex dev                    # WRONG - Use 'make convex CMD="npx convex dev"' instead
```

### Docker Prune Commands (FORBIDDEN)
```bash
# ❌ ABSOLUTELY FORBIDDEN - Affects all system Docker resources
docker system prune               # WRONG - Removes all unused containers/networks/images
docker volume prune               # WRONG - Removes all unused volumes (PERMANENT DATA LOSS)
docker image prune                # WRONG - Removes all unused images
docker network prune              # WRONG - Removes all unused networks
docker container prune            # WRONG - Removes all stopped containers
docker system prune -a            # WRONG - Removes ALL unused Docker resources
docker system prune --volumes     # WRONG - DANGEROUS - Causes permanent data loss
```

### Individual Docker Commands (FORBIDDEN)
```bash
# ❌ FORBIDDEN - Use Makefile commands instead
docker logs <container>           # WRONG - Use 'make logs' instead
docker exec -it <container> bash  # WRONG - Use 'make shell' or 'make client' instead
docker-compose up -d              # WRONG - Use 'make start' instead
docker-compose down               # WRONG - Use 'make stop' instead
```

## ✅ CORRECT DOCKER-ONLY PATTERNS

### Service Management (CORRECT)
```bash
# ✅ CORRECT - Use Makefile commands for all operations
make start                        # Starts all services with proper orchestration
make stop                         # Stops all services gracefully
make restart                      # Restarts all services
make status                       # Shows comprehensive service status
make logs                         # Shows logs from all services
make healthcheck                  # Checks health of all services
```

### Environment Management (CORRECT)
```bash
# ✅ CORRECT - Single .env file policy
echo "NEW_API_KEY=your_key" >> .env    # Add variables directly to .env
make restart                            # Restart services to pick up new variables
make admin-key                          # Generate new Convex admin key
make change-admin-key                   # Generate new key and restart automatically
```

### Shell Access (CORRECT)
```bash
# ✅ CORRECT - Use designated shell access commands
make shell                        # Open shell in Convex backend container
make client                       # Open shell in client container
make convex CMD="npx convex dev"  # Run Convex CLI commands in backend container
```

## Process / Workflow

### Phase 1: Environment Setup and Validation

#### Step 1.1: Initial Development Environment Setup

```bash
# Complete development environment setup (FIRST TIME ONLY)
make dev-setup

# This performs:
# - Environment file validation
# - .env file creation from template if needed
# - Configuration validation
# - Setup instructions with next steps
```

#### Step 1.2: Environment Variable Management

**CRITICAL RULE**: This project uses **single .env file** for all environments. Never create multiple environment files.

```bash
# ✅ CORRECT: Add variables directly to .env
echo "# New Service Configuration" >> .env
echo "NEW_SERVICE_API_KEY=your_key_here" >> .env
echo "NEW_SERVICE_URL=https://api.service.com" >> .env

# ✅ CORRECT: Preserve existing API keys when adding new variables
# NEVER delete existing API keys or secrets from .env file

# Restart services to pick up new variables
make restart
```

#### Step 1.3: Convex Admin Key Management

```bash
# Generate new admin key
make admin-key

# Generate new key and restart services automatically
make change-admin-key

# This will:
# - Generate cryptographically secure admin key
# - Create backup of current .env file
# - Update .env with new admin key
# - Restart all services with new key
# - Provide new admin key for dashboard access
```

### Phase 2: Service Orchestration and Management

#### Step 2.1: Service Lifecycle Management

```bash
# Start all services with health monitoring
make start

# This starts:
# - Redis: Caching and session storage (port 6379)
# - Convex Backend: Self-hosted database and functions (port 3210)
# - Convex Dashboard: Management interface (port 6791)
# - Client: React development server (port 5173)
# - Nginx: Reverse proxy (production profile, port 80)

# Stop all services gracefully
make stop

# Restart all services
make restart

# Check comprehensive service status
make status
```

#### Step 2.2: Service Health Monitoring

```bash
# Comprehensive health check
make healthcheck

# Real-time log monitoring
make logs                           # All services
make logs SERVICE=client            # Specific service

# Service status with URLs
make status

# This provides:
# - Container health status
# - Service URL information
# - Port mappings
# - Network connectivity
```

#### Step 2.3: Development Workflow Integration

```bash
# Install new dependencies (DOCKER ONLY)
make install                       # Installs in client container

# Quick development restart
make dev-restart                   # Restarts only client container

# Run tests (DOCKER ONLY)
make test                          # All tests
make test-file path=src/components/Button.test.tsx  # Specific test

# Access development shells
make shell                         # Convex backend shell
make client                        # Client container shell
```

### Phase 3: Production Deployment

#### Step 3.1: Production Environment Setup

```bash
# Configure production environment
make prod-setup

# This performs:
# - Sets NODE_ENV=production
# - Configures production restart policies
# - Optimizes volume mounts for production
# - Validates production configuration

# Deploy to production
make prod-deploy

# This includes:
# - Environment validation (NODE_ENV must be production)
# - Full container rebuild
# - Production service startup
# - Health check validation
```

#### Step 3.2: Production Service Management

```bash
# Production deployment with validation
make prod-deploy

# Monitor production services
make logs
make status
make healthcheck

# Production backup strategies
make backup
```

### Phase 4: Data Management and Backup

#### Step 4.1: Backup Operations

```bash
# Create Convex data backup
make backup

# This creates timestamped backups in:
# - backups/convex-backup-YYYYMMDD_HHMMSS.tar.gz
# - Includes all Convex database data
# - Preserves uploaded files and configurations
```

#### Step 4.2: Restore Operations

```bash
# Restore from backup
make restore BACKUP_FILE=backups/convex-backup-20241112_143022.tar.gz

# This performs:
# - Safety confirmation prompt
# - Graceful service shutdown
# - Data restoration from backup
# - Service restart with restored data
# - Health check validation
```

#### Step 4.3: Data Persistence Strategy

```bash
# Volume management for persistent data:
# - redis_data: Redis cache and session data
# - convex_backend_data: Convex database and functions
# - convex_uploads: User uploaded files and media

# Automatic volume backup
make backup

# Manual volume inspection (emergency only)
docker volume inspect ireadyoutube_convex_backend_data
```

### Phase 5: Advanced Orchestration Patterns

#### Step 5.1: Multi-Environment Management

```bash
# Development environment (default)
export NODE_ENV=development
make start

# Production environment
export NODE_ENV=production
make prod-deploy

# Environment-specific configurations are handled by:
# - Single .env file with NODE_ENV variable
# - Docker Compose environment variable interpolation
# - Makefile environment detection
```

#### Step 5.2: Service Scaling and Load Balancing

```bash
# Scale individual services (advanced usage)
docker-compose -f docker/docker-compose.yml --env-file .env up -d --scale client=3

# Production scaling with Nginx load balancer
docker-compose -f docker/docker-compose.yml --env-file .env --profile production up -d
```

#### Step 5.3: Network and Port Management

```bash
# Service URL mappings:
# - Client Application: http://localhost:5173
# - Convex Dashboard: http://localhost:6791
# - Convex API: http://localhost:3210
# - Redis: localhost:6379
# - Nginx (production): http://localhost:80

# Network configuration
# Docker network: ireadyoutube-network (172.20.0.0/16)
# All services communicate through internal Docker network
```

## Guidelines

### 🔒 Docker-Only Development Policy (MANDATORY)

- **ABSOLUTE RULE**: NEVER run commands directly on host machine
- **Use Makefile Commands**: All operations must use provided Makefile targets
- **Container Isolation**: Maintain complete separation between host and containers
- **Environment Consistency**: All environments (dev, staging, prod) use containers

### 🚫 Forbidden Operations (NEVER DO)

- **No Host npm Commands**: Never use `cd client && npm *` commands
- **No Docker Prune**: Never use `docker system prune`, `docker volume prune`, etc.
- **No Individual Docker Commands**: Avoid direct `docker-compose` commands
- **No Multiple .env Files**: Use only single `.env` file for all environments

### ✅ Required Operations (ALWAYS DO)

- **Makefile First**: Always use Makefile commands for Docker operations
- **Environment Preservation**: Never delete existing API keys when adding new variables
- **Health Monitoring**: Always verify service health after operations
- **Backup Before Major Changes**: Create backups before production deployments

### 📊 Service Monitoring Standards

- **Health Checks**: All containers have comprehensive health checks
- **Log Aggregation**: Centralized logging through `make logs`
- **Performance Monitoring**: Regular health check validation
- **Error Tracking**: Systematic error log analysis

### 🔐 Security Patterns

- **API Key Management**: Secure storage in .env file only
- **Network Isolation**: Docker network segmentation
- **Volume Security**: Proper volume permissions and backup
- **Secret Rotation**: Regular admin key rotation

## Examples

### Example 1: Complete Development Setup

```bash
# First-time development environment setup
make dev-setup

# Generate admin key
make admin-key

# Add service API keys
echo "# AssemblyAI Configuration" >> .env
echo "ASSEMBLYAI_API_KEY=your_assemblyai_key" >> .env
echo "ASSEMBLYAI_WEBHOOK_SECRET=your_webhook_secret" >> .env

# Add YouTube API key
echo "# YouTube API Configuration" >> .env
echo "YOUTUBE_API_KEY=your_youtube_key" >> .env

# Start development services
make start

# Verify everything is working
make healthcheck
make logs
```

### Example 2: Production Deployment

```bash
# Setup production environment
make prod-setup

# Configure production settings
echo "# Production Configuration" >> .env
echo "NODE_ENV=production" >> .env
echo "CONVEX_SITE_URL=https://your-domain.com" >> .env

# Create backup before deployment
make backup

# Deploy to production
make prod-deploy

# Monitor production deployment
make status
make logs
make healthcheck
```

### Example 3: Environment Variable Management

```bash
# ✅ CORRECT: Adding new service configuration
echo "# Resend Email Service" >> .env
echo "RESEND_API_KEY=re_your_api_key" >> .env
echo "RESEND_FROM_EMAIL=noreply@yourdomain.com" >> .env
echo "RESEND_FROM_NAME=iReadYouTube" >> .env

# ✅ CORRECT: Adding database configuration
echo "# Database Configuration" >> .env
echo "JWT_SECRET=your_jwt_secret_here" >> .env
echo "SESSION_SECRET=your_session_secret_here" >> .env
echo "ENCRYPTION_KEY=your_encryption_key_here" >> .env

# ✅ CORRECT: Restart services to apply changes
make restart

# ✅ CORRECT: Verify configuration
make healthcheck
```

### Example 4: Service Debugging and Troubleshooting

```bash
# Check overall service health
make healthcheck

# View service logs for debugging
make logs SERVICE=client
make logs SERVICE=convex-backend

# Access shells for debugging
make shell      # Convex backend shell for database operations
make client     # Client shell for frontend debugging

# Restart specific services
make dev-restart  # Quick client restart during development

# Full restart for major issues
make restart
```

### Example 5: Backup and Disaster Recovery

```bash
# Create regular backup schedule
make backup

# Output: ✅ Backup created in backups/ directory
# File: backups/convex-backup-20241112_143022.tar.gz

# Restore from backup (disaster recovery)
make restore BACKUP_FILE=backups/convex-backup-20241112_143022.tar.gz

# This prompts:
# ⚠️  This will replace all current data. Are you sure? [y/N]
# Type 'y' to confirm restoration

# Verify restoration
make healthcheck
make status
```

### Example 6: Advanced Service Orchestration

```bash
# Custom service startup with specific configuration
export NODE_ENV=development
export CONVEX_API_HOST_PORT=3210
export CLIENT_HOST_PORT=5173
export CONVEX_DASHBOARD_HOST_PORT=6791

make start

# Production deployment with Nginx reverse proxy
docker-compose -f docker/docker-compose.yml --env-file .env --profile production up -d

# Scale client services for load testing
docker-compose -f docker/docker-compose.yml --env-file .env up -d --scale client=3

# Monitor scaled services
docker-compose -f docker/docker-compose.yml --env-file .env ps
```

## Reference Files

- [📋 Docker Best Practices Guide](./references/docker-best-practices.md) - Comprehensive Docker development patterns
- [🔧 Service Orchestration Scripts](./scripts/) - Automated Docker management scripts
- [📊 Configuration Templates](./assets/) - Docker compose and environment templates
- [🚀 Production Deployment Guide](./references/production-deployment.md) - Production deployment patterns
- [🔍 Troubleshooting Guide](./references/troubleshooting.md) - Common issues and solutions
- [💾 Backup & Recovery Guide](./references/backup-recovery.md) - Data protection strategies

## Troubleshooting

**Problem**: Services fail to start with port conflicts
**Solution**:
1. Check for port conflicts with `make status`
2. Stop existing services with `make stop`
3. Verify no other applications using ports 5173, 6791, 3210
4. Restart with `make start`

**Problem**: Convex admin key invalid or expired
**Solution**:
1. Generate new admin key with `make change-admin-key`
2. This automatically restarts services with new key
3. Access dashboard at http://localhost:6791 with new key

**Problem**: Container health checks failing
**Solution**:
1. Check logs with `make logs SERVICE=<service-name>`
2. Access container shell for debugging:
   - `make shell` for Convex backend
   - `make client` for client container
3. Verify environment variables with `make status`
4. Restart services with `make restart`

**Problem**: Data loss or corruption
**Solution**:
1. Stop services immediately with `make stop`
2. Restore from most recent backup: `make restore BACKUP_FILE=backups/convex-backup-YYYYMMDD_HHMMSS.tar.gz`
3. Verify restoration with `make healthcheck`
4. Implement regular backup schedule: `make backup`

**Problem**: Environment variables not loading
**Solution**:
1. Verify .env file exists and is properly formatted
2. Check for syntax errors in .env file
3. Ensure no spaces around equals signs
4. Restart services after changes: `make restart`
5. Validate with `make status`

**Problem**: Docker volume permissions issues
**Solution**:
1. Stop all services: `make stop`
2. Check volume permissions: `docker volume ls`
3. Remove and recreate volumes if necessary (CAUTION - data loss)
4. Restart with `make start`

**Problem**: Network connectivity between containers
**Solution**:
1. Verify Docker network exists: `docker network ls`
2. Check network configuration in docker-compose.yml
3. Restart services to recreate network: `make restart`
4. Validate with `make healthcheck`

**Problem**: Memory or resource constraints
**Solution**:
1. Check container resource usage: `docker stats`
2. Stop unnecessary services: `make stop`
3. Increase Docker memory allocation in Docker Desktop
4. Restart services: `make start`

**Problem**: AssemblyAI or external service integration failing
**Solution**:
1. Verify API keys in .env file are correct
2. Check network connectivity from containers
3. Test API endpoints from container shell:
   ```bash
   make shell
   curl -X POST https://api.assemblyai.com/v2/transcript -H "Authorization: YOUR_API_KEY"
   ```
4. Check service logs: `make logs SERVICE=convex-backend`