"""
Health check and readiness probe endpoints.

  GET /health/  — liveness probe (is the app running?)
  GET /ready/   — readiness probe (can it serve traffic?)

Used by:
  - Docker HEALTHCHECK
  - Kubernetes liveness/readiness probes
  - Load balancer health checks (AWS ALB, nginx upstream checks)
  - Monitoring systems (Datadog, UptimeRobot, Pingdom)

/health/ — fast, never fails (just proves the process is alive)
/ready/  — checks DB, cache, and Celery broker connectivity
           Returns 503 if any dependency is unhealthy
"""
import time
import logging

from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django.db import connection, OperationalError as DBOperationalError

logger = logging.getLogger(__name__)


class HealthCheckView(View):
    """
    GET /health/

    Lightweight liveness probe.
    Returns 200 immediately — just proves the Django process is alive.
    Never touches database or external services.
    """

    def get(self, request):
        return JsonResponse({
            'status': 'healthy',
            'service': 'uae-einvoicing-api',
            'version': getattr(settings, 'APP_VERSION', '1.0.0'),
        }, status=200)


class ReadinessCheckView(View):
    """
    GET /ready/

    Readiness probe — checks all critical dependencies.
    Returns 200 only when ALL checks pass.
    Returns 503 with details when any check fails.

    Checks:
      1. PostgreSQL database connectivity
      2. Redis cache connectivity (if configured)
      3. Celery broker connectivity (RabbitMQ/Redis)
    """

    def get(self, request):
        checks = {}
        all_healthy = True
        start = time.monotonic()

        # ── 1. Database ───────────────────────────────────────────────────────
        db_ok, db_detail = _check_database()
        checks['database'] = {'status': 'ok' if db_ok else 'error', 'detail': db_detail}
        if not db_ok:
            all_healthy = False

        # ── 2. Cache (Redis) ──────────────────────────────────────────────────
        cache_ok, cache_detail = _check_cache()
        checks['cache'] = {'status': 'ok' if cache_ok else 'error', 'detail': cache_detail}
        if not cache_ok:
            # Cache failure is a warning, not a hard block
            logger.warning('Readiness: cache check failed: %s', cache_detail)

        # ── 3. Celery Broker ──────────────────────────────────────────────────
        broker_ok, broker_detail = _check_celery_broker()
        checks['celery_broker'] = {'status': 'ok' if broker_ok else 'error', 'detail': broker_detail}
        if not broker_ok:
            all_healthy = False

        elapsed_ms = round((time.monotonic() - start) * 1000, 2)

        response_data = {
            'status': 'ready' if all_healthy else 'not_ready',
            'checks': checks,
            'elapsed_ms': elapsed_ms,
        }

        http_status = 200 if all_healthy else 503
        if not all_healthy:
            logger.error('Readiness check failed: %s', checks)

        return JsonResponse(response_data, status=http_status)


# ─── Individual Check Functions ───────────────────────────────────────────────

def _check_database() -> tuple[bool, str]:
    """Verify PostgreSQL is reachable with a cheap query."""
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        return True, 'connected'
    except DBOperationalError as exc:
        return False, f'database error: {exc}'
    except Exception as exc:
        return False, f'unexpected error: {exc}'


def _check_cache() -> tuple[bool, str]:
    """Verify Redis cache is reachable (if Django cache backend is Redis)."""
    try:
        from django.core.cache import cache
        test_key = '_readiness_probe_'
        cache.set(test_key, '1', timeout=5)
        val = cache.get(test_key)
        if val != '1':
            return False, 'cache write/read mismatch'
        cache.delete(test_key)
        return True, 'connected'
    except Exception as exc:
        return False, f'cache error: {exc}'


def _check_celery_broker() -> tuple[bool, str]:
    """Verify Celery broker (RabbitMQ/Redis) is reachable."""
    try:
        from celery import current_app
        conn = current_app.connection_for_read()
        conn.ensure_connection(max_retries=1, timeout=3)
        conn.close()
        return True, 'connected'
    except Exception as exc:
        return False, f'broker error: {exc}'
