"""
Prometheus request metrics middleware.

Records per-request HTTP metrics (count, latency) broken down by:
  - HTTP method (GET, POST, etc.)
  - Endpoint group (normalised path to prevent cardinality explosion)
  - HTTP status code

Endpoint normalisation:
  /api/invoices/a1b2-c3d4/submit → /api/invoices/{id}/submit
  /api/invoices/123/             → /api/invoices/{id}/

This avoids thousands of unique label combinations from UUID/PK paths.

Integration:
  Add to MIDDLEWARE in settings *before* Django's CommonMiddleware:

    MIDDLEWARE = [
        'monitoring.middleware.PrometheusRequestMiddleware',
        ...
    ]
"""
import re
import time

from .prometheus import metrics

# ─── Path normalisation rules ─────────────────────────────────────────────────

_UUID_RE = re.compile(
    r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
    re.IGNORECASE,
)
_INT_ID_RE  = re.compile(r'/\d+(?=/|$)')
_HASH_RE    = re.compile(r'[0-9a-f]{32,}', re.IGNORECASE)


def _normalise_path(path: str) -> str:
    """Collapse dynamic path segments into placeholders."""
    path = _UUID_RE.sub('{id}', path)
    path = _INT_ID_RE.sub('/{id}', path)
    path = _HASH_RE.sub('{hash}', path)
    # Collapse consecutive separators
    path = re.sub(r'/{2,}', '/', path)
    return path


# ─── Middleware ───────────────────────────────────────────────────────────────

class PrometheusRequestMiddleware:
    """
    WSGI middleware that records HTTP request metrics into Prometheus.

    Compatible with Django's MiddlewareMixin contract (supports both
    sync and async Django views via Django's ASGIHandler wrapper).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        response = self.get_response(request)
        duration = time.monotonic() - start

        method   = request.method or 'UNKNOWN'
        endpoint = _normalise_path(request.path_info or '/')
        status   = str(response.status_code)

        metrics.http_requests.labels(
            method=method,
            endpoint=endpoint,
            status_code=status,
        ).inc()

        metrics.http_request_time.labels(
            method=method,
            endpoint=endpoint,
        ).observe(duration)

        return response
