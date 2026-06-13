"""
Base settings — shared across all environments.
All environment-specific settings override these in development.py / production.py
"""
import environ
from pathlib import Path
from datetime import timedelta

# ─── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent.parent

# ─── Environment ──────────────────────────────────────────────────────────────
env = environ.Env()
_dot_env = BASE_DIR / '.env'
if _dot_env.exists():
    environ.Env.read_env(_dot_env)

# ─── Core ─────────────────────────────────────────────────────────────────────
SECRET_KEY = env('SECRET_KEY')
ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

# ─── Installed Apps ───────────────────────────────────────────────────────────
DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'rest_framework_simplejwt',
    'rest_framework_simplejwt.token_blacklist',  # Required for logout (token blacklisting)
    'corsheaders',
]

LOCAL_APPS = [
    'apps.accounts',
    'apps.companies',
    'apps.customers',
    'apps.invoices',
    'apps.taxes',
    'apps.integrations',
    'apps.common',
    'apps.inbound',
    'apps.admin_panel',
    'apps.chat',
    'apps.buyers',
    'apps.payments',
    'apps.reporting',
    'apps.ai_ocr',
    'apps.onboarding',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# ─── Middleware ───────────────────────────────────────────────────────────────
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',            # Must be before CommonMiddleware
    'monitoring.middleware.PrometheusRequestMiddleware', # Request count + latency metrics
    'apps.common.middleware.RequestIDMiddleware',       # Inject X-Request-ID early
    'apps.common.middleware.RequestLoggingMiddleware',  # Structured access log
    'apps.common.middleware.SecurityHeadersMiddleware', # CSP + security headers
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

# ─── Database ─────────────────────────────────────────────────────────────────
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': env('DB_NAME', default='einvoicing_db'),
        'USER': env('DB_USER', default='postgres'),
        'PASSWORD': env('DB_PASSWORD', default=''),
        'HOST': env('DB_HOST', default='localhost'),
        'PORT': env('DB_PORT', default='5432'),
        'OPTIONS': {
            'connect_timeout': 10,
        },
        'CONN_MAX_AGE': 60,  # Persistent connections
    }
}

# ─── Custom User Model ────────────────────────────────────────────────────────
# Defined in apps/accounts — must be set before first migration
AUTH_USER_MODEL = 'accounts.User'

# ─── Password Validation ──────────────────────────────────────────────────────
AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator'},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

# ─── Localization ─────────────────────────────────────────────────────────────
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Dubai'    # UAE: UTC+4, no DST
USE_I18N = True
USE_TZ = True

# ─── Static & Media ───────────────────────────────────────────────────────────
STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'    # XML files, PDFs stored here

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

# ─── Django REST Framework ────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'apps.common.utils.StandardResultsPagination',
    'PAGE_SIZE': 20,
    'DEFAULT_RENDERER_CLASSES': [
        'rest_framework.renderers.JSONRenderer',
    ],
    'EXCEPTION_HANDLER': 'apps.common.utils.custom_exception_handler',
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle',
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon':           '100/hour',
        'user':           '1000/hour',
        'login':          '10/15min',
        'mfa_verify':     '5/5min',
        'otp_verify':     '5/5min',
        'password_reset': '3/hour',
        'register':       '5/hour',
    },
}

# ─── JWT (SimpleJWT) ──────────────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=env.int('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', default=60)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=env.int('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7)
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
    'AUTH_HEADER_TYPES': ('Bearer',),
    'USER_ID_FIELD': 'id',
    'USER_ID_CLAIM': 'user_id',
    'TOKEN_OBTAIN_SERIALIZER': 'apps.accounts.serializers.CustomTokenObtainPairSerializer',
}

# ─── Celery / RabbitMQ ────────────────────────────────────────────────────────
CELERY_BROKER_URL = env('CELERY_BROKER_URL', default='amqp://guest:guest@localhost:5672//')
CELERY_RESULT_BACKEND = env('CELERY_RESULT_BACKEND', default='rpc://')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE = 'Asia/Dubai'
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_MAX_RETRIES = 3
CELERY_TASK_DEFAULT_RETRY_DELAY = 60   # seconds between retries

# Named queues — workers can subscribe to specific queues
CELERY_TASK_QUEUES = {
    'invoice_processing': {
        'exchange':    'invoice_processing',
        'routing_key': 'invoice_processing',
    },
    'peppol_transmission': {
        'exchange':    'peppol_transmission',
        'routing_key': 'peppol_transmission',
    },
    'fta_reporting': {
        'exchange':    'fta_reporting',
        'routing_key': 'fta_reporting',
    },
    'cert_monitoring': {
        'exchange':    'cert_monitoring',
        'routing_key': 'cert_monitoring',
    },
    'celery': {
        'exchange':    'celery',
        'routing_key': 'celery',
    },
    'ocr_processing': {
        'exchange':    'ocr_processing',
        'routing_key': 'ocr_processing',
    },
    'fraud_analysis': {
        'exchange':    'fraud_analysis',
        'routing_key': 'fraud_analysis',
    },
}
CELERY_TASK_DEFAULT_QUEUE = 'celery'

# ─── Celery Beat (Periodic Tasks) ────────────────────────────────────────────
from celery.schedules import crontab

CELERY_BEAT_SCHEDULE = {
    # Every 15 min: re-queue invoices stuck in PENDING
    'retry-stuck-pending-invoices': {
        'task':     'tasks.invoice_tasks.retry_failed_transmissions',
        'schedule': crontab(minute='*/15'),
        'options':  {'queue': 'invoice_processing'},
    },
    # Every 5 min: poll ASP for SUBMITTED invoice status updates
    'poll-submitted-invoices': {
        'task':     'tasks.invoice_tasks.poll_submitted_invoices',
        'schedule': crontab(minute='*/5'),
        'options':  {'queue': 'invoice_processing'},
    },
    # Every 15 min: retry failed AS4 PEPPOL transmissions
    'retry-failed-as4-transmissions': {
        'task':     'tasks.as4_tasks.retry_failed_as4_transmissions',
        'schedule': crontab(minute='*/15'),
        'options':  {'queue': 'peppol_transmission'},
    },
    # Every 10 min: check for AS4 messages without MDN (delivery timeout)
    'verify-pending-deliveries': {
        'task':     'tasks.mdn_tasks.verify_pending_deliveries',
        'schedule': crontab(minute='*/10'),
        'options':  {'queue': 'peppol_transmission'},
    },
    # Daily at 08:00 UAE (04:00 UTC): check PEPPOL certificate expiry
    'check-peppol-certificates': {
        'task':     'tasks.cert_tasks.check_peppol_certificates',
        'schedule': crontab(hour=4, minute=0),   # 08:00 GST = 04:00 UTC
        'options':  {'queue': 'cert_monitoring'},
    },
    # Hourly: DB cert OCSP validation + Prometheus gauge refresh
    'check-db-certificate-records': {
        'task':     'tasks.cert_tasks.check_db_certificate_records',
        'schedule': crontab(minute=0),
        'options':  {'queue': 'cert_monitoring'},
    },
    # Every 30 min: re-queue failed FTA reports
    'retry-failed-fta-reports': {
        'task':     'tasks.fta_tasks.retry_failed_fta_reports',
        'schedule': crontab(minute='*/30'),
        'options':  {'queue': 'fta_reporting'},
    },
    # Hourly: scan recent invoices for fraud anomalies
    'fraud-scan-recent-invoices': {
        'task':     'tasks.fraud_tasks.scan_recent_invoices',
        'schedule': crontab(minute=0),
        'options':  {'queue': 'fraud_analysis'},
    },
}

# ─── CORS ─────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list(
    'CORS_ALLOWED_ORIGINS',
    default=['http://localhost:3000']
)
CORS_ALLOW_CREDENTIALS = True

# ─── UAE E-Invoicing / ASP Integration ───────────────────────────────────────
ASP_API_BASE_URL = env('ASP_API_BASE_URL', default='https://mock-asp.example.com/api/v1')
ASP_API_KEY = env('ASP_API_KEY', default='')
ASP_TIMEOUT_SECONDS = env.int('ASP_TIMEOUT_SECONDS', default=30)

# ─── UAE VAT Configuration ────────────────────────────────────────────────────
UAE_VAT_RATE = 0.05          # 5% standard rate
UAE_VAT_ZERO_RATE = 0.00     # 0% for eligible exports
UAE_VAT_EXEMPT = None        # None = exempt (no VAT)

# ─── Frontend URL ─────────────────────────────────────────────────────────────
FRONTEND_URL = env('FRONTEND_URL', default='http://localhost:3000')

# ─── Payment Gateways ─────────────────────────────────────────────────────────
STRIPE_SECRET_KEY = env('STRIPE_SECRET_KEY', default='')
STRIPE_PUBLISHABLE_KEY = env('STRIPE_PUBLISHABLE_KEY', default='')
STRIPE_WEBHOOK_SECRET = env('STRIPE_WEBHOOK_SECRET', default='')
PAYPAL_CLIENT_ID = env('PAYPAL_CLIENT_ID', default='')
PAYPAL_CLIENT_SECRET = env('PAYPAL_CLIENT_SECRET', default='')
PAYPAL_SANDBOX = env.bool('PAYPAL_SANDBOX', default=True)

# ─── PEPPOL / ASP Certificate & Schema Configuration ─────────────────────────
# Directory containing downloaded PEPPOL BIS 3.0 XSD + Schematron schemas.
# Populate via: python manage.py download_peppol_schemas (or scripts/download_schemas.sh)
PEPPOL_SCHEMA_DIR = env('PEPPOL_SCHEMA_DIR', default=str(BASE_DIR / 'schemas' / 'peppol'))

# PKI paths — populated with real certs in production from /etc/peppol/
#
# Two ways to provide the AP signing credentials:
#   (A) PKCS#12 keystore (recommended — single .p12 file from the PEPPOL portal):
#         PEPPOL_KEYSTORE_PATH=/etc/peppol/ap-test.p12
#         PEPPOL_KEYSTORE_PASSWORD=<the .p12 password>
#   (B) Separate PEM files (cert + unencrypted private key):
#         PEPPOL_CERT_PATH=/etc/peppol/cert.pem
#         PEPPOL_PRIVATE_KEY_PATH=/etc/peppol/key.pem
# If a keystore is configured it takes precedence over the PEM paths.
PEPPOL_KEYSTORE_PATH     = env('PEPPOL_KEYSTORE_PATH',     default='')
PEPPOL_KEYSTORE_PASSWORD = env('PEPPOL_KEYSTORE_PASSWORD', default='')
PEPPOL_CERT_PATH         = env('PEPPOL_CERT_PATH',         default='')
PEPPOL_PRIVATE_KEY_PATH  = env('PEPPOL_PRIVATE_KEY_PATH',  default='')
PEPPOL_CA_CERT_PATH      = env('PEPPOL_CA_CERT_PATH',      default='')

# Certificate expiry warning threshold (days before expiry to start alerting)
PEPPOL_CERT_EXPIRY_WARNING_DAYS = env.int('PEPPOL_CERT_EXPIRY_WARNING_DAYS', default=30)

# Enable XML digital signing (default True — PEPPOL and UAE FTA require signatures)
# Set PEPPOL_SIGNING_ENABLED=False in .env ONLY for local development without certs.
PEPPOL_SIGNING_ENABLED = env.bool('PEPPOL_SIGNING_ENABLED', default=True)

# Reject inbound AS4 messages whose signer certificate is not trusted (does not
# chain to the OpenPEPPOL PKI, is expired, or is revoked). Required by the
# network rules; only disable for isolated local testing.
PEPPOL_AS4_VERIFY_SIGNER_TRUST = env.bool('PEPPOL_AS4_VERIFY_SIGNER_TRUST', default=True)

# PINT-AE validation artifact version (label). 1.0.4 → schemas/peppol/pint-ae/2026.5.
PINT_AE_VERSION = env('PINT_AE_VERSION', default='1.0.4')

# Enable PEPPOL XSD schema validation (can disable in dev if schemas not yet downloaded)
PEPPOL_XSD_VALIDATION_ENABLED = env.bool('PEPPOL_XSD_VALIDATION_ENABLED', default=True)

# Capture raw inbound AS4 messages to MEDIA_ROOT/as4_debug/ for analysis
# (enable temporarily during PEPPOL Testbed certification).
PEPPOL_AS4_DEBUG_CAPTURE = env.bool('PEPPOL_AS4_DEBUG_CAPTURE', default=False)

# When True, inbound AS4 verification also fails on any reference-digest mismatch.
# Kept False during initial certification (SignedInfo RSA signature is the gate);
# flip to True once digest c14n is confirmed against the Testbed.
PEPPOL_AS4_STRICT_DIGESTS = env.bool('PEPPOL_AS4_STRICT_DIGESTS', default=False)

# Allow large AS4 payloads (Testbed sends 10MB+ files — TC2A.5B).
# 20 MB ceiling for the raw request body.
DATA_UPLOAD_MAX_MEMORY_SIZE = env.int('DATA_UPLOAD_MAX_MEMORY_SIZE', default=20 * 1024 * 1024)
FILE_UPLOAD_MAX_MEMORY_SIZE = env.int('FILE_UPLOAD_MAX_MEMORY_SIZE', default=20 * 1024 * 1024)

# SMP lookup base URL (production: https://b2bi.peppol.eu — UAE ASP will provide)
PEPPOL_SMP_BASE_URL = env('PEPPOL_SMP_BASE_URL', default='')
# True = use PEPPOL test SML (acc.edelivery.tech.ec.europa.eu), False = production
PEPPOL_USE_TEST_SML = env.bool('PEPPOL_USE_TEST_SML', default=True)
# Explicit SML/SMK DNS zone override (e.g. the Testbed SMK). Empty = use the
# test/production default above.
PEPPOL_SML_ZONE = env('PEPPOL_SML_ZONE', default='')
# SMP cache TTL in hours (0 = disable caching)
PEPPOL_SMP_CACHE_TTL_HOURS = env.int('PEPPOL_SMP_CACHE_TTL_HOURS', default=24)

# Our Peppol Service Provider ID (C3) — used as the MLS SBDH Sender and the
# ApplicationResponse SenderParty. Per the eDEC MLS Schematron it MUST be a
# Peppol SPID: schemeID '0242' + a 6-digit value (optionally suffixed),
# e.g. '0242:001147' for AP seat PAE001147. NOT the business participant.
PEPPOL_SP_ID = env('PEPPOL_SP_ID', default='0242:001147')

# Admin email(s) to notify on certificate expiry
PEPPOL_ALERT_EMAILS = env.list('PEPPOL_ALERT_EMAILS', default=[])

# ─── PEPPOL Sandbox / TestNet ─────────────────────────────────────────────────
# Sender PEPPOL participant ID (scheme:identifier) — e.g. '0235:123456789012345'
PEPPOL_SENDER_PARTICIPANT_ID = env('PEPPOL_SENDER_PARTICIPANT_ID', default='')

# UAE ASP-provided test Access Point endpoint (for TestNet)
PEPPOL_TEST_AP_ENDPOINT = env('PEPPOL_TEST_AP_ENDPOINT', default='')

# Capture mode: store AS4 messages in DB without sending (dev/test only)
PEPPOL_SANDBOX_CAPTURE_MODE = env.bool('PEPPOL_SANDBOX_CAPTURE_MODE', default=False)

# Override PEPPOL document type ID (defaults to PINT-AE invoice profile)
PEPPOL_DOC_TYPE_ID = env('PEPPOL_DOC_TYPE_ID', default='')

# ─── AI Provider Configuration ────────────────────────────────────────────────
# Primary AI provider: 'anthropic' | 'openai' | auto-detect from available keys
AI_PROVIDER = env('AI_PROVIDER', default='')

# Anthropic (Claude) — primary provider
ANTHROPIC_API_KEY     = env('ANTHROPIC_API_KEY', default='')
AI_CLAUDE_MODEL       = env('AI_CLAUDE_MODEL',       default='claude-sonnet-4-6')
AI_CLAUDE_VISION_MODEL = env('AI_CLAUDE_VISION_MODEL', default='claude-sonnet-4-6')

# OpenAI — fallback provider
OPENAI_API_KEY        = env('OPENAI_API_KEY', default='')
AI_OPENAI_CHAT_MODEL   = env('AI_OPENAI_CHAT_MODEL',   default='gpt-4o-mini')
AI_OPENAI_VISION_MODEL = env('AI_OPENAI_VISION_MODEL', default='gpt-4o')
AI_OPENAI_EMBED_MODEL  = env('AI_OPENAI_EMBED_MODEL',  default='text-embedding-3-small')

# OCR settings
AI_OCR_MAX_FILE_SIZE_MB = env.int('AI_OCR_MAX_FILE_SIZE_MB', default=25)
AI_OCR_CONFIDENCE_THRESHOLD = env.float('AI_OCR_CONFIDENCE_THRESHOLD', default=0.70)

# Fraud detection thresholds
AI_FRAUD_HIGH_RISK_THRESHOLD   = env.float('AI_FRAUD_HIGH_RISK_THRESHOLD',   default=0.70)
AI_FRAUD_MEDIUM_RISK_THRESHOLD = env.float('AI_FRAUD_MEDIUM_RISK_THRESHOLD', default=0.30)

# Override PEPPOL process ID (defaults to BIS Billing 3.0 process)
PEPPOL_PROCESS_ID = env('PEPPOL_PROCESS_ID', default='')

# ─── FTA Data Platform (Corner 5) ─────────────────────────────────────────────
# Sandbox: https://sandbox.fta.gov.ae/einvoicing/api/v1
FTA_API_BASE_URL = env('FTA_API_BASE_URL', default='')
FTA_API_TOKEN    = env('FTA_API_TOKEN',    default='')

# mTLS client certificate issued by FTA
FTA_CLIENT_CERT_PATH = env('FTA_CLIENT_CERT_PATH', default='')
FTA_CLIENT_KEY_PATH  = env('FTA_CLIENT_KEY_PATH',  default='')
FTA_CA_BUNDLE_PATH   = env('FTA_CA_BUNDLE_PATH',   default=True)  # True = system default

# Async polling configuration
FTA_POLLING_MAX_ATTEMPTS = env.int('FTA_POLLING_MAX_ATTEMPTS', default=10)
FTA_POLLING_INTERVAL_S   = env.int('FTA_POLLING_INTERVAL_S',   default=30)

# ─── Prometheus Metrics ────────────────────────────────────────────────────────
# Bearer token required to scrape /metrics/ endpoint
PROMETHEUS_METRICS_TOKEN = env('PROMETHEUS_METRICS_TOKEN', default='')

# ─── Logging ──────────────────────────────────────────────────────────────────
# Structured JSON logging for production aggregation (ELK, CloudWatch, etc.)
# In development, uses verbose console format.
APP_VERSION = env('APP_VERSION', default='1.0.0')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,

    'filters': {
        'request_id': {
            '()': 'django.utils.log.CallbackFilter',
            'callback': lambda record: True,  # Pass-through; request_id added per-record
        },
    },

    'formatters': {
        'json': {
            '()': 'pythonjsonlogger.jsonlogger.JsonFormatter',
            'format': '%(asctime)s %(name)s %(levelname)s %(message)s',
            'datefmt': '%Y-%m-%dT%H:%M:%S',
        },
        'verbose': {
            'format': '[{asctime}] [{levelname}] [{name}] {message}',
            'style': '{',
        },
    },

    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'json_console': {
            'class': 'logging.StreamHandler',
            'formatter': 'json',
        },
        'null': {
            'class': 'logging.NullHandler',
        },
    },

    'loggers': {
        # Application loggers
        'apps': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'tasks': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        'services': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # Structured API access log
        'api.access': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
        # Django internals
        'django': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.request': {
            'handlers': ['console'],
            'level': 'WARNING',
            'propagate': False,
        },
        'django.db.backends': {
            'handlers': ['null'],   # Silence SQL logs in base; enable in dev settings
            'level': 'DEBUG',
            'propagate': False,
        },
        # Celery
        'celery': {
            'handlers': ['console'],
            'level': 'INFO',
            'propagate': False,
        },
    },

    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
}

# ─── Webhook Security ─────────────────────────────────────────────────────────
# HMAC secret shared with your ASP for webhook signature verification
ASP_WEBHOOK_SECRET = env('ASP_WEBHOOK_SECRET', default='')

# ─── API Log Retention ────────────────────────────────────────────────────────
API_LOG_RETENTION_DAYS = env.int('API_LOG_RETENTION_DAYS', default=90)
