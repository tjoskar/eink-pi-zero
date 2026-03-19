#!/bin/bash
#
# Deploy to Raspberry Pi
#
# Usage:
#   ./scripts/deploy.sh pi@raspberrypi.local
#   ./scripts/deploy.sh pi@192.168.1.100
#

set -e

if [ -z "$1" ]; then
  echo "Usage: $0 <user@host>"
  echo "Example: $0 pi@raspberrypi.local"
  exit 1
fi

TARGET="$1"
REMOTE_DIR="~/eink-panel"

echo "=== Building ==="
pnpm run build

echo ""
echo "=== Deploying to $TARGET:$REMOTE_DIR ==="

rsync -avz --progress \
  --include='package.json' \
  --include='pnpm-lock.yaml' \
  --include='dist/***' \
  --include='fonts/***' \
  --include='python/***' \
  --include='scripts/***' \
  --include='.env' \
  --exclude='*' \
  ./ "$TARGET:$REMOTE_DIR/"

echo ""
echo "=== Done! ==="
echo ""
echo "On your Pi, run:"
echo "  cd $REMOTE_DIR"
echo "  sudo ./scripts/setup-pi.sh  # First time only or if you add any new dependencies"
echo "  sudo systemctl restart eink-panel"
