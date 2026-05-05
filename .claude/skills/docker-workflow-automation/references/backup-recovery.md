# Backup and Recovery Guide

## Overview

Comprehensive backup and recovery procedures for Docker-based applications in the iReadYouTube project. This guide covers data protection strategies, automated backup procedures, and disaster recovery planning.

## 💾 Backup Strategy

### 1. Data Classification

#### Critical Data (Must Back Up)
- **Convex Database Data**: User data, application state
- **Uploaded Files**: Video files, transcripts, user uploads
- **Configuration Files**: Environment files, application configuration
- **SSL Certificates**: Security certificates, private keys

#### Important Data (Recommended Backups)
- **Application Logs**: System logs, error logs
- **Docker Images**: Custom-built images
- **Deployment Scripts**: Automation scripts, deployment configurations

#### Ephemeral Data (No Backup Needed)
- **Container Temporary Files**: Runtime temporary data
- **Build Cache**: Docker build cache
- **Application Cache**: Redis cache, temporary sessions

### 2. Backup Frequency and Retention

```bash
# Backup Schedule Policy
# Daily Backups: Full data backup
# Weekly: Full backup with verification
# Monthly: Archive backup to long-term storage
# Retention Policy:
#   - Daily backups: 30 days
#   - Weekly backups: 12 weeks
#   - Monthly backups: 12 months
#   - Yearly backups: 7 years
```

### 3. Backup Storage Strategy

#### Local Storage
- **Immediate Access**: Quick recovery for recent data
- **Automated Backups**: Daily automated backups
- **Location**: Same server, separate disk/array

#### Remote Storage
- **Off-site Protection**: Protection against local disasters
- **Cloud Storage**: AWS S3, Google Cloud Storage, Azure Blob
- **Manual Upload**: Monthly archives to cloud storage

#### Geographic Distribution
- **Multiple Regions**: Cross-region backup for critical data
- **Air Gap**: Physical separation for ultimate protection
- **Compliance**: Meet regulatory requirements

## 🔧 Backup Implementation

### 1. Automated Backup Script

The backup utility script provides comprehensive backup functionality:

```bash
# Basic backup operations
./scripts/backup-utility.sh backup                    # Create full backup
./scripts/backup-utility.sh backup --volumes redis_data,convex_backend_data  # Specific volumes
./scripts/backup-utility.sh backup --exclude redis_data  # Exclude specific volumes
```

### 2. Backup Configuration

```bash
# Backup configuration variables
BACKUP_DIR="${PROJECT_DIR}/backups"
BACKUP_RETENTION_DAYS=30
COMPRESSION_ENABLED=true
ENCRYPTION_ENABLED=false  # Future enhancement

# Volume-specific backup settings
REDIS_BACKUP_PRIORITY=high
CONVEX_BACKUP_PRIORITY=critical
UPLOADS_BACKUP_PRIORITY=high
```

### 3. Scheduled Backups

```bash
# Add to crontab for automated backups
# Daily backup at 2 AM
0 2 * * * cd /opt/ireadyoutube && ./scripts/backup-utility.sh backup

# Weekly verification on Sundays at 3 AM
0 3 * * 0 cd /opt/ireadyoutube && ./scripts/backup-utility.sh verify $(ls -t backups/ | head -1)

# Monthly cleanup on 1st at 4 AM
0 4 1 * * cd /opt/ireadyoutube && ./scripts/backup-utility.sh clean 30
```

### 4. Backup Verification

```bash
# Automated backup verification
#!/bin/bash
# verify-backups.sh

BACKUP_DIR="/opt/ireadyoutube/backups"
LOG_FILE="/var/log/backup-verification.log"

verify_backup() {
    local backup_file="$1"
    echo "$(date): Verifying backup: $backup_file" >> "$LOG_FILE"

    if ./scripts/backup-utility.sh verify "$backup_file"; then
        echo "$(date): ✓ Backup verified: $backup_file" >> "$LOG_FILE"
        return 0
    else
        echo "$(date): ✗ Backup failed verification: $backup_file" >> "$LOG_FILE"
        # Send alert
        echo "Backup verification failed: $backup_file" | mail -s "Backup Alert" admin@yourdomain.com
        return 1
    fi
}

# Verify latest backup
latest_backup=$(ls -t "$BACKUP_DIR"/convex-backup-*.tar.gz | head -1)
if [[ -n "$latest_backup" ]]; then
    verify_backup "$latest_backup"
fi

# Verify random older backup
random_backup=$(ls -t "$BACKUP_DIR"/convex-backup-*.tar.gz | shuf -n 1)
if [[ -n "$random_backup" ]]; then
    verify_backup "$random_backup"
fi
```

## 🔄 Recovery Procedures

### 1. Disaster Recovery Levels

#### Level 1: Service Recovery
**Scenario**: Single service failure or corruption
**Recovery Time**: Minutes
**Data Loss**: Minimal to none

```bash
# Service recovery procedure
./scripts/service-orchestrator.sh stop                # Stop affected services
./scripts/service-orchestrator.sh start               # Restart services
./scripts/docker-health-monitor.sh                    # Verify recovery
```

#### Level 2: Data Recovery
**Scenario**: Data corruption or accidental deletion
**Recovery Time**: 30-60 minutes
**Data Loss**: Up to 24 hours (depending on backup schedule)

```bash
# Data recovery procedure
make stop                                                # Stop all services
./scripts/backup-utility.sh restore latest_backup.tar.gz # Restore from latest backup
./scripts/service-orchestrator.sh start                  # Restart services
make healthcheck                                         # Verify recovery
```

#### Level 3: Full System Recovery
**Scenario**: Complete system failure, natural disaster
**Recovery Time**: 2-6 hours
**Data Loss**: Up to 24 hours

```bash
# Full system recovery procedure
# 1. Provision new infrastructure
# 2. Install Docker and dependencies
# 3. Clone project repository
# 4. Configure environment
# 5. Restore from latest backup
# 6. Start services
# 7. Verify and monitor
```

### 2. Recovery Testing

```bash
# Monthly recovery testing script
#!/bin/bash
# recovery-test.sh

TEST_ENV="recovery-test"
TEST_BACKUP="backups/convex-backup-$(date -d '1 day ago' +%Y%m%d)_*.tar.gz"

echo "Starting monthly recovery test..."

# Create test environment
export COMPOSE_PROJECT_NAME="$TEST_ENV"
docker-compose -f docker/docker-compose.yml --env-file .env down -v
docker-compose -f docker/docker-compose.yml --env-file .env up -d

# Wait for services to start
sleep 30

# Test recovery
echo "Testing recovery from backup: $TEST_BACKUP"
./scripts/backup-utility.sh restore $TEST_BACKUP

# Verify recovery
if ./scripts/docker-health-monitor.sh; then
    echo "✓ Recovery test successful"
else
    echo "✗ Recovery test failed"
    # Send alert
    echo "Monthly recovery test failed" | mail -s "Recovery Test Alert" admin@yourdomain.com
fi

# Cleanup test environment
docker-compose -f docker/docker-compose.yml --env-file .env down -v

echo "Recovery test completed"
```

### 3. Point-in-Time Recovery

```bash
# Point-in-time recovery procedure
restore_to_point_in_time() {
    local target_time="$1"
    local backup_file=$(find backups/ -name "convex-backup-*.tar.gz" \
        -newermt "$target_time" | sort | head -1)

    if [[ -z "$backup_file" ]]; then
        echo "No backup found for time: $target_time"
        return 1
    fi

    echo "Restoring to point in time: $target_time"
    echo "Using backup: $backup_file"

    # Stop services
    make stop

    # Restore from backup
    ./scripts/backup-utility.sh restore "$backup_file"

    # Start services
    make start

    # Verify restoration
    make healthcheck
}

# Usage example
restore_to_point_in_time "2024-11-11 14:30:00"
```

## 🛡️ Advanced Backup Features

### 1. Incremental Backups

```bash
# Incremental backup script
#!/bin/bash
# incremental-backup.sh

LAST_BACKUP_FILE="backups/.last_backup"
CURRENT_DATE=$(date +%Y%m%d_%H%M%S)

# Find last backup time
if [[ -f "$LAST_BACKUP_FILE" ]]; then
    LAST_BACKUP_TIME=$(cat "$LAST_BACKUP_FILE")
else
    LAST_BACKUP_TIME="1970-01-01 00:00:00"
fi

echo "Creating incremental backup since: $LAST_BACKUP_TIME"

# Create incremental backup
docker run --rm \
    -v ireadyoutube_convex_backend_data:/data:ro \
    -v "$PWD/backups":/backup \
    alpine sh -c "
        find /data -newermt '$LAST_BACKUP_TIME' -type f | \
        tar czf /backup/incremental-backup-${CURRENT_DATE}.tar.gz -T -
    "

# Update last backup time
date '+%Y-%m-%d %H:%M:%S' > "$LAST_BACKUP_FILE"

echo "Incremental backup completed: incremental-backup-${CURRENT_DATE}.tar.gz"
```

### 2. Database-Specific Backups

```bash
# Convex database backup
#!/bin/bash
# convex-backup.sh

BACKUP_FILE="backups/convex-db-$(date +%Y%m%d_%H%M%S).json"

echo "Creating Convex database backup..."

# Access Convex container and export data
docker-compose -f docker/docker-compose.yml exec convex-backend \
    npx convex export --url http://localhost:3210 --file "/tmp/backup.json"

# Copy backup file from container
docker cp $(docker-compose -f docker/docker-compose.yml ps -q convex-backend):/tmp/backup.json "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

echo "Convex database backup completed: ${BACKUP_FILE}.gz"
```

### 3. Cross-Region Replication

```bash
# Cross-region backup replication
#!/bin/bash
# replicate-backups.sh

S3_BUCKET="ireadyoutube-backups-us-west-2"
LOCAL_BACKUP_DIR="/opt/ireadyoutube/backups"

echo "Starting cross-region backup replication..."

# Sync backups to S3
aws s3 sync "$LOCAL_BACKUP_DIR" "s3://$S3_BUCKET" \
    --exclude "*" \
    --include "convex-backup-*.tar.gz" \
    --delete

# Verify upload integrity
for backup_file in "$LOCAL_BACKUP_DIR"/convex-backup-*.tar.gz; do
    backup_name=$(basename "$backup_file")

    # Calculate local checksum
    local_checksum=$(sha256sum "$backup_file" | cut -d' ' -f1)

    # Calculate remote checksum
    remote_checksum=$(aws s3api head-object \
        --bucket "$S3_BUCKET" \
        --key "$backup_name" \
        --query 'Metadata.checksumsha256' \
        --output text 2>/dev/null || echo "")

    if [[ "$local_checksum" != "$remote_checksum" ]]; then
        echo "Checksum mismatch for $backup_name, re-uploading..."
        aws s3 cp "$backup_file" "s3://$S3_BUCKET/$backup_name" \
            --metadata "checksumsha256=$local_checksum"
    fi
done

echo "Cross-region replication completed"
```

## 📊 Backup Monitoring

### 1. Backup Success Monitoring

```bash
# Backup monitoring script
#!/bin/bash
# monitor-backups.sh

BACKUP_DIR="/opt/ireadyoutube/backups"
ALERT_EMAIL="admin@yourdomain.com"
LOG_FILE="/var/log/backup-monitoring.log"

# Check for recent successful backups
check_recent_backups() {
    local hours_ago=${1:-24}
    local cutoff_time=$(date -d "$hours_ago hours ago" +%s)

    local recent_backups=0
    for backup_file in "$BACKUP_DIR"/convex-backup-*.tar.gz; do
        if [[ -f "$backup_file" ]]; then
            local backup_time=$(stat -c %Y "$backup_file")
            if [[ $backup_time -gt $cutoff_time ]]; then
                ((recent_backups++))
            fi
        fi
    done

    echo "$(date): Found $recent_backups backups in last $hours_ago hours" >> "$LOG_FILE"

    if [[ $recent_backups -eq 0 ]]; then
        echo "$(date): WARNING - No recent backups found!" >> "$LOG_FILE"
        echo "No backups found in last $hours_ago hours" | \
            mail -s "Backup Alert" "$ALERT_EMAIL"
        return 1
    fi

    return 0
}

# Check backup file sizes
check_backup_sizes() {
    local min_size_mb=${1:-100}  # Minimum backup size in MB

    for backup_file in "$BACKUP_DIR"/convex-backup-*.tar.gz; do
        if [[ -f "$backup_file" ]]; then
            local size_mb=$(du -m "$backup_file" | cut -f1)

            if [[ $size_mb -lt $min_size_mb ]]; then
                echo "$(date): WARNING - Small backup detected: $backup_file ($size_mb MB)" >> "$LOG_FILE"
                echo "Small backup detected: $backup_file ($size_mb MB)" | \
                    mail -s "Backup Alert" "$ALERT_EMAIL"
            fi
        fi
    done
}

# Check disk space
check_disk_space() {
    local usage_percent=$(df "$BACKUP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')

    if [[ $usage_percent -gt 90 ]]; then
        echo "$(date): CRITICAL - Backup disk usage: ${usage_percent}%" >> "$LOG_FILE"
        echo "Backup disk usage critical: ${usage_percent}%" | \
            mail -s "Backup Alert" "$ALERT_EMAIL"
    fi
}

# Main monitoring function
main() {
    echo "$(date): Starting backup monitoring" >> "$LOG_FILE"

    check_recent_backups 24
    check_backup_sizes 100
    check_disk_space

    echo "$(date): Backup monitoring completed" >> "$LOG_FILE"
}

main "$@"
```

### 2. Backup Metrics Dashboard

```yaml
# Prometheus metrics for backup monitoring
# prometheus-backup.yml
global:
  scrape_interval: 1m

scrape_configs:
  - job_name: 'backup-metrics'
    static_configs:
      - targets: ['localhost:9101']
    metrics_path: /metrics
    scrape_interval: 5m

# Backup metrics collection
#!/bin/bash
# backup-metrics-exporter.sh

BACKUP_DIR="/opt/ireadyoutube/backups"
METRICS_FILE="/var/lib/node_exporter/textfile_collector/backup_metrics.prom"

collect_backup_metrics() {
    # Number of backups
    backup_count=$(ls -1 "$BACKUP_DIR"/convex-backup-*.tar.gz 2>/dev/null | wc -l)

    # Size of latest backup
    latest_backup=$(ls -t "$BACKUP_DIR"/convex-backup-*.tar.gz 2>/dev/null | head -1)
    if [[ -f "$latest_backup" ]]; then
        latest_size=$(du -b "$latest_backup" | cut -f1)
        latest_age=$(($(date +%s) - $(stat -c %Y "$latest_backup")))
    else
        latest_size=0
        latest_age=0
    fi

    # Disk usage
    disk_usage=$(df "$BACKUP_DIR" | awk 'NR==2 {print $5}' | sed 's/%//')

    # Generate Prometheus metrics
    cat > "$METRICS_FILE" << EOF
# HELP backup_count Total number of backups
# TYPE backup_count gauge
backup_count $backup_count

# HELP backup_latest_size_bytes Size of latest backup in bytes
# TYPE backup_latest_size_bytes gauge
backup_latest_size_bytes $latest_size

# HELP backup_latest_age_seconds Age of latest backup in seconds
# TYPE backup_latest_age_seconds gauge
backup_latest_age_seconds $latest_age

# HELP backup_disk_usage_percent Disk usage percentage for backup directory
# TYPE backup_disk_usage_percent gauge
backup_disk_usage_percent $disk_usage
EOF
}

collect_backup_metrics
```

## 🚨 Emergency Procedures

### 1. Immediate Response Checklist

#### System Failure Detection
```bash
# Immediate failure detection
if ! ./scripts/docker-health-monitor.sh >/dev/null 2>&1; then
    echo "$(date): CRITICAL - System failure detected" | \
        mail -s "EMERGENCY: System Failure" admin@yourdomain.com

    # Create emergency backup
    ./scripts/backup-utility.sh backup --force

    # Attempt automatic recovery
    ./scripts/service-orchestrator.sh restart
fi
```

#### Data Corruption Detection
```bash
# Data corruption detection
check_data_integrity() {
    # Check Convex database integrity
    if docker-compose -f docker/docker-compose.yml exec convex-backend \
        npx convex doctor 2>&1 | grep -q "ERROR"; then
        echo "$(date): CRITICAL - Data corruption detected" | \
            mail -s "EMERGENCY: Data Corruption" admin@yourdomain.com

        # Immediate backup of corrupted data
        ./scripts/backup-utility.sh backup --backup-name "corrupted-data-emergency"
    fi
}
```

### 2. Emergency Recovery Procedures

#### Complete System Restoration
```bash
# Emergency system restoration
#!/bin/bash
# emergency-recovery.sh

EMERGENCY_BACKUP="$1"
RESTORE_LOG="/var/log/emergency-recovery.log"

log_message() {
    echo "$(date): $1" | tee -a "$RESTORE_LOG"
}

emergency_recovery() {
    log_message "Starting emergency recovery procedure"

    # Alert team
    echo "Emergency recovery initiated for iReadYouTube" | \
        mail -s "EMERGENCY: Recovery Started" admin@yourdomain.com

    # Stop all services
    log_message "Stopping all services"
    make stop

    # Clean current environment
    log_message "Cleaning current environment"
    make clean

    # Verify emergency backup
    log_message "Verifying emergency backup: $EMERGENCY_BACKUP"
    if ! ./scripts/backup-utility.sh verify "$EMERGENCY_BACKUP"; then
        log_message "ERROR: Emergency backup verification failed"
        exit 1
    fi

    # Restore from backup
    log_message "Restoring from emergency backup"
    ./scripts/backup-utility.sh restore "$EMERGENCY_BACKUP"

    # Start services
    log_message "Starting services"
    make start

    # Verify recovery
    log_message "Verifying recovery"
    if make healthcheck; then
        log_message "Emergency recovery successful"
        echo "Emergency recovery completed successfully" | \
            mail -s "EMERGENCY: Recovery Successful" admin@yourdomain.com
    else
        log_message "ERROR: Emergency recovery failed"
        echo "Emergency recovery failed - Manual intervention required" | \
            mail -s "EMERGENCY: Recovery Failed" admin@yourdomain.com
        exit 1
    fi
}

emergency_recovery "$@"
```

### 3. Communication Procedures

#### Stakeholder Notification
```bash
# Stakeholder notification template
#!/bin/bash
# notify-stakeholders.sh

INCIDENT_TYPE="$1"
SEVERITY="$2"
DESCRIPTION="$3"

stakeholder_email() {
    local email="$1"
    local subject="[INCIDENT] $INCIDENT_TYPE - $SEVERITY"

    cat << EOF | mail -s "$subject" "$email"
Dear Stakeholder,

We are experiencing an incident of type: $INCIDENT_TYPE
Severity: $SEVERITY
Description: $DESCRIPTION

Current Status: Recovery procedures are in progress
Expected Resolution: [Update as situation evolves]

For urgent inquiries, contact: admin@yourdomain.com

Regards,
Operations Team
EOF
}

# Notify key stakeholders
stakeholder_email "cto@yourdomain.com"
stakeholder_email "product-manager@yourdomain.com"
stakeholder_email "support@yourdomain.com"
```

## 📋 Documentation and Compliance

### 1. Backup Documentation

```bash
# Generate backup documentation
generate_backup_report() {
    local report_file="reports/backup-report-$(date +%Y%m%d).md"

    cat > "$report_file" << EOF
# Backup Report - $(date +%Y-%m-%d)

## Backup Summary
- Total Backups: $(ls -1 backups/convex-backup-*.tar.gz 2>/dev/null | wc -l)
- Latest Backup: $(ls -t backups/convex-backup-*.tar.gz 2>/dev/null | head -1 | xargs basename)
- Backup Directory Usage: $(du -sh backups/ | cut -f1)

## Recent Backups
$(ls -lt backups/convex-backup-*.tar.gz 2>/dev/null | head -10 | \
    awk '{printf "- %s (%s)\n", $9, $6" "$7" "$8}')

## Recovery Tests
$(grep "recovery test" /var/log/backup-verification.log | tail -5)

## Issues and Resolutions
$(grep "ERROR\|WARNING" /var/log/backup-verification.log | tail -5)

## Compliance Status
- Daily Backups: $(ls -1 backups/convex-backup-$(date +%Y%m%d)*.tar.gz 2>/dev/null | wc -l > /dev/null && echo "✓" || echo "✗")
- Weekly Verification: $(grep "$(date +%Y-%m-%d)" /var/log/backup-verification.log >/dev/null && echo "✓" || echo "✗")
- Monthly Recovery Test: $(grep "recovery test" /var/log/recovery-test.log | tail -1 | grep -q "$(date +%Y-%m)" && echo "✓" || echo "✗")
EOF

    echo "Backup report generated: $report_file"
}
```

### 2. Compliance Checklist

```bash
# Backup compliance checklist
COMPLIANCE_CHECKLIST=(
    "Daily automated backups configured"
    "Backup verification procedures implemented"
    "Cross-region replication configured"
    "Recovery testing performed monthly"
    "Backup encryption implemented"
    "Access controls for backup storage"
    "Retention policy enforced"
    "Disaster recovery plan documented"
    "Stakeholder notification procedures"
    "Compliance reporting automated"
)

check_compliance() {
    local compliant=0
    local total=${#COMPLIANCE_CHECKLIST[@]}

    echo "Backup Compliance Checklist"
    echo "=========================="

    for item in "${COMPLIANCE_CHECKLIST[@]}"; do
        # Implementation would check each specific requirement
        echo "☐ $item"
    done

    echo ""
    echo "Compliance Score: $compliant/$total"
}
```

---

This comprehensive backup and recovery guide ensures data protection, business continuity, and regulatory compliance for Docker-based applications.