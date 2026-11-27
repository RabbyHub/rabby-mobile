#!/usr/bin/env bash
# Build the production-identity *unsigned* iOS archive, then hash the .app tree
# and write an attestation (hash + toolchain + normalization list).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
out_dir="${1:-$project_dir/dist/unsigned/ios}"
archive="$out_dir/RabbyMobile.xcarchive"
app="$archive/Products/Applications/RabbyMobile.app"

mkdir -p "$out_dir"
rm -rf "$archive" "${archive}.zip"

export RABBY_MOBILE_IOS_BUILD_UNSIGNED=true
export RABBY_MOBILE_IOS_UNSIGNED_CHANNEL=production
export RABBY_MOBILE_IOS_UNSIGNED_ARCHIVE="$archive"
export RABBY_MOBILE_BUILD_ENV=production

cd "$project_dir"
bash ./scripts/sign-only/build-unsigned-ios.sh "$archive"

if [ ! -d "$app" ]; then
  echo "[unsigned] unsigned app not found at $app" >&2
  exit 1
fi

node "$script_dir/hash.mjs" \
  --platform ios \
  --channel production \
  --tree "$app" \
  --out "$out_dir"
