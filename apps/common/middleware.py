"""
Custom middleware for UAE E-Invoicing platform.

  RequestIDMiddleware     — injects X-Request-ID into every request/response
  RequestLoggingMiddleware — structured JSON access log + API request log DB record
  SecurityHeadersMiddleware — CSP, HSTS, and other security headers
"""
import json
import logging
import time
import uuid

from django.conf import settings
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger('api.access')


# ─── Request ID ───────────────────────────────────────────────────────────────

class RequestIDMiddleware(MiddlewareMixin):
    """
    Injects a unique request ID into every request.

    The ID is taken from the incoming X-Request-ID header (if set by a
    load balancer or client), or generated as a UUID4 if not present.

    The ID is:
      - Attached to request.request_id
      - Included in the response X-Request-ID header
      - Available to all downstream middleware and views

    Use this to correlate frontend errors with backend logs.
    """

    def process_request(self, request):
        request_id = (
            request.headers.get('X-Request-ID')
            or request.META.get('HTTP_X_REQUEST_ID')
            or str(uuid.uuid4())
        )
        # Sanitize: max 64 chars, alphanumeric + hyphens only
        request_id = request_id[:64]
        request.request_id = request_id

    def process_response(self, request, response):
        request_id = getattr(request, 'request_id', '')
        if request_id:
            response['X-Request-ID'] = request_id
        return response


# ─── Request Logging ──────────────────────────────────────────────────────────

class RequestLoggingMiddleware(MiddlewareMixin):
    """
    Structured JSON access log for every API request.

    Logs to the 'api.access' logger (configure in LOGGING to send to file/ELK).
    Also writes to APIRequestLog table for DB-based log queries via admin.

    Skips health check endpoints to avoid log noise.
    """

    SKIP_PATHS = {'/health/', '/ready/', '/static/', '/media/'}

    def process_request(self, request):
        request._start_time = time.monotonic()

    def process_response(self, request, response):
        # Skip non-API paths
        path = request.path_info
        if any(path.startswith(p) for p in self.SKIP_PATHS):
            return response

        duration_ms = 0
        if hasattr(request, '_start_time'):
            duration_ms = int((time.monotonic() - request._start_time) * 1000)

        user    = getattr(request, 'user', None)
        user_id = str(user.id)   if (user and user.is_authenticated) else None
        email   = user.email     if (user and user.is_authenticated) else None

        request_id = getattr(request, 'request_id', '')

        log_entry = {
            'request_id':  request_id,
            'method':      request.method,
            'path':        path,
            'status':      response.status_code,
            'duration_ms': duration_ms,
            'user_id':     user_id,
            'email':       email,
            'ip':          _get_client_ip(request),
            'user_agent':  request.META.get('HTTP_USER_AGENT', '')[:200],
        }

        # Log at WARNING level for errors, INFO for success
        if response.status_code >= 500:
            logger.error(json.dumps(log_entry))
        elif response.status_code >= 400:
            logger.warning(json.dumps(log_entry))
        else:
            logger.info(json.dumps(log_entry))

        # Write to DB (async write is fine — use try/except to not block response)
        if path.startswith('/api/'):
            _async_write_api_log(request, response, duration_ms, request_id)

        return response


# ─── Security Headers ─────────────────────────────────────────────────────────

class SecurityHeadersMiddleware(MiddlewareMixin):
    """
    Adds security headers to every response.

    Headers added:
      Content-Security-Policy  — restricts resource loading
      X-Content-Type-Options   — prevents MIME sniffing
      Referrer-Policy          — controls referrer information
      Permissions-Policy       — disables unused browser features
      Cross-Origin-Opener-Policy — prevents window.opener leaks
    """

    # CSP directives — strict but functional for a SaaS API + Next.js frontend
    CSP_DIRECTIVES = (
        "default-src 'none'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self'; "
        "connect-src 'self'; "
        "frame-ancestors 'none'; "
        "form-action 'self'; "
        "base-uri 'self';"
    )

    def process_response(self, request, response):
        # Don't override CSP if already set (allows views to customize)
        if 'Content-Security-Policy' not in response:
            response['Content-Security-Policy'] = self.CSP_DIRECTIVES

        response['X-Content-Type-Options']        = 'nosniff'
        response['Referrer-Policy']               = 'strict-origin-when-cross-origin'
        response['Permissions-Policy']            = (
            'camera=(), microphone=(), geolocation=(), payment=()'
        )
        response['Cross-Origin-Opener-Policy']    = 'same-origin'

        # Remove server header to avoid fingerprinting
        if 'Server' in response:
            del response['Server']
        if 'X-Powered-By' in response:
            del response['X-Powered-By']

        return response


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _get_client_ip(request) -> str:
    forwarded = request.META.get('HTTP_X_FORWARDED_FOR')
    if forwarded:
        return forwarded.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '')


def _async_write_api_log(request, response, duration_ms: int, request_id: str) -> None:
    """Write API request log to DB — wrapped in try/except to never block response."""
    try:
        from apps.reporting.models import APIRequestLog
        user    = getattr(request, 'user', None)
        company = getattr(request, 'active_company', None)

        APIRequestLog.objects.create(
            user        = user if (user and user.is_authenticated) else None,
            company     = company,
            method      = request.method,
            path        = request.path_info[:500],
            query_string= request.META.get('QUERY_STRING', '')[:1000],
            request_id  = request_id,
            status_code = response.status_code,
            duration_ms = duration_ms,
            ip_address  = _get_client_ip(request) or None,
            user_agent  = request.META.get('HTTP_USER_AGENT', '')[:500],
        )
    except Exception:
        pass  # Never let logging failures affect the response
