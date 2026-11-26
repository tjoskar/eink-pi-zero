#!/usr/bin/env bash
# Builds an app on this computer and deploys it to a Pi, which only needs Node.
#
#   pnpm pi:deploy <app> <user@host>      e.g. pnpm pi:deploy dashboard pi@eink.local
#
# <app> is a workspace directory (dashboard, examples/hello-world). It lands in
# ~/eink/<name>/ on the Pi, where <name> is the directory's last part.
# A gitignored <app>/.env.pi is copied there as .env; without one, the .env
# already on the Pi is kept. If the app has a systemd user unit
# (<app>/eink-<name>.service), it is installed, enabled and restarted;
# otherwise the start command is printed.
set -euo pipefail

usage="usage: pnpm pi:deploy <app> <user@host>"
app=${1:?$usage}
host=${2:?$usage}
app=${app%/}
name=${app##*/}
[[ $app =~ ^[a-z0-9/-]+$ && $name =~ ^[a-z0-9-]+$ ]] || {
  echo "pi-deploy: bad app name '$app'" >&2
  exit 1
}
root=$(cd "$(dirname "$0")/.." && pwd)
app_dir=$root/$app
unit=eink-$name.service
remote_dir=eink/$name # relative to the Pi user's home

[[ -f $app_dir/package.json ]] || {
  echo "pi-deploy: no package at $app_dir" >&2
  exit 1
}

package=$(node -p 'require(process.argv[1]).name' "$app_dir/package.json")

stage=$(mktemp -d)
trap 'rm -rf "$stage"' EXIT

echo "=== Building $app and its workspace dependencies ==="
# By name: a path filter ("./$app...") does not select the dependencies.
pnpm --filter "$package..." run build

echo "=== Packing $app for linux/arm64 ==="
# The flags fetch the Pi's prebuilt native packages (e.g. @napi-rs/canvas)
# instead of this computer's. --cpu and friends take several values, hence `=`.
pnpm --filter "$package" deploy --prod --os=linux --cpu=arm64 --libc=glibc "$stage/$name"
if [[ -f $app_dir/.env.pi ]]; then
  install -m600 "$app_dir/.env.pi" "$stage/$name/.env"
fi
if [[ -f $app_dir/$unit ]]; then
  cp "$app_dir/$unit" "$stage/$name/"
fi

echo "=== Copying to $host:~/$remote_dir ==="
# --delete drops files from earlier deploys, but never the Pi's .env, the
# cache or lgpio's notification pipe (.lgd-nfy*), which the running app owns.
rsync -az --delete --filter='P /.env' --filter='P /.cache/' --filter='P /.lgd-nfy*' "$stage/$name/" "$host:$remote_dir/"

if [[ -f $app_dir/$unit ]]; then
  echo "=== Restarting $unit ==="
  # reset-failed: deploys count towards the unit's start limit too.
  ssh "$host" "install -Dm644 -t ~/.config/systemd/user ~/$remote_dir/$unit &&
    systemctl --user daemon-reload &&
    systemctl --user enable $unit &&
    systemctl --user reset-failed $unit &&
    systemctl --user restart $unit &&
    { [ \"\$(loginctl show-user \"\$USER\" -P Linger)\" = yes ] ||
      echo 'Warning: lingering is off, so $unit stops at logout and does not start at boot. Run: sudo loginctl enable-linger \$USER' >&2; }"
  echo "Logs: ssh $host journalctl --user-unit $unit -f"
else
  echo "No $app/$unit; start it on the Pi with:"
  echo "  cd ~/$remote_dir && node --env-file=.env --enable-source-maps dist/main.js"
fi
