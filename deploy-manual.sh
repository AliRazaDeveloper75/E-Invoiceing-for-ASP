#!/usr/bin/env bash
# ─── Manual production deploy ────────────────────────────────────────────────
# Usage on the server:
#   cd ~/E-Invoiceing-for-ASP
#   bash deploy-manual.sh              # rebuild frontend only (default)
#   bash deploy-manual.sh backend      # rebuild backend + run migrations
#   bash deploy-manual.sh all          # rebuild everything
set -euo pipefail

COMPOSE="docker compose -f docker/docker-compose.prod.yml"
TARGET="${1:-frontend}"

echo "==> Pulling latest code from main"
git fetch origin main
git reset --hard origin/main

if [ "$TARGET" = "backend" ] || [ "$TARGET" = "all" ]; then
  echo "==> Rebuilding backend"
  $COMPOSE up -d --build --no-deps backend
  echo "==> Running migrations"
  $COMPOSE exec -T backend python manage.py migrate --noinput
  echo "==> Collecting static files"
  $COMPOSE exec -T backend python manage.py collectstatic --noinput
  echo "==> Restarting Celery workers"
  $COMPOSE up -d --build --no-deps celery-worker celery-beat
fi

if [ "$TARGET" = "frontend" ] || [ "$TARGET" = "all" ]; then
  echo "==> Rebuilding frontend"
  $COMPOSE up -d --build --no-deps frontend
fi

echo "==> Reloading nginx"
$COMPOSE exec -T nginx nginx -s reload

echo "==> Health check"
sleep 5
STATUS=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 https://e-numerak.com || echo "000")
echo "Frontend status: $STATUS"
API=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 10 https://api.e-numerak.com/health/ || echo "000")
echo "API status: $API"

if [ "$STATUS" = "200" ]; then
  echo "✅ Deploy complete — site is live"
else
  echo "⚠️  Frontend returned $STATUS — check: $COMPOSE logs --tail=40 frontend"
fi
