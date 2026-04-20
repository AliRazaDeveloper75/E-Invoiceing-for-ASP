#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STEP 5 — Build Next.js and start with PM2
#
# Usage:
#   bash setup/5_frontend.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_DIR/frontend"

# Auto-detect server public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || echo "16.170.224.119")

echo ">>> Setting up frontend for: http://$PUBLIC_IP"
cd "$FRONTEND_DIR"

# Create production env
echo "NEXT_PUBLIC_API_URL=http://$PUBLIC_IP/api/v1" > .env.production
echo ">>> Created .env.production with API URL: http://$PUBLIC_IP/api/v1"

echo ">>> Installing Node dependencies..."
npm install --silent

echo ">>> Building Next.js..."
npm run build

echo ">>> Starting with PM2..."
pm2 delete einvoicing-frontend 2>/dev/null || true
pm2 start npm --name "einvoicing-frontend" -- start
pm2 save

echo ">>> Enabling PM2 on system startup..."
pm2 startup | tail -1 | sudo bash 2>/dev/null || echo "(Run 'pm2 startup' manually if this failed)"

echo ""
pm2 status
echo ""
echo "✅ Frontend running on 127.0.0.1:3000"
echo ""
echo "Next: bash setup/6_nginx.sh"
