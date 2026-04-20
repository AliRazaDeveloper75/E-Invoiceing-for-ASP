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
EMAIL_BACKEND    = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST       = env('EMAIL_HOST',      default='smtp.gmail.com')
EMAIL_PORT       = env.int('EMAIL_PORT',  default=587)
EMAIL_USE_TLS    = env.bool('EMAIL_USE_TLS', default=True)
EMAIL_HOST_USER  = env('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = env('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL  = env('DEFAULT_FROM_EMAIL', default=EMAIL_HOST_USER)
FRONTEND_URL     = env('FRONTEND_URL',    default='http://localhost:3000')

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
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',  # Shows every SQL query
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
