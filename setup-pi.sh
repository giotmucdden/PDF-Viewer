#!/bin/bash
# ──────────────────────────────────────────────────────────────────
# MasterSheet - Raspberry Pi setup script
# Run this on a fresh Raspberry Pi OS (Bookworm)
# ──────────────────────────────────────────────────────────────────
set -e

echo "🎵 MasterSheet — Raspberry Pi Setup"
echo "──────────────────────────────────"

# 1. System packages
echo "[1/5] Installing system dependencies…"
sudo apt-get update -qq
sudo apt-get install -y -qq nodejs npm build-essential python3

# 2. Install Node 20 via n if current version is too old
NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v\([0-9]*\).*/\1/' || echo "0")
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[1.5/5] Upgrading Node.js to v20…"
  sudo npm install -g n
  sudo n 20
  hash -r
fi

echo "Node $(node -v) / npm $(npm -v)"

# 3. Install project dependencies
echo "[2/5] Installing server dependencies…"
npm install

echo "[3/5] Installing client dependencies…"
cd client && npm install && cd ..

# 4. Build the React client
echo "[4/5] Building React client…"
cd client && npx vite build && cd ..

# 5. Create systemd service
echo "[5/5] Creating systemd service…"
INSTALL_DIR=$(pwd)
sudo tee /etc/systemd/system/mastersheet.service > /dev/null <<EOF
[Unit]
Description=MasterSheet Music Viewer
After=network.target

[Service]
Type=simple
User=$(whoami)
WorkingDirectory=$INSTALL_DIR
Environment=NODE_ENV=production
Environment=PORT=80
ExecStart=/usr/bin/node server/index.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable mastersheet
sudo systemctl start mastersheet

echo ""
echo "✅ MasterSheet is running!"
echo "   Open http://$(hostname -I | awk '{print $1}') on any device in the mesh"
echo ""
echo "   Manage service:"
echo "     sudo systemctl status mastersheet"
echo "     sudo systemctl restart mastersheet"
echo "     sudo journalctl -u mastersheet -f"
