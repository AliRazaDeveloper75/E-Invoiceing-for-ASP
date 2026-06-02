# E-Numerak — UAE FTA-Compliant E-Invoicing Platform

A production-grade SaaS platform for UAE businesses to generate, validate, and submit PEPPOL BIS 3.0 compliant tax invoices directly to the Federal Tax Authority (FTA).

**Live:** https://e-numerak.com | **API:** https://api.e-numerak.com

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
- [Environment Variables](#environment-variables)
- [CI/CD Pipeline](#cicd-pipeline)
- [Project Structure](#project-structure)
- [Key Features](#key-features)

---

## Overview

E-Numerak centralises the entire UAE e-invoicing lifecycle:

1. **Create** — Generate UBL 2.1 XML invoices with full FAF data elements
2. **Validate** — Real-time PEPPOL BIS 3.0 compliance checks
3. **Sign** — XAdES-BES digital signature via x509 certificate
4. **Submit** — Transmit via PEPPOL 5-corner AS4 network to FTA
5. **Track** — Full audit trail with MDN receipts and status tracking

Compliant with:
- Federal Decree-Law No. 16 of 2024 (VAT)
- Federal Decree-Law No. 7 of 2017 (Excise)
- PEPPOL BIS Billing 3.0 / UBL 2.1
- UAE FTA Tax Accounting Software requirements

---

## Architecture

```
                        ┌──────────────────────────────────────────────────┐
                        │                  Hostinger VPS                   │
                        │                                                  │
   Browser / Client ───►│  Nginx (SSL)  ──► Next.js Frontend (port 3000)  │
                        │      │                                           │
   API Calls      ──────┤      └────────► Django API (port 8000)          │
                        │                     │                            │
                        │              ┌──────┴──────┐                     │
                        │           PostgreSQL     Redis                   │
                        │              │              │                    │
                        │         Celery Worker  Celery Beat               │
                        └──────────────────────────────────────────────────┘
                                           │
                                    PEPPOL Network
                                    (AS4 Transport)
                                           │
                                       UAE FTA
```

**Domains:**
- `e-numerak.com` → Next.js frontend
- `api.e-numerak.com` → Django REST API

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Django 5.0.4 + Django REST Framework 3.15.1 |
| Frontend | Next.js 14.2.5 + React 18 + TypeScript + Tailwind CSS |
| Database | PostgreSQL 15 |
| Cache / Queue | Redis 7 (Celery broker + result backend) |
| Task Queue | Celery 5.3.6 (worker + beat) |
| Web Server | Nginx 1.25 (SSL termination, reverse proxy) |
| WSGI | Gunicorn 22 (gthread workers) |
| XML | lxml + xmlsec (UBL 2.1, XAdES-BES signing) |
| Transport | PEPPOL AS4 (5-corner model) |
| AI | OpenAI GPT + Anthropic Claude (OCR, chatbot) |
| Containerisation | Docker + Docker Compose |
| CI/CD | GitHub Actions |
| SSL | Let's Encrypt (auto-renewed via certbot) |

---

## Local Development

### Prerequisites

- Docker Desktop
- Git

### Setup

```bash
# 1. Clone the repository
git clone https://github.com/AliRazaDeveloper75/E-Invoiceing-for-ASP.git
cd E-Invoiceing-for-ASP

# 2. Copy environment file
cp .env.example .env
# Edit .env if needed — SQLite and RabbitMQ defaults work out of the box

# 3. Start all services
docker compose -f docker/docker-compose.yml up -d --build

# 4. Run migrations
docker compose -f docker/docker-compose.yml exec backend python manage.py migrate

# 5. Create a superuser
docker compose -f docker/docker-compose.yml exec backend python manage.py createsuperuser

# 6. Access the app
#   Frontend:   http://localhost:3000
#   API:        http://localhost:8000/api/v1/
#   Django Admin: http://localhost:8000/django-admin/
#   RabbitMQ UI:  http://localhost:15672  (guest / guest)
```

### Useful Make Commands

```bash
make migrate        # Run database migrations
make superuser      # Create Django superuser
make shell          # Django shell
make test           # Run full test suite
make lint           # flake8 + black check
make logs           # Tail all container logs
```

---

## Production Deployment

### Initial Server Setup (one-time)

```bash
# 1. Clone the repo on the server
git clone https://github.com/AliRazaDeveloper75/E-Invoiceing-for-ASP.git ~/E-Invoiceing-for-ASP
cd ~/E-Invoiceing-for-ASP

# 2. Create production env file
cp .env.prod.example .env.prod
nano .env.prod   # Fill in all real values

# 3. Generate DH parameters for nginx SSL
mkdir -p docker/ssl
openssl dhparam -out docker/ssl/dhparam.pem 2048

# 4. Obtain SSL certificates
certbot certonly --standalone \
  -d e-numerak.com -d www.e-numerak.com -d api.e-numerak.com \
  --email info@e-numerak.com --agree-tos --non-interactive

# 5. Start all services
docker compose -f docker/docker-compose.prod.yml up -d --build

# 6. Run initial migrations and collect static files
docker exec -it docker-backend-1 python manage.py migrate
docker exec -it docker-backend-1 python manage.py collectstatic --noinput

# 7. Create superuser
docker exec -it docker-backend-1 python manage.py createsuperuser
```

### SSL Certificate Auto-Renewal

```bash
# Add to root crontab (runs every Monday at 3am)
(crontab -l 2>/dev/null; echo "0 3 * * 1 certbot renew --quiet && docker exec docker-nginx-1 nginx -s reload") | crontab -
```

### Manual Deploy (without CI/CD)

```bash
cd ~/E-Invoiceing-for-ASP
git pull origin main
docker compose -f docker/docker-compose.prod.yml up -d --build backend celery-worker celery-beat
docker exec -it docker-backend-1 python manage.py migrate --noinput
docker compose -f docker/docker-compose.prod.yml up -d --build frontend
docker exec docker-nginx-1 nginx -s reload
```

---

## Environment Variables

### Development (`.env`)

| Variable | Description | Default |
|---|---|---|
| `SECRET_KEY` | Django secret key | change-this |
| `DEBUG` | Debug mode | `True` |
| `USE_SQLITE` | Use SQLite instead of PostgreSQL | `true` |
| `CELERY_BROKER_URL` | RabbitMQ URL | `amqp://guest:guest@localhost:5672//` |
| `CORS_ALLOWED_ORIGINS` | Allowed frontend origins | `http://localhost:3000` |
| `OPENAI_API_KEY` | OpenAI API key | — |

### Production (`.env.prod`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Long random secret (generate with `python -c "import secrets; print(secrets.token_hex(50))"`) |
| `DEBUG` | Must be `False` |
| `ALLOWED_HOSTS` | `api.e-numerak.com` |
| `DB_*` | PostgreSQL connection (host=`db` in Docker) |
| `POSTGRES_*` | PostgreSQL Docker container vars |
| `REDIS_PASSWORD` | Redis auth password |
| `REDIS_URL` | `redis://:PASSWORD@redis:6379/0` |
| `CELERY_BROKER_URL` | `redis://:PASSWORD@redis:6379/1` |
| `CORS_ALLOWED_ORIGINS` | `https://e-numerak.com,https://www.e-numerak.com` |
| `EMAIL_HOST` | `smtp.hostinger.com` |
| `EMAIL_HOST_USER` | SMTP username |
| `EMAIL_HOST_PASSWORD` | SMTP password |
| `FRONTEND_URL` | `https://e-numerak.com` |
| `ASP_API_BASE_URL` | UAE ASP integration endpoint |
| `ASP_API_KEY` | UAE ASP API key |
| `OPENAI_API_KEY` | OpenAI API key |
| `FLOWER_ADMIN_USER` | Celery monitor username |
| `FLOWER_ADMIN_PASSWORD` | Celery monitor password |

Copy `.env.prod.example` to `.env.prod` and fill in all values. **Never commit `.env.prod`.**

---

## CI/CD Pipeline

Pushes to `main` automatically deploy to production via GitHub Actions.

### Required GitHub Secrets

Go to **GitHub → Settings → Secrets and variables → Actions** and add:

| Secret | Value |
|---|---|
| `VPS_HOST` | `187.127.231.215` |
| `VPS_USER` | `root` |
| `VPS_SSH_KEY` | Private SSH key for server access |

### Pipeline Steps

```
push to main
    │
    ├── CI (ci.yml)
    │   ├── lint (flake8, black, bandit)
    │   ├── test (pytest + PostgreSQL + Redis)
    │   ├── migration-check
    │   ├── frontend (TypeScript, ESLint, build)
    │   └── docker-build
    │
    └── Deploy (deploy.yml) — runs after CI passes
        ├── SSH to VPS
        ├── git pull origin main
        ├── Detect changed services (backend / frontend / nginx)
        ├── Rebuild changed Docker images
        ├── Run Django migrations
        ├── Reload nginx (if config changed)
        └── Health check https://api.e-numerak.com/health/
```

### Monitoring

- **Celery Flower:** `http://YOUR_SERVER_IP:5555` (internal only, basic auth)
- **Django Admin:** `https://api.e-numerak.com/django-admin/`
- **Health endpoint:** `https://api.e-numerak.com/health/`

---

## Project Structure

```
E-Invoiceing-for-ASP/
├── apps/                    # Django applications
│   ├── accounts/            # Authentication, users, JWT
│   ├── invoices/            # Core invoice CRUD & lifecycle
│   ├── companies/           # Multi-tenant company management
│   ├── customers/           # Customer / buyer database
│   ├── payments/            # Payment tracking
│   ├── reporting/           # Analytics & reports
│   ├── taxes/               # VAT & Excise calculations
│   ├── chat/                # Support messaging
│   ├── ai_ocr/              # AI document OCR
│   ├── onboarding/          # New user flows
│   ├── integrations/        # Third-party integrations
│   ├── inbound/             # Inbound invoice processing
│   ├── buyers/              # Buyer-side portal
│   └── admin_panel/         # Admin dashboard
├── config/                  # Django settings (base / development / production)
├── services/                # Business logic
│   ├── xml_generator.py     # UBL 2.1 XML generation
│   ├── xml_signer.py        # XAdES-BES digital signing
│   ├── peppol_validator.py  # PEPPOL compliance validation
│   ├── smp_client.py        # SMP lookup
│   ├── as4/                 # AS4 transport protocol
│   └── fta/                 # FTA (UAE tax authority) integration
├── tasks/                   # Celery async tasks
│   ├── invoice_tasks.py     # Invoice processing pipeline
│   ├── as4_tasks.py         # AS4 submission & polling
│   ├── fta_tasks.py         # FTA reporting
│   └── cert_tasks.py        # Certificate management
├── frontend/                # Next.js 14 application
│   └── src/
│       ├── app/             # App Router pages
│       ├── components/      # React components
│       ├── hooks/           # Custom hooks
│       └── lib/             # Utilities
├── docker/
│   ├── docker-compose.yml       # Local development
│   ├── docker-compose.prod.yml  # Production
│   ├── Dockerfile.backend       # Django multi-stage build
│   ├── Dockerfile.frontend      # Next.js multi-stage build
│   ├── nginx.conf               # Nginx SSL + reverse proxy config
│   └── ssl/                     # dhparam.pem (gitignored)
├── requirements/
│   ├── base.txt             # Core dependencies
│   ├── dev.txt              # Development extras
│   └── prod.txt             # Production extras
├── .github/workflows/
│   ├── ci.yml               # Lint, test, build checks
│   └── deploy.yml           # Auto-deploy to production
├── .env.example             # Development env template
├── .env.prod.example        # Production env template
└── Makefile                 # Dev shortcuts
```

---

## Key Features

| Feature | Details |
|---|---|
| **PEPPOL 5-Corner** | Full AS4 transport, SMP lookup, MDN receipts |
| **UBL 2.1 XML** | Auto-generated, XAdES-BES signed invoices |
| **FTA Compliance** | FAF 32-field format, VAT + Excise support |
| **Multi-tenant** | Company isolation, role-based access control |
| **Email OTP** | 6-digit verification codes for registration |
| **AI OCR** | GPT-powered document scanning and data extraction |
| **Buyer Portal** | Buyers can view and track received invoices |
| **Async Pipeline** | Celery queues for invoice processing and AS4 transport |
| **Real-time Validation** | Instant compliance error feedback before submission |
| **Audit Trail** | Full invoice lifecycle logging with timestamps |

---

## License

Private — All rights reserved. E-Numerak © 2026.
