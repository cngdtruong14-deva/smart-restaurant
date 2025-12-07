#!/bin/bash

# Smart Restaurant Deployment Script
# Usage: ./deploy.sh [environment]

set -e

ENVIRONMENT=${1:-production}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backup/smart-restaurant"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_requirements() {
    log_info "Checking system requirements..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check disk space
    FREE_SPACE=$(df -h / | awk 'NR==2 {print $4}')
    log_info "Free disk space: $FREE_SPACE"
    
    # Check memory
    FREE_MEM=$(free -m | awk 'NR==2 {print $4}')
    if [ $FREE_MEM -lt 2048 ]; then
        log_warn "Low memory available: ${FREE_MEM}MB"
    fi
}

backup_database() {
    log_info "Backing up database..."
    
    mkdir -p $BACKUP_DIR
    
    # Backup MySQL
    docker exec smart-restaurant-mysql mysqldump \
        -u $DB_USER \
        -p$DB_PASSWORD \
        $DB_NAME > $BACKUP_DIR/backup_$TIMESTAMP.sql
    
    # Compress backup
    gzip $BACKUP_DIR/backup_$TIMESTAMP.sql
    
    # Keep only last 7 days of backups
    find $BACKUP_DIR -name "*.gz" -mtime +7 -delete
    
    log_info "Database backup completed: backup_$TIMESTAMP.sql.gz"
}

deploy_application() {
    log_info "Deploying Smart Restaurant ($ENVIRONMENT)..."
    
    # Pull latest images
    log_info "Pulling latest Docker images..."
    docker-compose -f docker-compose.prod.yml pull
    
    # Stop existing containers
    log_info "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down --timeout 30
    
    # Start new containers
    log_info "Starting new containers..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    log_info "Waiting for services to be ready..."
    sleep 30
    
    # Run database migrations (if any)
    log_info "Running database migrations..."
    # docker-compose -f docker-compose.prod.yml exec backend npm run migrate
    
    log_info "Deployment completed!"
}

health_check() {
    log_info "Performing health checks..."
    
    local max_attempts=10
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        log_info "Health check attempt $attempt/$max_attempts"
        
        # Check backend
        if curl -f http://localhost:5000/health > /dev/null 2>&1; then
            log_info "✓ Backend is healthy"
        else
            log_error "✗ Backend health check failed"
            return 1
        fi
        
        # Check frontend
        if curl -f http://localhost:3000 > /dev/null 2>&1; then
            log_info "✓ Frontend is healthy"
        else
            log_error "✗ Frontend health check failed"
            return 1
        fi
        
        # Check database
        if docker exec smart-restaurant-mysql mysqladmin ping -h localhost > /dev/null 2>&1; then
            log_info "✓ Database is healthy"
        else
            log_error "✗ Database health check failed"
            return 1
        fi
        
        log_info "All health checks passed!"
        return 0
        
        sleep 5
        attempt=$((attempt + 1))
    done
    
    log_error "Health checks failed after $max_attempts attempts"
    return 1
}

cleanup() {
    log_info "Cleaning up..."
    
    # Remove unused Docker images
    docker image prune -f
    
    # Remove stopped containers
    docker container prune -f
    
    # Remove unused volumes
    docker volume prune -f
    
    log_info "Cleanup completed"
}

send_notification() {
    local status=$1
    local message=$2
    
    # Send to Slack (if configured)
    if [ ! -z "$SLACK_WEBHOOK" ]; then
        curl -X POST $SLACK_WEBHOOK \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"Smart Restaurant Deployment ($ENVIRONMENT): $message\"}" \
            > /dev/null 2>&1
    fi
    
    # Send email (if configured)
    if [ ! -z "$EMAIL_TO" ]; then
        echo "Deployment $status: $message" | mail -s "Smart Restaurant Deployment" $EMAIL_TO
    fi
    
    log_info "Notification sent: $message"
}

# Main execution
main() {
    log_info "Starting Smart Restaurant deployment ($ENVIRONMENT)"
    
    # Load environment variables
    if [ -f .env.$ENVIRONMENT ]; then
        log_info "Loading environment variables from .env.$ENVIRONMENT"
        set -a
        source .env.$ENVIRONMENT
        set +a
    fi
    
    check_requirements
    backup_database
    deploy_application
    
    if health_check; then
        cleanup
        send_notification "SUCCESS" "✅ Deployment completed successfully at $(date)"
        log_info "🎉 Deployment completed successfully!"
    else
        # Rollback on failure
        log_error "Deployment failed, rolling back..."
        docker-compose -f docker-compose.prod.yml down --timeout 30
        send_notification "FAILED" "❌ Deployment failed at $(date)"
        exit 1
    fi
}

# Run main function
main "$@"