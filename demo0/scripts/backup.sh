#!/bin/bash

# Database Backup Script
# Run daily via cron

BACKUP_DIR="/backup/smart-restaurant"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
RETENTION_DAYS=7

# Load environment
source /var/www/smart-restaurant/.env.production

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup MySQL database
echo "Backing up MySQL database..."
docker exec smart-restaurant-mysql mysqldump \
    -u $DB_USER \
    -p$DB_PASSWORD \
    --single-transaction \
    --routines \
    --triggers \
    $DB_NAME > $BACKUP_DIR/db_backup_$TIMESTAMP.sql

# Backup uploads (QR codes)
echo "Backing up QR codes..."
tar -czf $BACKUP_DIR/uploads_backup_$TIMESTAMP.tar.gz -C /var/www/smart-restaurant/backend/public/qr-codes .

# Backup logs
echo "Backing up logs..."
tar -czf $BACKUP_DIR/logs_backup_$TIMESTAMP.tar.gz -C /var/www/smart-restaurant/logs .

# Backup Docker volumes
echo "Backing up Docker volumes..."
docker run --rm \
    -v smart-restaurant_mysql_data:/source \
    -v $BACKUP_DIR:/backup \
    alpine tar -czf /backup/mysql_volume_backup_$TIMESTAMP.tar.gz -C /source .

# Create manifest
cat > $BACKUP_DIR/manifest_$TIMESTAMP.txt << EOF
Backup created: $(date)
Database: smart_ordering
Backup files:
- db_backup_$TIMESTAMP.sql
- uploads_backup_$TIMESTAMP.tar.gz
- logs_backup_$TIMESTAMP.tar.gz
- mysql_volume_backup_$TIMESTAMP.tar.gz
EOF

# Compress everything
tar -czf $BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz -C $BACKUP_DIR \
    db_backup_$TIMESTAMP.sql \
    uploads_backup_$TIMESTAMP.tar.gz \
    logs_backup_$TIMESTAMP.tar.gz \
    mysql_volume_backup_$TIMESTAMP.tar.gz \
    manifest_$TIMESTAMP.txt

# Upload to cloud storage (AWS S3 example)
if [ ! -z "$AWS_ACCESS_KEY_ID" ]; then
    echo "Uploading to S3..."
    aws s3 cp $BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz \
        s3://your-backup-bucket/smart-restaurant/
fi

# Clean up old backups
echo "Cleaning up old backups..."
find $BACKUP_DIR -name "*.tar.gz" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.sql" -mtime +$RETENTION_DAYS -delete
find $BACKUP_DIR -name "*.txt" -mtime +$RETENTION_DAYS -delete

echo "Backup completed: $BACKUP_DIR/full_backup_$TIMESTAMP.tar.gz"