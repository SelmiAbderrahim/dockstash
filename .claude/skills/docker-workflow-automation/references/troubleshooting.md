# Docker Troubleshooting Guide

## Overview

Comprehensive troubleshooting guide for Docker-based development in the iReadYouTube project. This guide addresses common issues, debugging strategies, and recovery procedures.

## 🔧 Quick Diagnostic Commands

### Initial Health Check

```bash
# Primary diagnostic commands
make healthcheck                # Comprehensive service health check
make status                     # Service status with URLs
make logs                       # View all service logs

# Advanced diagnostics
./scripts/docker-health-monitor.sh --verbose
./scripts/service-orchestrator.sh status
```

### Service-Specific Diagnostics

```bash
# Individual service status
docker-compose ps               # Container status overview
docker-compose ps client        # Specific service status
docker stats                    # Resource usage by container
```

## 🚨 Common Issues and Solutions

### 1. Services Won't Start

#### Problem: Port Conflicts

**Symptoms:**
```
Error: port is already allocated
bind: address already in use
```

**Diagnosis:**
```bash
# Check what's using the ports
lsof -i :5173                   # Check client port
lsof -i :6791                   # Check dashboard port
lsof -i :3210                   # Check API port

# Check Docker port usage
docker ps --format "table {{.Names}}\t{{.Ports}}"
```

**Solutions:**
```bash
# Option 1: Stop conflicting services
make stop                       # Stop project services
make start                      # Restart project services

# Option 2: Change port configuration
echo "CLIENT_HOST_PORT=5174" >> .env
make restart

# Option 3: Kill processes using ports (last resort)
sudo kill -9 $(lsof -ti:5173)   # Force kill process
```

#### Problem: Docker Daemon Issues

**Symptoms:**
```
Cannot connect to the Docker daemon
docker: command not found
permission denied while trying to connect to Docker daemon
```

**Diagnosis:**
```bash
# Check Docker daemon status
docker version                   # Check Docker installation
docker info                      # Docker system information
sudo systemctl status docker     # Docker service status
```

**Solutions:**
```bash
# Start Docker daemon
sudo systemctl start docker
sudo systemctl enable docker     # Enable on boot

# Add user to docker group (for non-sudo usage)
sudo usermod -aG docker $USER
newgrp docker                    # Refresh group membership
```

#### Problem: Environment File Issues

**Symptoms:**
```
.env file not found
Invalid environment variable
Service exits immediately
```

**Diagnosis:**
```bash
# Check environment file
ls -la .env                     # File existence and permissions
cat .env | head -10             # Check file format
./scripts/environment-manager.sh validate  # Validate configuration
```

**Solutions:**
```bash
# Create or restore environment file
make dev-setup                  # Recreate from template
./scripts/environment-manager.sh generate development  # Generate new template

# Fix syntax issues
# Remove spaces around equals signs
sed -i 's/ *= */=/' .env
```

### 2. Services Unhealthy

#### Problem: Health Check Failures

**Symptoms:**
```
container unhealthy
health check failed
service not responding
```

**Diagnosis:**
```bash
# Detailed health check information
docker inspect <container> | grep -A 10 "Health"

# Manual health check from container
make shell                      # Access backend container
curl -f http://localhost:3210/mutation  # Test API health

# Check service logs for errors
make logs SERVICE=client
make logs SERVICE=convex-backend
```

**Solutions:**
```bash
# Restart specific service
docker-compose restart client
docker-compose restart convex-backend

# Full restart if necessary
make restart

# Check and fix configuration issues
./scripts/environment-manager.sh validate
```

#### Problem: Resource Constraints

**Symptoms:**
```
container killed
out of memory
CPU throttling
slow performance
```

**Diagnosis:**
```bash
# Check resource usage
docker stats                    # Real-time resource usage
docker stats --no-stream        # Current usage snapshot
free -h                        # System memory
df -h                          # Disk space

# Check container limits
docker inspect <container> | grep -A 5 "Resources"
```

**Solutions:**
```bash
# Free up system resources
make stop                       # Stop containers
docker system prune --volumes   # ⚠️ ONLY if safe (affects all projects)

# Increase Docker memory allocation
# Docker Desktop: Settings > Resources > Memory

# Scale down resource requirements
# Edit docker-compose.yml to reduce limits
```

### 3. Data and Volume Issues

#### Problem: Volume Permission Errors

**Symptoms:**
```
permission denied
read-only file system
cannot create directory
```

**Diagnosis:**
```bash
# Check volume permissions
docker volume ls
docker volume inspect ireadyoutube_convex_backend_data

# Check container permissions
make client                     # Access client container
ls -la /app                     # Check file permissions
```

**Solutions:**
```bash
# Fix volume permissions
sudo chown -R $USER:$USER /var/lib/docker/volumes  # ⚠️ SYSTEM-WIDE

# Recreate volumes (data loss warning)
make stop                       # Stop services
docker-compose down -v          # Remove volumes
make start                      # Recreate with correct permissions

# Restore from backup if data loss occurred
make restore BACKUP_FILE=...
```

#### Problem: Data Corruption

**Symptoms:**
```
database errors
corrupted data
missing files
```

**Diagnosis:**
```bash
# Check volume integrity
docker run --rm -v ireadyoutube_convex_backend_data:/data alpine ls -la /data

# Check application logs for corruption errors
make logs SERVICE=convex-backend | grep -i error
```

**Solutions:**
```bash
# Restore from backup
make restore BACKUP_FILE=backups/convex-backup-YYYYMMDD_HHMMSS.tar.gz

# If no backup available, recreate clean environment
make clean                      # Clean all resources
make dev-setup                  # Fresh setup
```

### 4. Network Issues

#### Problem: Container Communication

**Symptoms:**
```
connection refused
name resolution failed
network unreachable
```

**Diagnosis:**
```bash
# Check network configuration
docker network ls
docker network inspect ireadyoutube-network

# Test container connectivity
make shell                      # Access backend container
ping client                     # Test network connectivity
nslookup client                # Test DNS resolution
```

**Solutions:**
```bash
# Recreate network
make stop                       # Stop services
docker network prune            # ⚠️ Affects all networks
make start                      # Recreate services

# Check service dependencies in docker-compose.yml
# Ensure depends_on is correctly configured
```

#### Problem: External Service Access

**Symptoms:**
```
cannot reach external APIs
timeout errors
DNS resolution failures
```

**Diagnosis:**
```bash
# Test external connectivity from container
make client                     # Access client container
curl -I https://api.assemblyai.com  # Test API connectivity
ping google.com                # Test internet connectivity
```

**Solutions:**
```bash
# Check DNS configuration
docker run --rm alpine nslookup google.com

# Check firewall/proxy settings
# May need to configure Docker daemon proxy settings

# Verify API keys are correct
./scripts/environment-manager.sh validate
```

### 5. Build and Image Issues

#### Problem: Build Failures

**Symptoms:**
```
build failed
package installation errors
context build cancelled
```

**Diagnosis:**
```bash
# Check build logs
docker-compose build client    # Rebuild with detailed output

# Check disk space
df -h                          # Available disk space
docker system df               # Docker disk usage
```

**Solutions:**
```bash
# Clean build cache
docker builder prune -a        # Remove all build cache

# Free up disk space
docker system prune            # ⚠️ Affects all Docker resources

# Rebuild images
make docker-build              # Rebuild all images
docker-compose build --no-cache client  # Force rebuild
```

#### Problem: Image Pull Issues

**Symptoms:**
```
image not found
pull access denied
timeout while pulling
```

**Diagnosis:**
```bash
# Check registry connectivity
docker pull node:20-alpine     # Test registry access

# Check image availability
docker search node             # Search for images
```

**Solutions:**
```bash
# Configure Docker registry (if using private registry)
docker login <registry-url>    # Authenticate with registry

# Use alternative image sources
# Edit docker-compose.yml to use different base images

# Build images locally
docker-compose build           # Build instead of pull
```

## 🛠️ Advanced Debugging Techniques

### 1. Container introspection

```bash
# Access container filesystem
make shell                      # Backend container shell
make client                     # Client container shell

# Inspect container details
docker inspect <container>      # Complete container information
docker logs <container>         # Container logs
docker exec -it <container> /bin/sh  # Interactive shell
```

### 2. Service dependency analysis

```bash
# Check service dependencies
docker-compose config --services  # List all services
docker-compose config            # Rendered configuration

# Dependency graph
docker-compose config | grep -A 5 depends_on
```

### 3. Network debugging

```bash
# Network connectivity tests
docker network ls              # List networks
docker network inspect <network>  # Network details

# Port forwarding tests
docker run --rm --network ireadyoutube-network alpine nc -zv client 5173
```

### 4. Performance analysis

```bash
# Resource monitoring
docker stats --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
docker system df                # Docker space usage
docker system events            # Docker events

# Application performance
make client                     # Access container
npm run analyze                 # Bundle size analysis
npm run lighthouse              # Performance audit
```

## 🔄 Recovery Procedures

### 1. Complete Environment Reset

```bash
# Full environment reset (last resort)
make clean                      # Remove all project resources
make dev-setup                  # Fresh environment setup
make admin-key                  # Generate new admin key
# Add API keys from backup or reconfigure
make start                      # Start fresh environment
```

### 2. Service-Specific Recovery

```bash
# Individual service recovery
docker-compose stop client
docker-compose rm -f client
docker-compose up -d client

# Volume recovery (from backup)
make restore BACKUP_FILE=backups/convex-backup-YYYYMMDD_HHMMSS.tar.gz
```

### 3. Configuration Recovery

```bash
# Environment file recovery
cp .env.backup.TIMESTAMP .env    # Restore from backup
./scripts/environment-manager.sh validate  # Validate restored config
make restart                    # Apply restored configuration
```

## 📊 Monitoring and Prevention

### 1. Regular Health Checks

```bash
# Automated health monitoring
*/5 * * * * /path/to/scripts/docker-health-monitor.sh

# Log monitoring
tail -f /var/log/docker.log     # Docker daemon logs
docker events --filter event=die  # Container death events
```

### 2. Resource Monitoring

```bash
# Set up resource alerts
docker stats --format "json" > /tmp/docker-stats.json

# Monitor disk usage
watch -n 60 'df -h | grep docker'
```

### 3. Backup Automation

```bash
# Automated daily backups
0 2 * * * cd /project && make backup

# Weekly backup verification
0 3 * * 0 cd /project && ./scripts/backup-utility.sh verify $(ls -t backups/ | head -1)
```

## 🆘 Emergency Procedures

### When Everything Fails

1. **Stop All Services**
   ```bash
   make stop
   docker-compose down --remove-orphans
   ```

2. **Backup Current State**
   ```bash
   ./scripts/backup-utility.sh backup
   cp .env .env.emergency.backup
   ```

3. **Clean Environment**
   ```bash
   make clean
   docker system prune  # ⚠️ Affects all Docker resources
   ```

4. **Fresh Setup**
   ```bash
   make dev-setup
   # Manually restore critical configurations
   make start
   ```

5. **Verify and Monitor**
   ```bash
   make healthcheck
   make logs
   ```

### Data Recovery Priority

1. **Stop all writes** - Prevent further corruption
2. **Backup current state** - Even corrupted data might be recoverable
3. **Identify last known good backup** - Check backup timestamps
4. **Verify backup integrity** - Use backup verification tools
5. **Restore from backup** - Follow proper restore procedures
6. **Test thoroughly** - Verify all functionality after restore

## 📞 Getting Help

### Internal Resources

- Project documentation in `/docs/` directory
- Makefile help: `make help`
- Script documentation: `./scripts/ --help`

### External Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Docker Forums](https://forums.docker.com/)
- [Stack Overflow Docker Tag](https://stackoverflow.com/questions/tagged/docker)

### Issue Reporting

When reporting issues, include:

1. **System Information**
   ```bash
   docker version
   docker-compose version
   uname -a
   ```

2. **Error Logs**
   ```bash
   make logs > docker-logs.txt
   docker events > docker-events.txt
   ```

3. **Configuration**
   ```bash
   docker-compose config > docker-config.yml
   ./scripts/environment-manager.sh show > environment.txt
   ```

4. **Steps to Reproduce**
   - Exact commands used
   - Expected vs. actual behavior
   - Timestamp of issue

---

Remember: Prevention is better than cure. Regular monitoring, proper backups, and following best practices will prevent most issues before they occur.