# UAE E-Invoicing — Dev Commands
# Usage: make <target>
# Windows: run via Git Bash → bash -c "make <target>"

PYTHON = venv/Scripts/python
PIP    = venv/Scripts/pip
MANAGE = $(PYTHON) manage.py

# ─── Setup ────────────────────────────────────────────────────────────────────

install:
	python -m venv venv
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	cd frontend && npm install

# ─── Django ───────────────────────────────────────────────────────────────────

migrate:
	$(MANAGE) migrate

migrations:
	$(MANAGE) makemigrations

run-backend:
	$(MANAGE) runserver 0.0.0.0:8000

shell:
	$(MANAGE) shell

superuser:
	$(MANAGE) createsuperuser

collectstatic:
	$(MANAGE) collectstatic --noinput

# ─── Frontend ─────────────────────────────────────────────────────────────────

run-frontend:
	cd frontend && npm run dev

build-frontend:
	cd frontend && npm run build

# ─── Run both (requires two terminals) ───────────────────────────────────────

dev:
	@echo "Start backend:  make run-backend"
	@echo "Start frontend: make run-frontend"

# ─── Tests ────────────────────────────────────────────────────────────────────

test:
	$(PYTHON) -m pytest

test-v:
	$(PYTHON) -m pytest -v

# ─── Code Quality ─────────────────────────────────────────────────────────────

lint:
	$(PYTHON) -m flake8 apps/ tasks/ config/
	cd frontend && npm run lint

format:
	$(PYTHON) -m black apps/ tasks/ config/

# ─── Database ─────────────────────────────────────────────────────────────────

db-reset:
	$(MANAGE) flush --noinput
	$(MANAGE) migrate

# ─── Deployment ───────────────────────────────────────────────────────────────

deploy:
	bash deploy.sh

.PHONY: install migrate migrations run-backend run-frontend build-frontend dev shell superuser collectstatic test test-v lint format db-reset deploy
