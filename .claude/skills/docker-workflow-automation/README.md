# Docker Workflow Automation Skill

A comprehensive Docker workflow automation skill for the iReadYouTube project that enforces **DOCKER-ONLY development patterns** with complete service orchestration, environment management, and production deployment capabilities.

## 🚀 Overview

This skill provides enterprise-grade Docker workflow automation with strict adherence to the **DOCKER-ONLY development policy**. It enables complete container orchestration, service health monitoring, backup/recovery procedures, and production deployment patterns specifically designed for the iReadYouTube YouTube Video Transcription MVP.

### Core Features

- **🔒 DOCKER-ONLY ENFORCEMENT**: Strict policy enforcement - never run commands on host machine
- **🚢 SERVICE ORCHESTRATION**: Complete Docker Compose management with dependency resolution
- **🌍 ENVIRONMENT MANAGEMENT**: Single .env file policy with secure API key management
- **💾 BACKUP & RECOVERY**: Automated backup and disaster recovery procedures
- **🏥 HEALTH MONITORING**: Comprehensive service health checks and monitoring
- **🚀 PRODUCTION DEPLOYMENT**: Production-ready deployment patterns with SSL/TLS support
- **📊 PERFORMANCE OPTIMIZATION**: Resource management and optimization patterns
- **🔍 ADVANCED DEBUGGING**: Comprehensive troubleshooting and diagnostic tools

## 📋 Skill Structure

```
docker-workflow-automation/
├── SKILL.md                    # Main skill documentation and workflows
├── LICENSE.txt                 # MIT license
├── README.md                   # This file - comprehensive overview
├── scripts/                    # Automation scripts
│   ├── docker-health-monitor.sh     # Service health monitoring
│   ├── service-orchestrator.sh      # Service orchestration
│   ├── backup-utility.sh           # Backup and restore utilities
│   └── environment-manager.sh      # Environment variable management
├── references/                 # Documentation and guides
│   ├── docker-best-practices.md   # Docker development best practices
│   ├── troubleshooting.md         # Troubleshooting guide
│   ├── production-deployment.md   # Production deployment guide
│   └── backup-recovery.md         # Backup and recovery procedures
└── assets/                     # Configuration templates
    ├── docker-compose-template.yml # Docker Compose template
    ├── environment-templates/      # Environment file templates
    │   ├── production.env         # Production environment template
    │   └── development.env        # Development environment template
    └── nginx/                      # Nginx configuration
        └── nginx.conf             # Production Nginx configuration
```

## 🎯 When to Use This Skill

This skill should be used when working with Docker-based development environments, specifically for:

### **Service Orchestration**
- Managing multi-container applications with Docker Compose
- Orchestrating service dependencies and startup order
- Implementing rolling updates and blue-green deployments
- Scaling services horizontally

### **Environment Management**
- Setting up Docker-only development workflows
- Managing single .env file policy across environments
- Handling API keys and sensitive configuration
- Environment validation and troubleshooting

### **Production Deployment**
- Deploying containerized applications to production
- Configuring SSL/TLS and security headers
- Implementing reverse proxy with Nginx
- Setting up monitoring and alerting

### **Data Management**
- Creating automated backup strategies
- Implementing disaster recovery procedures
- Managing Docker volumes and data persistence
- Cross-region backup replication

### **Performance Optimization**
- Optimizing Docker workflows for development
- Implementing resource limits and monitoring
- Setting up caching strategies
- Performance troubleshooting

## 🚨 Critical Policy Enforcement

### **DOCKER-ONLY DEVELOPMENT (MANDATORY)**

This skill enforces absolute **DOCKER-ONLY development patterns**:

#### **✅ CORRECT PATTERNS**
```bash
# Use Makefile commands for all operations
make start                    # Start all services with orchestration
make stop                     # Graceful service shutdown
make logs                     # Centralized log management
make healthcheck              # Comprehensive health monitoring
make install                  # Install dependencies in containers
make test                     # Run tests in containers
make shell                    # Access container shells
make client                   # Access client container
```

#### **❌ FORBIDDEN PATTERNS**
```bash
# NEVER run commands directly on host machine
cd client && npm install       # WRONG - Use 'make install' instead
npm run dev                   # WRONG - Use 'make start' instead
npx convex dev                # WRONG - Use 'make convex CMD="npx convex dev"' instead

# NEVER use Docker prune commands
docker system prune            # WRONG - Affects all system Docker resources
docker volume prune            # WRONG - Causes permanent data loss
docker image prune             # WRONG - Removes all unused images
```

### **SINGLE .ENV FILE POLICY**

**ABSOLUTE RULE**: Use only **ONE** `.env` file for ALL environments (development, staging, production).

```bash
# ✅ CORRECT: Single environment file
.env                           # Single source of truth for all environments

# ❌ FORBIDDEN: Multiple environment files
.env.development              # WRONG - Creates confusion and duplication
.env.staging                  # WRONG - Breaks single-source principle
.env.production               # WRONG - Unnecessary complexity
.env.example                  # WRONG - Not used in this project
```

## 🛠️ Quick Start

### 1. Initial Setup

```bash
# First-time development environment setup
make dev-setup

# Generate admin key
make admin-key

# Add API keys
echo "ASSEMBLYAI_API_KEY=your_key" >> .env
echo "YOUTUBE_API_KEY=your_key" >> .env

# Start development environment
make start
```

### 2. Health Monitoring

```bash
# Check service health
make healthcheck

# Advanced health monitoring
./scripts/docker-health-monitor.sh --verbose

# Service orchestration
./scripts/service-orchestrator.sh status
```

### 3. Environment Management

```bash
# Validate environment configuration
./scripts/environment-manager.sh validate

# Add new service configuration
./scripts/environment-manager.sh add NEW_API_KEY "your_key"

# Generate production environment template
./scripts/environment-manager.sh generate production
```

### 4. Backup and Recovery

```bash
# Create backup
./scripts/backup-utility.sh backup

# List available backups
./scripts/backup-utility.sh list

# Restore from backup
./scripts/backup-utility.sh restore backup-20241112_143022.tar.gz
```

### 5. Production Deployment

```bash
# Setup production environment
make prod-setup

# Deploy to production
make prod-deploy

# Monitor deployment
make logs
make healthcheck
```

## 📚 Script Reference

### **docker-health-monitor.sh**
Comprehensive service health monitoring with JSON output support.

```bash
# Usage examples
./scripts/docker-health-monitor.sh                    # Check all services
./scripts/docker-health-monitor.sh -s client          # Check specific service
./scripts/docker-health-monitor.sh --verbose --json   # Detailed JSON output
./scripts/docker-health-monitor.sh -t 60 -r 5        # Custom timeout and retries
```

**Key Features:**
- Service health status checking
- Container resource monitoring
- URL accessibility validation
- JSON output for automation
- Configurable timeouts and retries

### **service-orchestrator.sh**
Advanced Docker Compose service management with dependency resolution.

```bash
# Usage examples
./scripts/service-orchestrator.sh start               # Start all services
./scripts/service-orchestrator.sh restart --verbose   # Restart with verbose output
./scripts/service-orchestrator.sh scale client 3      # Scale client service
./scripts/service-orchestrator.sh logs convex-backend # Show specific logs
./scripts/service-orchestrator.sh --profile production start  # Production profile
```

**Key Features:**
- Service dependency resolution
- Health-aware startup/shutdown
- Service scaling and load balancing
- Production profile support
- Log aggregation and filtering

### **backup-utility.sh**
Comprehensive backup and restore utilities for Docker volumes.

```bash
# Usage examples
./scripts/backup-utility.sh backup                    # Full backup
./scripts/backup-utility.sh backup --volumes redis_data  # Specific volumes
./scripts/backup-utility.sh restore backup-20241112.tar.gz  # Restore backup
./scripts/backup-utility.sh list                      # List backups
./scripts/backup-utility.sh clean 30                  # Clean old backups
```

**Key Features:**
- Volume-specific backup/restore
- Compression and encryption support
- Backup verification and integrity checking
- Automated cleanup with retention policies
- Cross-platform compatibility

### **environment-manager.sh**
Advanced environment variable management with validation.

```bash
# Usage examples
./scripts/environment-manager.sh validate           # Validate configuration
./scripts/environment-manager.sh add API_KEY "key" # Add variable
./scripts/environment-manager.sh remove OLD_KEY     # Remove variable
./scripts/environment-manager.sh backup             # Create backup
./scripts/environment-manager.sh generate dev       # Generate template
```

**Key Features:**
- Environment variable validation
- Configuration backup and restore
- Template generation for different environments
- Security-sensitive variable handling
- Syntax checking and formatting

## 🔧 Configuration Templates

### **Docker Compose Template**
Comprehensive Docker Compose template with production-ready configurations.

```yaml
# Key features:
- Multi-service orchestration with dependencies
- Health checks for all services
- Resource limits and optimization
- Production profiles (nginx, monitoring)
- Volume management and persistence
- Network isolation and security
- Environment variable interpolation
```

### **Environment Templates**
Production and development environment templates with comprehensive configurations.

```bash
# Environment template features:
- Production security hardening
- Development convenience settings
- API key management patterns
- Resource optimization settings
- Monitoring and logging configuration
- SSL/TLS configuration
- Performance tuning parameters
```

### **Nginx Configuration**
Production-ready Nginx configuration with security headers and SSL support.

```nginx
# Nginx features:
- SSL/TLS termination
- Security headers hardening
- Rate limiting and DDoS protection
- Gzip and Brotli compression
- Reverse proxy configuration
- Static file optimization
- WebSocket support
- Health check endpoints
```

## 📊 Integration with iReadYouTube Project

This skill is specifically designed for the iReadYouTube project architecture:

### **Technology Stack Integration**
- **React 18 + TypeScript**: Frontend container with hot reload
- **Convex Backend**: Self-hosted database and serverless functions
- **AssemblyAI**: AI transcription service integration
- **Redis**: Caching and session storage
- **Nginx**: Reverse proxy and SSL termination

### **Service Architecture**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Client (5173) │────│  Nginx (80/443) │────│   External API  │
│                 │    │                 │    │   AssemblyAI   │
│  React + Vite   │    │  Reverse Proxy  │    │   YouTube API   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │
         │              ┌─────────────────┐
         │──────────────│  Convex (3210)  │
                        │                 │
                        │ Database + API  │
                        └─────────────────┘
                                 │
                        ┌─────────────────┐
                        │   Redis (6379)  │
                        │                 │
                        │  Cache + Sessions│
                        └─────────────────┘
```

### **Development Workflow**
1. **Environment Setup**: `make dev-setup`
2. **API Key Management**: Add keys to single `.env` file
3. **Service Orchestration**: `make start`
4. **Development Work**: `make install`, `make test`, `make logs`
5. **Health Monitoring**: `make healthcheck`
6. **Production Deployment**: `make prod-deploy`

## 🔒 Security Features

### **Container Security**
- Non-root user execution
- Read-only filesystems where possible
- Resource limits and quotas
- Network isolation
- Security context configuration

### **Network Security**
- Docker network segmentation
- TLS/SSL encryption
- Security headers (HSTS, CSP, etc.)
- Rate limiting and DDoS protection
- Firewall rules and access controls

### **API Key Management**
- Secure storage in environment files
- No hardcoded secrets
- Regular key rotation procedures
- Access control and auditing
- Backup encryption support

### **Compliance Features**
- Audit logging
- Data retention policies
- GDPR compliance support
- Security scanning integration
- Compliance reporting

## 🚀 Advanced Features

### **Multi-Environment Support**
- Development, staging, production environments
- Environment-specific configurations
- Blue-green deployment patterns
- Canary deployment support
- A/B testing infrastructure

### **Monitoring and Observability**
- Prometheus metrics integration
- Grafana dashboard templates
- Log aggregation and analysis
- Performance monitoring
- Alert and notification systems

### **Automation and CI/CD**
- GitHub Actions integration
- Automated testing pipelines
- Deployment automation
- Rollback procedures
- Infrastructure as Code patterns

### **Disaster Recovery**
- Automated backup scheduling
- Cross-region replication
- Point-in-time recovery
- Emergency procedures
- Documentation and runbooks

## 📋 Requirements and Prerequisites

### **System Requirements**
- Docker Engine 20.10+
- Docker Compose 2.0+
- Make (for Makefile commands)
- Bash 4.0+ (for scripts)
- OpenSSL (for key generation)

### **Project Requirements**
- iReadYouTube project structure
- Existing Makefile with Docker commands
- Docker Compose configuration
- Environment file management
- Sufficient disk space for backups

### **Optional Integrations**
- Prometheus and Grafana (monitoring)
- Nginx (reverse proxy)
- AWS S3 (cloud backups)
- Slack/Email (notifications)
- GitHub Actions (CI/CD)

## 🔍 Troubleshooting

### **Common Issues**
1. **Port Conflicts**: Check with `make status` and `make stop`
2. **Environment Issues**: Validate with `./scripts/environment-manager.sh validate`
3. **Service Health**: Monitor with `./scripts/docker-health-monitor.sh`
4. **Backup Problems**: Use `./scripts/backup-utility.sh verify`

### **Getting Help**
- Check the [troubleshooting guide](references/troubleshooting.md)
- Review [Docker best practices](references/docker-best-practices.md)
- Consult the main [SKILL.md](SKILL.md) for detailed workflows
- Use the provided diagnostic scripts for automated analysis

## 📄 License

This skill is licensed under the MIT License. See [LICENSE.txt](LICENSE.txt) for details.

## 🤝 Contributing

Contributions are welcome! Please ensure:
- adherence to DOCKER-ONLY development principles
- comprehensive testing and documentation
- compliance with project standards
- proper security considerations

---

**Remember**: This skill enforces strict **DOCKER-ONLY development patterns**. Always use the provided Makefile commands and scripts - never run Docker commands directly or operate outside containers. This ensures consistent, secure, and maintainable development workflows.