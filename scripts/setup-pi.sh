#!/bin/bash
#
# Setup script for Raspberry Pi
#
# This script installs all dependencies and configures the system
# for running the e-ink panel application.
#
# Usage: sudo ./scripts/setup-pi.sh
#

set -e

echo "╔════════════════════════════════════════╗"
echo "║     E-Ink Panel Setup for Pi Zero 2    ║"
echo "╚════════════════════════════════════════╝"
echo

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

DEPLOY_USER="${SUDO_USER:-$(logname)}"
USER_HOME=$(eval echo "~$DEPLOY_USER")
NODE_PATH=$(su - "$DEPLOY_USER" -c "which node" 2>/dev/null || echo "/usr/local/bin/node")

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Deploy user: $DEPLOY_USER"
echo "User home: $USER_HOME"
echo "Node path: $NODE_PATH"
echo "Project directory: $PROJECT_DIR"
echo

# 1. Enable SPI
echo "→ Enabling SPI interface..."
if ! grep -q "^dtparam=spi=on" /boot/firmware/config.txt 2>/dev/null; then
    echo "dtparam=spi=on" >> /boot/firmware/config.txt
    echo "  SPI enabled (reboot required)"
else
    echo "  SPI already enabled"
fi

# 2. Install system dependencies
echo "→ Installing system dependencies..."
apt update
apt install -y \
    python3-pil \
    python3-spidev \
    python3-gpiozero \
    gpiod \
    fonts-noto

echo "  Dependencies installed"

# 3. Create log directory
echo "→ Creating log directory..."
mkdir -p "$USER_HOME/control-panel/logs"
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$USER_HOME/control-panel"
echo "  Log directory created: $USER_HOME/control-panel/logs"

# 4. Create temp directory
echo "→ Creating temp directory..."
mkdir -p /tmp/eink-panel
chown "$DEPLOY_USER:$DEPLOY_USER" /tmp/eink-panel
echo "  Temp directory created: /tmp/eink-panel"

# 5. Install systemd service (substitute placeholders)
echo "→ Installing systemd service..."
sed -e "s|__USER__|$DEPLOY_USER|g" \
    -e "s|__HOME__|$USER_HOME|g" \
    -e "s|__NODE_PATH__|$NODE_PATH|g" \
    "$PROJECT_DIR/scripts/eink-panel.service" > /etc/systemd/system/eink-panel.service
systemctl daemon-reload
echo "  Systemd service installed"

# 6. Install logrotate config (substitute placeholders)
echo "→ Installing logrotate config..."
sed -e "s|__USER__|$DEPLOY_USER|g" \
    -e "s|__HOME__|$USER_HOME|g" \
    "$PROJECT_DIR/scripts/eink-panel.logrotate" > /etc/logrotate.d/eink-panel
echo "  Logrotate config installed"

# 7. Add user to gpio and spi groups
echo "→ Adding user to gpio and spi groups..."
usermod -aG gpio,spi "$DEPLOY_USER" 2>/dev/null || true
echo "  User added to groups"

echo
echo "════════════════════════════════════════"
echo "Setup complete!"
echo
echo "Next steps:"
echo "  1. Reboot to enable SPI: sudo reboot"
echo "  2. Start the service: sudo systemctl start eink-panel"
echo "  3. Enable on boot: sudo systemctl enable eink-panel"
echo "  4. View logs: journalctl -u eink-panel -f"
echo
echo "To manually run:"
echo "  cd $PROJECT_DIR && node --env-file=.env --enable-source-maps dist/home-dashboard/main.js"
echo "════════════════════════════════════════"
