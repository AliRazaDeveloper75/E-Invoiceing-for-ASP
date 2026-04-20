#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# UPDATE — Pull latest code from GitHub and redeploy
# Run this every time you push new code to GitHub.
#
# Usage:
#   bash setup/update.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo ">>> Pulling latest code from GitHub..."
git pull origin main

echo ">>> Activating virtualenv..."
source venv/bin/activate
export DJANGO_SETTINGS_MODULE=config.settings.production

echo ">>> Installing any new Python packages..."
pip install -r requirements.txt -q

echo ">>> Running migrations..."
python manage.py migrate --noinput

echo ">>> Collecting static files..."
python manage.py collectstatic --noinput

echo ">>> Restarting Django backend..."
sudo systemctl restart einvoicing-backend

echo ">>> Rebuilding Next.js frontend..."
cd "$PROJECT_DIR/frontend"
npm install --silent
npm run build

echo ">>> Restarting frontend..."
pm2 restart einvoicing-frontend

echo ""
echo "✅ Update complete!"
sudo systemctl status einvoicing-backend --no-pager
pm2 status
