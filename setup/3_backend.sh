#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STEP 3 — Set up Django backend (venv, migrate, collectstatic)
# Run from the project root: /home/ubuntu/einvoicing
#
# Usage:
#   bash setup/3_backend.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo ">>> Project dir: $PROJECT_DIR"

# Patch production.py to disable SSL redirect (no HTTPS yet)
echo ">>> Disabling SSL redirect for HTTP-only setup..."
sed -i 's/SECURE_SSL_REDIRECT = True/SECURE_SSL_REDIRECT = False/' config/settings/production.py
sed -i 's/SESSION_COOKIE_SECURE = True/SESSION_COOKIE_SECURE = False/' config/settings/production.py
sed -i 's/CSRF_COOKIE_SECURE = True/CSRF_COOKIE_SECURE = False/' config/settings/production.py

echo ">>> Creating Python virtualenv..."
python3.12 -m venv venv
source venv/bin/activate

echo ">>> Installing Python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

echo ">>> Running database migrations..."
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py migrate

echo ">>> Collecting static files..."
python manage.py collectstatic --noinput

echo ">>> Creating logs directory..."
mkdir -p logs

echo ""
echo "✅ Backend ready."
echo ""
echo "Create a superuser (admin login):"
echo "  source venv/bin/activate && python manage.py createsuperuser"
echo ""
echo "Next: bash setup/4_gunicorn.sh"
