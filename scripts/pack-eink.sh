#!/usr/bin/env bash
# Builds and packs @tjoskar/eink for a release tag, then checks the tarball.
# Prints the tarball path on the last line of stdout.
#
#   scripts/pack-eink.sh eink-v1.0.0 [out-dir]
#
# Used by .github/workflows/release.yml; run it locally to try a release
# without publishing anything.
set -euo pipefail

tag=${1:?usage: pack-eink.sh <tag> [out-dir]}
root=$(cd "$(dirname "$0")/.." && pwd)
out=$(realpath -m "${2:-$root/.cache/release}")
pkg=$root/packages/eink

fail() {
  echo "pack-eink: $*" >&2
  exit 1
}

version=$(jq -r .version "$pkg/package.json")
[[ $tag == "eink-v$version" ]] ||
  fail "tag $tag does not match packages/eink/package.json version $version (expected eink-v$version)"

pnpm --filter @tjoskar/eink build >&2

# pnpm pack, not npm pack: pnpm applies publishConfig (drops the `source`
# export condition) and rewrites workspace:/catalog: ranges.
rm -rf "$out" && mkdir -p "$out"
tarball=$(cd "$pkg" && pnpm pack --json --pack-destination "$out" | jq -r .filename)

files=$(tar -tzf "$tarball" | sed 's|^package/||')
manifest=$(tar -xOzf "$tarball" package/package.json)

for required in fonts/noto-sans-regular.ttf fonts/titan-one-regular.ttf fonts/material-icons.woff \
  dist/mod.js dist/mod.d.ts dist/runtime/jsx-runtime.js dist/runtime/jsx-runtime.d.ts; do
  grep -qxF "$required" <<<"$files" || fail "$required is missing from the tarball"
done

leaked=$(grep -E '^(src|scripts)/|\.test\.|\.tsx?$|^tsconfig|__pycache__' <<<"$files" | grep -v '\.d\.ts$' || true)
[[ -z $leaked ]] || fail "sources or tests in the tarball:"$'\n'"$leaked"

if grep -qE '"(workspace|catalog):' <<<"$manifest"; then
  fail "packed package.json contains workspace: or catalog: ranges"
fi

# Every file an export points at must be in the tarball (catches a leaked
# `source` condition pointing at ./src).
jq -e '.exports' <<<"$manifest" >/dev/null || fail "packed package.json has no exports"
while read -r target; do
  grep -qxF "${target#./}" <<<"$files" || fail "export target $target is not in the tarball"
done < <(jq -r '.exports | [.. | strings] | .[]' <<<"$manifest")

echo "pack-eink: $(wc -l <<<"$files") files, checks passed" >&2
echo "$tarball"
