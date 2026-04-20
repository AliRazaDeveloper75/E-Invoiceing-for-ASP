#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STEP 6 — Configure Nginx as reverse proxy
# Copies nginx.conf to /etc/nginx/sites-available/einvoicing and enables it.
#
# Usage:
#   bash setup/6_nginx.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
NGINX_SRC="$PROJECT_DIR/setup/nginx.conf"
NGINX_DEST="/etc/nginx/sites-available/einvoicing"

# Auto-detect server public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "16.170.224.119")

echo ">>> Configuring Nginx for: $PUBLIC_IP"

# Replace placeholders in nginx.conf
sed "s|SERVER_IP|$PUBLIC_IP|g; s|/home/ubuntu/einvoicing|$PROJECT_DIR|g" \
    "$NGINX_SRC" | sudo tee "$NGINX_DEST" > /dev/null

# Enable site, remove default
sudo ln -sf "$NGINX_DEST" /etc/nginx/sites-enabled/einvoicing
sudo rm -f /etc/nginx/sites-enabled/default

echo ">>> Testing Nginx config..."
sudo nginx -t

sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "✅ Nginx configured and running."
echo "   Site: http://$PUBLIC_IP"
echo ""
echo ">>> All done! Verify all services:"
echo "   sudo systemctl status einvoicing-backend"
echo "   sudo systemctl status nginx"
echo "   sudo systemctl status postgresql"
echo "   pm2 status"
