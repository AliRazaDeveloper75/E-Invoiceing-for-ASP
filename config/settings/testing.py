"""
Testing settings — used by CI and local test runs.
Fast: no migrations for third-party apps, in-memory cache, synchronous Celery.
"""
from .base import *  # noqa: F401, F403

DEBUG = False

SECRET_KEY = 'testing-secret-key-not-for-production'

ALLOWED_HOSTS = ['localhost', '127.0.0.1', 'testserver']

# ─── Password Hashing ─────────────────────────────────────────────────────────
# Fast hasher — never use MD5 outside tests
PASSWORD_HASHERS = ['django.contrib.auth.hashers.MD5PasswordHasher']

# ─── Email ────────────────────────────────────────────────────────────────────
EMAIL_BACKEND = 'django.core.mail.backends.locmem.EmailBackend'
DEFAULT_FROM_EMAIL = 'noreply@test.example.com'

# ─── Celery — run tasks synchronously in tests ────────────────────────────────
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_BROKER_URL = 'memory://'
CELERY_RESULT_BACKEND = 'cache+memory://'

# ─── Cache — in-memory (no Redis required) ───────────────────────────────────
CACHES = {
    'default': {
        'BACKEND': 'django.core.cache.backends.locmem.LocMemCache',
    }
}

# ─── Media storage — temp dir ─────────────────────────────────────────────────
import tempfile
MEDIA_ROOT = tempfile.mkdtemp()

# ─── PEPPOL — disable in tests ────────────────────────────────────────────────
PEPPOL_SIGNING_ENABLED = False
PEPPOL_XSD_VALIDATION_ENABLED = False

# ─── Security (relaxed for tests) ────────────────────────────────────────────
ASP_WEBHOOK_SECRET = 'test-webhook-secret'
CORS_ALLOW_ALL_ORIGINS = True

# ─── Logging — suppress noise ─────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': True,
    'handlers': {'null': {'class': 'logging.NullHandler'}},
    'root': {'handlers': ['null']},
}
