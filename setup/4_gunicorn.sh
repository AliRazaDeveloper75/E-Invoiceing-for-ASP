#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STEP 4 — Install Gunicorn as a systemd service
# Copies einvoicing-backend.service to /etc/systemd/system/ and starts it.
#
# Usage:
#   bash setup/4_gunicorn.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SERVICE_SRC="$PROJECT_DIR/setup/einvoicing-backend.service"
SERVICE_DEST="/etc/systemd/system/einvoicing-backend.service"

echo ">>> Installing Gunicorn systemd service..."

# Replace placeholder path in service file with actual project dir
sed "s|/home/ubuntu/einvoicing|$PROJECT_DIR|g" "$SERVICE_SRC" | sudo tee "$SERVICE_DEST" > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable einvoicing-backend
sudo systemctl restart einvoicing-backend

echo ""
sudo systemctl status einvoicing-backend --no-pager
echo ""
echo "✅ Gunicorn running on 127.0.0.1:8000"
echo ""
echo "Next: bash setup/5_frontend.sh"
