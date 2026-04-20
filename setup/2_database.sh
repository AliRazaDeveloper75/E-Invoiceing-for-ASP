#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# STEP 2 — Create PostgreSQL database and user
# Edit DB_USER and DB_PASSWORD below before running.
#
# Usage:
#   bash setup/2_database.sh
# ─────────────────────────────────────────────────────────────────────────────

set -e

DB_NAME="einvoicing_db"
DB_USER="einvoicing_user"
DB_PASSWORD="YourStrongPassword123"   # ← CHANGE THIS

echo ">>> Creating database: $DB_NAME"
sudo -u postgres psql << EOF
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
\c $DB_NAME
GRANT ALL ON SCHEMA public TO $DB_USER;
EOF

echo ""
echo "✅ Database ready."
echo "   Name:     $DB_NAME"
echo "   User:     $DB_USER"
echo "   Password: $DB_PASSWORD"
echo ""
echo "Next: copy setup/.env.production.example to .env and fill in your values"
echo "      cp setup/.env.production.example .env && nano .env"
