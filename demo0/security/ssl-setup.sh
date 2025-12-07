#!/bin/bash

# SSL Certificate Setup Script
# Using Let's Encrypt Certbot

DOMAIN="restaurant.yourdomain.com"
EMAIL="admin@yourdomain.com"

# Install Certbot
apt-get update
apt-get install -y certbot python3-certbot-nginx

# Stop nginx temporarily
docker-compose -f docker-compose.prod.yml stop nginx

# Obtain SSL certificate
certbot certonly --standalone \
    --preferred-challenges http \
    -d $DOMAIN \
    -d www.$DOMAIN \
    -m $EMAIL \
    --agree-tos \
    --non-interactive

# Create directory for SSL certificates
mkdir -p nginx/ssl

# Copy certificates to nginx directory
cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem nginx/ssl/cert.pem
cp /etc/letsencrypt/live/$DOMAIN/privkey.pem nginx/ssl/key.pem

# Set proper permissions
chmod 400 nginx/ssl/key.pem

# Restart nginx
docker-compose -f docker-compose.prod.yml start nginx

# Setup auto-renewal cron job
echo "0 2 * * * certbot renew --quiet --post-hook \"docker-compose -f /var/www/smart-restaurant/docker-compose.prod.yml restart nginx\"" \
    >> /etc/crontab

echo "SSL certificates installed and configured!"