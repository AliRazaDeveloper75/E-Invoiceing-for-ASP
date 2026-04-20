#!/bin/sh
# Docker entrypoint for the Django backend and Celery workers.
# Waits for PostgreSQL to be ready, then runs migrations before starting.
set -e

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

echo "==> Starting: $*"
exec "$@"
