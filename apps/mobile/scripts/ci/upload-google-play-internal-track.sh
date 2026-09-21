#!/bin/bash

set -euo pipefail

script_dir="$( cd "$( dirname "$0" )" && pwd )"
project_dir="$(dirname "$(dirname "$script_dir")")"

cd "$project_dir"

if [ -z "${RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64:-}" ]; then
  echo "Missing Production secret: RABBY_MOBILE_GOOGLE_PLAY_SERVICE_ACCOUNT_JSON_BASE64" >&2
  exit 1
fi

. ./scripts/fns.sh --source-only

version_name=$(resolve_google_play_android_version_name)
bundle_version_code=$(resolve_google_play_bundle_version_code ./android/app/build/outputs/bundle/release/app-release.aab)

set +e
./scripts/google-play.sh upload-internal-track \
  --bundle-path ./android/app/build/outputs/bundle/release/app-release.aab \
  --draft
upload_status=$?
set -e

if [ "$upload_status" -eq 0 ]; then
  node ./scripts/notify-lark.js text \
    "📦 [Android] Google Play internal upload succeeded" \
    "Version: ${version_name} (${bundle_version_code})" \
    "Track: internal" \
    "Status: draft" \
    "Actions Job: ${GIT_ACTIONS_JOB_URL}" \
    "Git Commit: ${GIT_COMMIT_URL}" \
    "Git Ref: ${GIT_REF_URL}" || true
  exit 0
fi

if [ "$upload_status" -eq 42 ]; then
  node ./scripts/notify-lark.js text \
    "⚠️ [Android] Google Play internal upload skipped" \
    "Version: ${version_name} (${bundle_version_code})" \
    "Reason: versionCode already exists on Google Play" \
    "Track: internal" \
    "Actions Job: ${GIT_ACTIONS_JOB_URL}" \
    "Git Commit: ${GIT_COMMIT_URL}" \
    "Git Ref: ${GIT_REF_URL}" || true
  exit 0
fi

exit "$upload_status"
