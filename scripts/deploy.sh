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
pnpm --filter dashboard build

# Stage the same layout the Pi has always had, so the installed unit
# (dist/home-dashboard/main.js, run from $REMOTE_DIR) keeps working.
# The bundle finds fonts/ and python/ two levels up (see
# packages/eink/src/assets/paths.ts).
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
mkdir -p "$STAGE/dist/home-dashboard"
cp dashboard/dist/main.js dashboard/dist/main.js.map "$STAGE/dist/home-dashboard/"
cp -r packages/eink/fonts packages/eink/python scripts "$STAGE/"
[ -f .env ] && cp .env "$STAGE/"

for asset in python/hardware_daemon.py fonts/material-icons.woff; do
  if [ ! -f "$STAGE/dist/home-dashboard/../../$asset" ]; then
    echo "Bundle would not find $asset; check packages/eink/src/assets/paths.ts" >&2
    exit 1
  fi
done

# The bundle leaves the native/runtime packages external; setup-pi.sh
# installs them from this package.json. packageManager pins corepack's pnpm
# on the Pi to the version in mise.toml (the pnpm running this script).
PNPM_VERSION="$(pnpm --version)" node -e '
  const packageManager = `pnpm@${process.env.PNPM_VERSION}`;
  const eink = require("./packages/eink/package.json").dependencies;
  const dashboard = require("./dashboard/package.json").dependencies;
  const dependencies = Object.fromEntries(
    Object.entries({ ...eink, ...dashboard }).filter(([, v]) => !v.startsWith("workspace:")),
  );
  const pkg = { name: "eink-panel", private: true, type: "module", packageManager, dependencies };
  console.log(JSON.stringify(pkg, null, 2));
' > "$STAGE/package.json"

echo ""
echo "=== Deploying to $TARGET:$REMOTE_DIR ==="

rsync -avz --progress "$STAGE/" "$TARGET:$REMOTE_DIR/"

echo ""
echo "=== Done! ==="
echo ""
echo "On your Pi, run:"
echo "  cd $REMOTE_DIR"
echo "  sudo ./scripts/setup-pi.sh  # First time only or if you add any new dependencies"
echo "  sudo systemctl restart eink-panel"
