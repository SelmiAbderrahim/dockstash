# Docker Best Practices Guide

## Overview

This guide provides comprehensive best practices for Docker-based development, specifically tailored for the iReadYouTube project's **DOCKER-ONLY development policy**.

## 🚨 Core Principles

### 1. DOCKER-ONLY Development (MANDATORY)

**ABSOLUTE RULE**: All development operations MUST be performed through Docker containers. Never run commands directly on the host machine.

```bash
# ✅ CORRECT: Docker-only operations
make install                    # Install dependencies in container
make test                       # Run tests in container
make shell                      # Access container shell
make client                     # Access client container

# ❌ FORBIDDEN: Host machine operations
cd client && npm install        # WRONG - Affects host environment
npm run dev                     # WRONG - Runs outside container
npx convex dev                  # WRONG - Host machine execution
```

### 2. Single .env File Policy

**CRITICAL REQUIREMENT**: Use only ONE `.env` file for ALL environments (development, staging, production).

```bash
# ✅ CORRECT: Single environment file
.env                            # Single source of truth for all environments

# ❌ FORBIDDEN: Multiple environment files
.env.development                # WRONG - Multiple files create confusion
.env.staging                   # WRONG - Breaks single-source principle
.env.production                # WRONG - Adds unnecessary complexity
.env.example                   # WRONG - Not used in this project
```

### 3. Makefile-First Approach

**PRIMARY RULE**: Always use Makefile commands for Docker operations. These provide proper orchestration and error handling.

```bash
# ✅ CORRECT: Makefile commands
make start                      # Proper service orchestration
make stop                       # Graceful service shutdown
make restart                    # Complete service restart
make logs                       # Centralized log management
make healthcheck                # Comprehensive health monitoring

# ❌ FORBIDDEN: Direct Docker commands
docker-compose up -d            # WRONG - Bypasses orchestration
docker-compose down             # WRONG - Missing graceful shutdown
docker logs <container>         # WRONG - Incomplete log view
```

## 🚫 Forbidden Operations (NEVER DO)

### Docker Prune Commands (DANGEROUS)

These commands affect ALL Docker resources on the system, not just the project:

```bash
# ❌ ABSOLUTELY FORBIDDEN - System-wide impact
docker system prune             # WRONG - Affects all projects
docker system prune -a          # WRONG - Removes ALL unused resources
docker system prune --volumes   # WRONG - CAUSES PERMANENT DATA LOSS
docker volume prune             # WRONG - Removes ALL unused volumes
docker image prune              # WRONG - Removes ALL unused images
docker network prune            # WRONG - Removes ALL unused networks
docker container prune          # WRONG - Removes ALL stopped containers
```

**Alternative**: Use project-specific cleanup commands:

```bash
# ✅ CORRECT: Project-specific cleanup
make clean                      # Removes only project resources
make docker-down                # Stops only project containers
make stop                       # Graceful project shutdown
```

### Host Machine Package Management

Never manage Node.js packages outside containers:

```bash
# ❌ FORBIDDEN: Host machine package management
cd client && npm install        # WRONG - Installs on host
npm install --global            # WRONG - Global host installation
npm cache clean                 # WRONG - Host cache management
```

**Alternative**: Use container-based package management:

```bash
# ✅ CORRECT: Container package management
make install                    # Install in client container
make client                     # Access container for manual commands
docker-compose exec client npm install <package>  # Specific package install
```

## ✅ Essential Best Practices

### 1. Service Orchestration

Use Docker Compose for multi-service applications with proper dependency management:

```yaml
# docker-compose.yml best practices
services:
  # Services with proper dependency order
  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]

  convex-backend:
    depends_on:
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3210/mutation"]

  client:
    depends_on:
      - convex-backend
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5173"]
```

### 2. Health Check Implementation

All services MUST have comprehensive health checks:

```yaml
# Health check patterns for different services
healthcheck:
  test: ["CMD", "sh", "-c", "curl -f http://localhost:PORT || exit 1"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 30s
```

### 3. Volume Management

Use named volumes for persistent data:

```yaml
# Persistent volume configuration
volumes:
  redis_data:
    driver: local
  convex_backend_data:
    driver: local
  convex_uploads:
    driver: local
```

### 4. Network Isolation

Use dedicated Docker networks:

```yaml
# Network configuration for isolation
networks:
  ireadyoutube-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## 🔧 Development Workflow

### 1. Initial Setup

```bash
# First-time development setup
make dev-setup                  # Complete environment setup
make admin-key                  # Generate Convex admin key

# Add service API keys
echo "ASSEMBLYAI_API_KEY=your_key" >> .env
echo "YOUTUBE_API_KEY=your_key" >> .env

# Start development environment
make start
```

### 2. Daily Development

```bash
# Start development day
make start                      # Start all services
make healthcheck                # Verify service health

# Development work
make install                    # Install new dependencies
make test                       # Run tests
make logs                       # Monitor logs

# Shell access for debugging
make shell                      # Convex backend shell
make client                     # Client container shell
```

### 3. Environment Variable Management

```bash
# Adding new configuration
echo "# New Service Configuration" >> .env
echo "NEW_API_KEY=your_key_here" >> .env

# Restart to apply changes
make restart

# Validate configuration
make healthcheck
```

### 4. Service Debugging

```bash
# Service troubleshooting
make healthcheck                # Check service health
make logs                       # View all logs
make logs SERVICE=client        # View specific service logs

# Direct container access
make shell                      # Backend debugging shell
make client                     # Frontend debugging shell
```

## 🔒 Security Best Practices

### 1. API Key Management

```bash
# Secure API key handling
echo "ASSEMBLYAI_API_KEY=your_key" >> .env  # Add to .env only
make restart                                # Restart to apply
make admin-key                             # Rotate keys regularly

# NEVER commit API keys to version control
# .env file should be in .gitignore
```

### 2. Network Security

```yaml
# Network security configuration
services:
  client:
    # No ports exposed to host unless necessary
    ports:
      - "5173:5173"  # Expose only required ports

  convex-backend:
    # Internal service - no port exposure needed for production
    ports:
      - "3210:3210"  # API port
      - "6791:6791"  # Dashboard port
```

### 3. Container Security

```yaml
# Security-focused container configuration
services:
  client:
    user: "1000:1000"           # Run as non-root user
    read_only: true             # Read-only filesystem where possible
    tmpfs:
      - /tmp                    # Temporary filesystem for temp files
```

## 📊 Performance Optimization

### 1. Resource Management

```yaml
# Resource limits for containers
services:
  client:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'
```

### 2. Development Optimization

```yaml
# Development-specific optimizations
services:
  client:
    volumes:
      - ../client:/app           # Source code mounting
      - /app/node_modules        # Separate node_modules volume
    environment:
      - NODE_ENV=development
      - CHOKIDAR_USEPOLLING=true # Enable file watching
```

### 3. Production Optimization

```yaml
# Production-specific optimizations
services:
  client:
    build:
      context: ../client
      target: production         # Multi-stage build
    environment:
      - NODE_ENV=production
    restart: always
```

## 🗃️ Data Management

### 1. Backup Strategy

```bash
# Regular backup operations
make backup                     # Create full backup
ls backups/                     # List available backups

# Automated backup script
0 2 * * * cd /project && make backup  # Daily 2 AM backups
```

### 2. Volume Management

```bash
# Volume inspection (emergency only)
docker volume ls
docker volume inspect ireadyoutube_convex_backend_data

# NEVER modify volumes directly
# Always use backup/restore procedures
```

### 3. Data Recovery

```bash
# Disaster recovery procedure
make restore BACKUP_FILE=backups/convex-backup-20241112_143022.tar.gz

# Verify restoration
make healthcheck
make status
```

## 🚀 Production Deployment

### 1. Environment Configuration

```bash
# Production environment setup
make prod-setup                 # Configure production settings

# Production-specific variables
echo "NODE_ENV=production" >> .env
echo "CONVEX_SITE_URL=https://your-domain.com" >> .env
```

### 2. Deployment Process

```bash
# Production deployment pipeline
make backup                     # Backup current data
make prod-deploy                # Deploy to production
make healthcheck                # Verify deployment health
make logs                       # Monitor for issues
```

### 3. Load Balancing

```yaml
# Production scaling with Nginx
services:
  nginx:
    profiles:
      - production
    depends_on:
      - client
      - convex-backend

  client:
    deploy:
      replicas: 3              # Multiple instances
```

## 🔍 Monitoring and Debugging

### 1. Service Health Monitoring

```bash
# Comprehensive health monitoring
make healthcheck                # Basic health check

# Advanced monitoring script
./scripts/docker-health-monitor.sh --verbose --json
```

### 2. Log Management

```bash
# Log aggregation and analysis
make logs                       # All services
make logs SERVICE=client        # Specific service
docker-compose logs --tail=100  # Recent logs
```

### 3. Performance Monitoring

```bash
# Resource usage monitoring
docker stats                    # Real-time resource usage
docker stats --no-stream        # Current resource usage

# Service-specific monitoring
docker-compose exec client npm run analyze  # Bundle analysis
```

## 🧪 Testing in Docker

### 1. Unit Testing

```bash
# Run tests in container
make test                       # All tests
make test-file path=src/components/Button.test.tsx  # Specific test
```

### 2. Integration Testing

```bash
# Integration testing with containers
docker-compose -f docker-compose.test.yml up --abort-on-container-exit
docker-compose -f docker-compose.test.yml down --volumes
```

### 3. E2E Testing

```bash
# End-to-end testing in containers
docker-compose exec client npm run test:e2e
docker-compose exec client npm run test:visual
```

## 📋 Troubleshooting Guide

### Common Issues and Solutions

#### 1. Port Conflicts

```bash
# Problem: Services fail to start with port conflicts
make stop                       # Stop all services
lsof -i :5173                   # Check what's using port
make start                      # Restart services
```

#### 2. Volume Permission Issues

```bash
# Problem: Container can't write to volumes
make stop                       # Stop services
sudo chown -R $USER:$USER docker/volumes  # Fix permissions
make start                      # Restart services
```

#### 3. Health Check Failures

```bash
# Problem: Services showing as unhealthy
make logs SERVICE=client        # Check service logs
make client                     # Access container for debugging
docker-compose exec client curl http://localhost:5173  # Test connectivity
```

#### 4. Environment Variable Issues

```bash
# Problem: Configuration not loading
make validate-env               # Validate environment
cat .env                        # Check environment file
make restart                    # Restart to apply changes
```

## 🎯 Advanced Patterns

### 1. Multi-Stage Builds

```dockerfile
# Multi-stage build optimization
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
EXPOSE 5173
CMD ["npm", "start"]
```

### 2. Service Mesh Patterns

```yaml
# Advanced service orchestration
services:
  client:
    networks:
      - frontend
      - backend

  convex-backend:
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true
```

### 3. Zero-Downtime Deployment

```bash
# Blue-green deployment pattern
docker-compose -f docker-compose.blue.yml up -d
docker-compose -f docker-compose.green.yml down
```

## 📚 Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Docker Security Best Practices](https://docs.docker.com/engine/security/)
- [Docker Performance Tuning](https://docs.docker.com/config/containers/resource_constraints/)

---

**Remember**: These best practices are mandatory for the iReadYouTube project. Following them ensures consistent, secure, and efficient Docker-based development workflows.