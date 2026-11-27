#!/usr/bin/env bash
# Build the production-identity *unsigned* AAB, then hash it and write an
# attestation (hash + toolchain + normalization list).
#
# The same file is what a second machine rebuilds for cross-checking and what
# the signing machine signs once both hashes agree.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
out_dir="${1:-$project_dir/.reproduce/android}"
artifact="$out_dir/app-release-unsigned.aab"

mkdir -p "$out_dir"

export RABBY_MOBILE_REPRODUCE_BUILD=true
export RABBY_MOBILE_REPRODUCE_OUT="$artifact"

cd "$project_dir"
bash ./scripts/deploy-android.sh

node "$script_dir/hash.mjs" \
  --platform android \
  --channel production \
  --artifact "$artifact" \
  --bundle-entry base/assets/index.android.bundle \
  --out "$out_dir"
