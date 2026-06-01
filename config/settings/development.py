"""
Development settings — debug mode, relaxed security, SQL logging.

Set USE_SQLITE=true in .env (or environment) to use the built-in SQLite
database instead of PostgreSQL. No installation required.
"""
from .base import *  # noqa: F401, F403
import os

DEBUG = True

# ─── Database ─────────────────────────────────────────────────────────────────
# Default: use SQLite for zero-config local development.
# Set USE_SQLITE=false in .env to use PostgreSQL instead.
if os.environ.get('USE_SQLITE', 'true').lower() != 'false':
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',  # noqa: F405
        }
    }

# Allow all origins in development
CORS_ALLOW_ALL_ORIGINS = True

# ─── Email ────────────────────────────────────────────────────────────────────
# Console backend by default — prints emails to terminal instead of SMTP.
# Override in .env with EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
# to test real SMTP delivery during development.
EMAIL_BACKEND       = env('EMAIL_BACKEND',    default='django.core.mail.backends.console.EmailBackend')
EMAIL_HOST          = env('EMAIL_HOST',       default='smtp.hostinger.com')
EMAIL_PORT          = env.int('EMAIL_PORT',   default=587)
EMAIL_USE_TLS       = env.bool('EMAIL_USE_TLS',  default=True)
EMAIL_USE_SSL       = env.bool('EMAIL_USE_SSL',  default=False)
EMAIL_HOST_USER     = env('EMAIL_HOST_USER',  default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = env('DEFAULT_FROM_EMAIL',  default='noreply@e-numerak.ae')
FRONTEND_URL     = env('FRONTEND_URL',    default='http://localhost:3000')
BACKEND_URL      = env('BACKEND_URL',     default='http://localhost:8000')

# Show detailed errors (only if debug_toolbar is installed)
try:
    import debug_toolbar  # noqa: F401
    INSTALLED_APPS += ['debug_toolbar']  # noqa: F405
    MIDDLEWARE += ['debug_toolbar.middleware.DebugToolbarMiddleware']  # noqa: F405
    INTERNAL_IPS = ['127.0.0.1']
except ImportError:
    pass

# Log all SQL queries to console
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '[{levelname}] {asctime} {module}: {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': 'INFO',
        },
        'django.server': {
            'handlers': ['console'],
            'level': 'INFO',   # Shows every HTTP request line in the terminal
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Shows every SQL query
            'propagate': False,
        },
        'api.access': {
            'handlers': ['console'],
            'level': 'INFO',   # Structured JSON access log from RequestLoggingMiddleware
            'propagate': False,
        },
        'apps': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
        'services': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
        'tasks': {
            'handlers': ['console'],
            'level': 'DEBUG',
        },
    },
}
