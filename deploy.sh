#!/bin/bash
# UAE E-Invoicing — AWS Ubuntu Deployment Script
# Usage: bash deploy.sh
# Run this on the EC2 server after uploading the project.

set -e  # Exit on any error

PROJECT_DIR="/home/ubuntu/einvoicing"
VENV="$PROJECT_DIR/venv"
FRONTEND_DIR="$PROJECT_DIR/frontend"

echo "==> Starting deployment..."

# ─── 1. Install system packages ───────────────────────────────────────────────
echo "==> Installing system packages..."
sudo apt-get update -q
sudo apt-get install -y -q python3.12 python3.12-venv python3-pip postgresql postgresql-contrib nginx unzip

# Node.js 20
if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# PM2
if ! command -v pm2 &>/dev/null; then
    sudo npm install -g pm2
fi

# ─── 2. Python virtualenv & dependencies ──────────────────────────────────────
echo "==> Setting up Python environment..."
cd "$PROJECT_DIR"
python3.12 -m venv venv
source "$VENV/bin/activate"
pip install --upgrade pip -q
pip install -r requirements.txt -q

# ─── 3. Django setup ──────────────────────────────────────────────────────────
echo "==> Running Django migrations..."
export DJANGO_SETTINGS_MODULE=config.settings.production
python manage.py migrate --noinput
python manage.py collectstatic --noinput

# ─── 4. Create logs directory ─────────────────────────────────────────────────
mkdir -p "$PROJECT_DIR/logs"

# ─── 5. Next.js build ─────────────────────────────────────────────────────────
echo "==> Building Next.js frontend..."
cd "$FRONTEND_DIR"
npm install --silent
npm run build

# ─── 6. Systemd service for Gunicorn ──────────────────────────────────────────
echo "==> Configuring Gunicorn systemd service..."
sudo tee /etc/systemd/system/einvoicing-backend.service > /dev/null << EOF
[Unit]
Description=UAE E-Invoicing Django Backend
After=network.target postgresql.service

[Service]
User=ubuntu
Group=ubuntu
WorkingDirectory=$PROJECT_DIR
Environment="DJANGO_SETTINGS_MODULE=config.settings.production"
ExecStart=$VENV/bin/gunicorn \\
    --workers 3 \\
    --bind 127.0.0.1:8000 \\
    --timeout 120 \\
    --access-logfile $PROJECT_DIR/logs/gunicorn-access.log \\
    --error-logfile $PROJECT_DIR/logs/gunicorn-error.log \\
    config.wsgi:application
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable einvoicing-backend
sudo systemctl restart einvoicing-backend

# ─── 7. PM2 for Next.js ───────────────────────────────────────────────────────
echo "==> Starting Next.js with PM2..."
cd "$FRONTEND_DIR"
pm2 delete einvoicing-frontend 2>/dev/null || true
pm2 start npm --name "einvoicing-frontend" -- start
pm2 save

# ─── 8. Nginx config ──────────────────────────────────────────────────────────
echo "==> Configuring Nginx..."
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)

sudo tee /etc/nginx/sites-available/einvoicing > /dev/null << EOF
server {
    listen 80;
    server_name $PUBLIC_IP _;

    location /static/ {
        alias $PROJECT_DIR/staticfiles/;
    }

    location /media/ {
        alias $PROJECT_DIR/media/;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 120s;
    }

    location /admin/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/einvoicing /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl restart nginx
sudo systemctl enable nginx

echo ""
echo "✅ Deployment complete!"
echo "   Site: http://$PUBLIC_IP"
echo "   Backend status: sudo systemctl status einvoicing-backend"
echo "   Frontend status: pm2 status"
echo "   Nginx logs: sudo tail -f /var/log/nginx/error.log"
