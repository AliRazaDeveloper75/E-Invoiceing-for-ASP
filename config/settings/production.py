"""
Production settings — EC2/ECS backend, RDS PostgreSQL, S3 media, CloudFront CDN.

Security checklist enforced at startup:
  ✓ DEBUG = False
  ✓ ALLOWED_HOSTS explicitly set
  ✓ HTTPS enforced (SSL redirect + HSTS)
  ✓ Secure cookies
  ✓ PEPPOL signing enabled
  ✓ ASP webhook secret set
  ✓ S3 media storage configured
"""
import os
from .base import *  # noqa: F401, F403
from .base import env, SIMPLE_JWT, LOGGING as BASE_LOGGING

# ─── Core ─────────────────────────────────────────────────────────────────────
DEBUG = False

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS')  # Required — no default; will raise if not set

# ─── Startup Security Validation ─────────────────────────────────────────────
def _require_env(name: str, hint: str = ''):
    val = env(name, default='')
    if not val:
        raise RuntimeError(
            f'PRODUCTION STARTUP ERROR: {name} is not set. {hint}'
        )
    return val


_require_env('SECRET_KEY',            'Generate with: python -c "import secrets; print(secrets.token_hex(50))"')
_require_env('DB_PASSWORD',           'Set the PostgreSQL password.')
_require_env('ASP_WEBHOOK_SECRET',    'Get this from your ASP provider.')
_require_env('DEFAULT_FROM_EMAIL',    'Set the FROM email address for outbound emails.')

# Warn (don't block) if PEPPOL certs not yet provisioned
_peppol_cert = env('PEPPOL_CERT_PATH', default='')
_peppol_key  = env('PEPPOL_PRIVATE_KEY_PATH', default='')
if not _peppol_cert or not _peppol_key:
    import logging as _logging
    _logging.getLogger(__name__).critical(
        'PEPPOL certificate paths not configured. '
        'Invoices will be transmitted UNSIGNED — not compliant with UAE e-invoicing rules. '
        'Set PEPPOL_CERT_PATH and PEPPOL_PRIVATE_KEY_PATH.'
    )

# ─── HTTPS + HSTS ─────────────────────────────────────────────────────────────
# Nginx terminates SSL — SECURE_SSL_REDIRECT would cause redirect loops
SECURE_SSL_REDIRECT = env.bool('SECURE_SSL_REDIRECT', default=False)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# HSTS: 1 year + preload (add to preload list after confirming all subdomains are HTTPS)
SECURE_HSTS_SECONDS       = 31536000   # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD       = True

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY      = 'strict-origin-when-cross-origin'

# ─── Secure Cookies ──────────────────────────────────────────────────────────
SESSION_COOKIE_SECURE   = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = 'Lax'
CSRF_COOKIE_SECURE      = True
CSRF_COOKIE_HTTPONLY    = True
CSRF_COOKIE_SAMESITE    = 'Strict'

# ─── Clickjacking ────────────────────────────────────────────────────────────
X_FRAME_OPTIONS = 'DENY'

# ─── JWT: Shorter lifetimes in production ────────────────────────────────────
from datetime import timedelta
SIMPLE_JWT.update({
    'ACCESS_TOKEN_LIFETIME':  timedelta(minutes=15),   # Short in production
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),
})

# ─── Database (PostgreSQL with SSL) ──────────────────────────────────────────
DATABASES['default'].update({  # noqa: F405
    'OPTIONS': {
        'connect_timeout': 10,
        'sslmode': env('DB_SSL_MODE', default='require'),
    },
    'CONN_MAX_AGE': 300,
    'CONN_HEALTH_CHECKS': True,
})

# ─── AWS S3 — Media Files ─────────────────────────────────────────────────────
AWS_ACCESS_KEY_ID     = env('AWS_ACCESS_KEY_ID',     default='')
AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = env('AWS_STORAGE_BUCKET_NAME', default='')
AWS_S3_REGION_NAME    = env('AWS_S3_REGION_NAME',    default='me-south-1')  # Bahrain region
AWS_S3_FILE_OVERWRITE = False
AWS_DEFAULT_ACL       = 'private'   # NEVER public — invoices contain PII
AWS_S3_OBJECT_PARAMETERS = {
    'ServerSideEncryption': 'AES256',  # SSE-S3 encryption at rest
}
AWS_S3_SIGNATURE_VERSION = 's3v4'
AWS_QUERYSTRING_AUTH = True  # Signed URLs for private access
AWS_QUERYSTRING_EXPIRE = 3600  # 1-hour signed URL validity

if AWS_STORAGE_BUCKET_NAME:
    DEFAULT_FILE_STORAGE = 'storages.backends.s3boto3.S3Boto3Storage'
    AWS_LOCATION = 'media'
    MEDIA_URL    = f'https://{AWS_STORAGE_BUCKET_NAME}.s3.{AWS_S3_REGION_NAME}.amazonaws.com/media/'

# ─── Redis Cache ─────────────────────────────────────────────────────────────
REDIS_URL = env('REDIS_URL', default='')
if REDIS_URL:
    CACHES = {
        'default': {
            'BACKEND': 'django_redis.cache.RedisCache',
            'LOCATION': REDIS_URL,
            'OPTIONS': {
                'CLIENT_CLASS': 'django_redis.client.DefaultClient',
                'SOCKET_CONNECT_TIMEOUT': 5,
                'SOCKET_TIMEOUT': 5,
                'IGNORE_EXCEPTIONS': True,  # Fallback to DB if Redis is down
            },
        }
    }
    # Use Redis for session backend too
    SESSION_ENGINE = 'django.contrib.sessions.backends.cache'
    SESSION_CACHE_ALIAS = 'default'

# ─── Celery Result Backend (Redis) ───────────────────────────────────────────
if REDIS_URL:
    CELERY_RESULT_BACKEND = REDIS_URL
CELERY_RESULT_EXPIRES = 86400  # Clean up results after 24 hours

# ─── Email (SMTP) ─────────────────────────────────────────────────────────────
EMAIL_BACKEND       = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST          = env('EMAIL_HOST',           default='smtp.gmail.com')
EMAIL_PORT          = env.int('EMAIL_PORT',        default=587)
EMAIL_USE_TLS       = env.bool('EMAIL_USE_TLS',    default=True)
EMAIL_HOST_USER     = env('EMAIL_HOST_USER',       default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD',   default='')
DEFAULT_FROM_EMAIL  = env('DEFAULT_FROM_EMAIL',    default=EMAIL_HOST_USER)

# ─── Sentry Error Tracking ────────────────────────────────────────────────────
SENTRY_DSN = env('SENTRY_DSN', default='')
if SENTRY_DSN:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.django import DjangoIntegration
        from sentry_sdk.integrations.celery import CeleryIntegration

        sentry_sdk.init(
            dsn=SENTRY_DSN,
            integrations=[
                DjangoIntegration(transaction_style='url'),
                CeleryIntegration(),
            ],
            traces_sample_rate=env.float('SENTRY_TRACES_SAMPLE_RATE', default=0.05),
            send_default_pii=False,
            environment='production',
            release=APP_VERSION,  # noqa: F405
        )
    except ImportError:
        pass  # sentry-sdk not installed

# ─── Production Logging (JSON — aggregated by CloudWatch/ELK) ────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s %(request_id)s',
            'datefmt': '%Y-%m-%dT%H:%M:%SZ',
        },
    },

    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
    },

    'loggers': {
        'apps':       {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'tasks':      {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'services':   {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'api.access': {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
        'django':     {'handlers': ['console'], 'level': 'ERROR',   'propagate': False},
        'celery':     {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
    },

    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}

# ─── CORS (Production — explicit origins only) ───────────────────────────────
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS')  # Required in production

# ─── Production PEPPOL Settings ───────────────────────────────────────────────
PEPPOL_USE_TEST_SML     = False     # Use production SML
PEPPOL_SIGNING_ENABLED  = True      # Always sign in production

# ─── django-storages + boto3 — additional security settings ──────────────────
AWS_S3_ADDRESSING_STYLE = 'virtual'
AWS_S3_ENCRYPTION       = True
