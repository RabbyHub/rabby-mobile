#!/usr/bin/env bash
# Thin wrapper: the actual build reuses deploy-android.sh (the same preparation
# as feature test), stopped right after gradle produces the unsigned APK.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
output_path="${1:-$project_dir/.sign-only/app-signonly-unsigned.apk}"

cd "$project_dir"

RABBY_MOBILE_SIGN_ONLY_BUILD=true \
RABBY_MOBILE_SIGN_ONLY_APK_OUT="$output_path" \
RABBY_MOBILE_BUILD_ENV="${RABBY_MOBILE_BUILD_ENV:-regression}" \
  bash ./scripts/deploy-android.sh
