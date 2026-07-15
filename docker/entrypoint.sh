#!/bin/bash
# Docker entrypoint for UAE E-Invoicing Django backend.
# Waits for PostgreSQL to be ready, then runs migrations before starting.
set -euo pipefail

echo "==> Waiting for PostgreSQL at ${DB_HOST:-db}:${DB_PORT:-5432}..."
until python -c "
import psycopg2, os, sys
try:
    psycopg2.connect(
        dbname=os.environ.get('DB_NAME', 'einvoicing_db'),
        user=os.environ.get('DB_USER', 'postgres'),
        password=os.environ.get('DB_PASSWORD', 'postgres'),
        host=os.environ.get('DB_HOST', 'db'),
        port=int(os.environ.get('DB_PORT', 5432)),
    )
    sys.exit(0)
except Exception:
    sys.exit(1)
" 2>/dev/null; do
  echo "    Database not ready — retrying in 2s..."
  sleep 2
done
echo "==> Database ready."

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

# ── Verify PDF service ──────────────────────────────────────────────────────
echo "==> Checking PDF service..."
if command -v node &>/dev/null && [ -d "/app/backend/pdf-service/node_modules" ]; then
    echo "    Node.js $(node --version) found."
    echo "    PDF service node_modules present — @react-pdf renderer is available."
else
    echo "    WARNING: PDF service not fully available."
    if ! command -v node &>/dev/null; then
        echo "    Node.js is NOT installed. PDF generation will use xhtml2pdf fallback."
    fi
    if [ ! -d "/app/backend/pdf-service/node_modules" ]; then
        echo "    backend/pdf-service/node_modules not found. PDF generation will use xhtml2pdf fallback."
    fi
    echo "    To fix: rebuild with the updated Dockerfile that includes Node.js."
fi

echo "==> Starting: $*"
exec "$@"
