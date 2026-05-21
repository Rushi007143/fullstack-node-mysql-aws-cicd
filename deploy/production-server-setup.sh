#!/usr/bin/env bash
set -euo pipefail

APP_BASE="/var/www/fullstack-app"
APP_USER="ubuntu"

sudo apt update
sudo apt install -y nginx mysql-server nodejs npm rsync curl

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1 || echo 0)
if [ "$NODE_MAJOR" -lt 18 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
fi

sudo mkdir -p "$APP_BASE/backend/releases" "$APP_BASE/frontend/releases" "$APP_BASE/shared"
sudo chown -R "$APP_USER":"$APP_USER" "$APP_BASE"

if [ ! -f "$APP_BASE/shared/.env" ]; then
  sudo tee "$APP_BASE/shared/.env" >/dev/null <<'ENVEOF'
NODE_ENV=production
PORT=5000

DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=appdb
DB_USER=appuser
DB_PASS=ChangeThisStrongPassword

JWT_SECRET=change-this-production-secret-minimum-32-chars
JWT_EXPIRES_IN=1d

FRONTEND_URL=http://YOUR_DOMAIN_OR_IP
ENVEOF
  sudo chmod 600 "$APP_BASE/shared/.env"
  sudo chown "$APP_USER":"$APP_USER" "$APP_BASE/shared/.env"
fi

sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS appdb;
CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY 'ChangeThisStrongPassword';
GRANT ALL PRIVILEGES ON appdb.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
SQL

sudo cp deploy/node-backend.service /etc/systemd/system/node-backend.service
sudo systemctl daemon-reload
sudo systemctl enable node-backend || true

sudo cp deploy/nginx-site.conf /etc/nginx/sites-available/fullstack-app
sudo ln -sfn /etc/nginx/sites-available/fullstack-app /etc/nginx/sites-enabled/fullstack-app
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl reload nginx

echo "Production server base setup completed."
echo "Next: update $APP_BASE/shared/.env with real MySQL password/domain."
