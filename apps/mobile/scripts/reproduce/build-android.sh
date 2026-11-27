#!/usr/bin/env bash
# Build the production-identity *unsigned* AAB, then hash it and write an
# attestation (hash + toolchain + normalization list).
#
# The same file is what a second machine rebuilds for cross-checking and what
# the signing machine signs once both hashes agree.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
channel="${RABBY_MOBILE_REPRODUCE_CHANNEL:-production}"
if [ "$#" -gt 0 ] && [ "$1" != "production" ] && [ "$1" != "regression" ]; then
  out_dir="$1"
else
  if [ "$#" -gt 0 ]; then channel="$1"; fi
  out_dir="$project_dir/.reproduce/$channel"
fi
artifact="$out_dir/app-release-unsigned.aab"

mkdir -p "$out_dir"

export RABBY_MOBILE_REPRODUCE_BUILD=true
export RABBY_REPRODUCE_BUILD_NODE="$(node -v)"
export RABBY_MOBILE_REPRODUCE_CHANNEL="$channel"
export RABBY_MOBILE_REPRODUCE_OUT="$artifact"

cd "$project_dir"
bash ./scripts/deploy-android.sh

node "$script_dir/hash.mjs" \
  --platform android \
  --channel "$channel" \
  --artifact "$artifact" \
  --bundle-entry base/assets/index.android.bundle \
  --contract "stable-metro-module-ids" \
  --contract "build-time-from-commit" \
  --contract "fixed-build-root" \
  --out "$out_dir"
