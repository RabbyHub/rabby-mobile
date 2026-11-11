#!/usr/bin/env bash
# Thin wrapper: the actual build reuses deploy-ios-adhoc.sh (the same artifact
# preparation as feature test), then archives with code signing disabled.
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
archive_path="${1:-$project_dir/.sign-only/RabbyMobile.xcarchive}"

cd "$project_dir"

. "$project_dir/scripts/fns.sh" --source-only
# Resolve the build environment first: `RABBY_MOBILE_CODE` lives in
# `.env.regression` for sign-only packages, and the candidate-file lookup only
# reads the files for the active build environment.
export RABBY_MOBILE_BUILD_ENV="${RABBY_MOBILE_BUILD_ENV:-regression}"
load_env_var_from_candidate_files RABBY_MOBILE_CODE || true
validate_rabbit_code || exit 1

RABBY_MOBILE_IOS_BUILD_UNSIGNED=true \
RABBY_MOBILE_IOS_UNSIGNED_ARCHIVE="$archive_path" \
  bash ./scripts/deploy-ios-adhoc.sh
