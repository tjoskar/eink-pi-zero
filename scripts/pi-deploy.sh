#!/usr/bin/env bash
# Builds an app on this computer and deploys it to a Pi, which only needs Node.
#
#   pnpm pi:deploy <app> <user@host>      e.g. pnpm pi:deploy dashboard pi@eink.local
#
# The app lands in ~/eink/<app>/ on the Pi. A gitignored <app>/.env.pi is
# copied there as .env; without one, the .env already on the Pi is kept.
# If the app has a systemd user unit (<app>/eink-<app>.service), it is
# installed, enabled and restarted; otherwise the start command is printed.
set -euo pipefail

app=${1:?usage: pnpm pi:deploy <app> <user@host>}
host=${2:?usage: pnpm pi:deploy <app> <user@host>}
root=$(cd "$(dirname "$0")/.." && pwd)
app_dir=$root/$app
unit=eink-$app.service
remote_dir=eink/$app # relative to the Pi user's home

[[ -f $app_dir/package.json ]] || {
  echo "pi-deploy: no package at $app_dir" >&2
  exit 1
}
package=$(jq -r .name "$app_dir/package.json")

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

echo "=== Building $package and its workspace dependencies ==="
pnpm --filter "$package..." run build

echo "=== Packing $package for linux/arm64 ==="
# The flags fetch the Pi's prebuilt native packages (e.g. @napi-rs/canvas)
# instead of this computer's. --cpu and friends take several values, hence `=`.
pnpm --filter "$package" deploy --prod --os=linux --cpu=arm64 --libc=glibc "$stage/$app"
if [[ -f $app_dir/.env.pi ]]; then
  cp "$app_dir/.env.pi" "$stage/$app/.env"
fi

echo "=== Copying to $host:~/$remote_dir ==="
# --delete drops files from earlier deploys, but never the Pi's .env or cache.
rsync -az --delete --filter='P /.env' --filter='P /.cache/' "$stage/$app/" "$host:$remote_dir/"

if [[ -f $app_dir/$unit ]]; then
  echo "=== Restarting $unit ==="
  ssh "$host" "install -Dm644 -t ~/.config/systemd/user ~/$remote_dir/$unit &&
    systemctl --user daemon-reload &&
    systemctl --user enable $unit &&
    systemctl --user restart $unit"
  echo "Logs: ssh $host journalctl --user -u $unit -f"
else
  echo "No $app/$unit; start it on the Pi with:"
  echo "  cd ~/$remote_dir && node --env-file=.env --enable-source-maps dist/main.js"
fi
