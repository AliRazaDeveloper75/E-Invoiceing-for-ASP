#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STEP 1 — Install all system packages
# Run once after connecting to the server.
#
# Usage:
#   bash setup/1_install.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

echo ">>> Updating system..."
sudo apt update && sudo apt upgrade -y

echo ">>> Installing Python 3.12..."
sudo apt install -y python3.12 python3.12-venv python3-pip git

echo ">>> Installing PostgreSQL..."
sudo apt install -y postgresql postgresql-contrib

echo ">>> Installing Nginx..."
sudo apt install -y nginx

echo ">>> Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

echo ">>> Installing PM2..."
sudo npm install -g pm2

echo ""
echo "✅ Done. Next: bash setup/2_database.sh"
