#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/home/faiz/budget-tracker}"
CURRENT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [[ "$CURRENT_DIR" != "$APP_DIR" ]]; then
  echo "Install this project at $APP_DIR first, then run ./install_pi.sh"
  echo "Current directory: $CURRENT_DIR"
  exit 1
fi

mkdir -p data backups
python3 -m venv .venv
.venv/bin/python -m pip install --upgrade pip
.venv/bin/pip install -r requirements.txt

sudo cp systemd/budget-tracker.service /etc/systemd/system/
sudo cp systemd/budget-backup.service /etc/systemd/system/
sudo cp systemd/budget-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now budget-tracker.service
sudo systemctl enable --now budget-backup.timer

echo
echo "Budget Tracker installed."
echo "Service:  sudo systemctl status budget-tracker --no-pager"
echo "Backups:  systemctl list-timers budget-backup.timer"
echo "Health:   curl http://127.0.0.1:5055/api/health"
