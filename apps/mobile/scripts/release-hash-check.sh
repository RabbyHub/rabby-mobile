#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
source_repo="$(cd "$script_dir/../../.." && pwd -P)"

platform="${1:-}"
if [[ "$platform" != "ios" && "$platform" != "android" ]]; then
  echo "Usage: $0 {ios|android} [-- command...]"
  exit 1
fi
shift || true
if [[ "${1:-}" == "--" ]]; then
  shift
fi

git_head_full="$(git -C "$source_repo" rev-parse HEAD)"
git_head_7="$(git -C "$source_repo" rev-parse --short=7 HEAD)"
git_head_time="$(TZ=UTC0 git -C "$source_repo" show --quiet --date='format-local:%Y-%m-%dT%H:%M:%S+00:00' --format='%cd' HEAD)"
source_date_epoch="$(git -C "$source_repo" log -1 --format=%ct)"
tmp_root="$(cd /tmp && pwd -P)"
work_dir="$tmp_root/rabby-mobile-release-hash-check-$platform-$git_head_7"
mobile_dir="$work_dir/apps/mobile"
export_base="${RABBY_MOBILE_RELEASE_HASH_CHECK_EXPORT_ROOT:-$source_repo/apps/mobile}/release_hash_check_exports_$(date '+%Y%m%d-%H%M%S')"
export_dir="$export_base/$platform"

cleanup() {
  local original_exit_code=$?
  cd "$source_repo" 2>/dev/null || true
  if [[ -d "$work_dir" ]]; then
    echo "ℹ️ 删除 release HASH_CHECK worktree: $work_dir"
    git -C "$source_repo" worktree remove --force "$work_dir" >/dev/null 2>&1 || rm -rf "$work_dir"
    git -C "$source_repo" worktree prune >/dev/null 2>&1 || true
  fi
  exit "$original_exit_code"
}
trap cleanup EXIT INT TERM

if [[ -d "$work_dir" ]]; then
  echo "ℹ️ 移除已存在的 release HASH_CHECK 目录: $work_dir"
  git -C "$source_repo" worktree remove --force "$work_dir" >/dev/null 2>&1 || rm -rf "$work_dir"
  git -C "$source_repo" worktree prune >/dev/null 2>&1 || true
fi

echo "ℹ️ 创建 release HASH_CHECK worktree: $work_dir"
git -C "$source_repo" worktree add --detach "$work_dir" "$git_head_full" >/dev/null 2>&1
mkdir -p "$export_dir"

export HASH_CHECK=true
export APP_ENV=hashing
export ZERO_AR_DATE=1
export SOURCE_DATE_EPOCH="$source_date_epoch"
export SENTRY_DISABLE_AUTO_UPLOAD=true
export REALLY_UPLOAD=false
export SKIP_NOTIFY_LARK=true
unset DEBUG

export RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_HASH="$git_head_full"
export RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_TIME="$git_head_time"
export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH="${RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH:-$git_head_full}"
export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME="${RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME:-$git_head_time}"
export RABBY_MOBILE_HASHCHECK_GIT_HASH="$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH"
export RABBY_MOBILE_HASHCHECK_GIT_TIME="$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME"

if [[ "$platform" == "ios" ]]; then
  {
    echo "export APP_ENV=$APP_ENV"
    echo "unset DEBUG"
    echo "export RABBY_MOBILE_FE_SERVICE_URL=\"${RABBY_MOBILE_FE_SERVICE_URL:-}\""
  } >"$mobile_dir/ios/.xcode.env.local"
fi

cd "$mobile_dir"
if [[ "${RABBY_MOBILE_RELEASE_HASH_CHECK_SKIP_PREPARE:-false}" != "true" ]]; then
  echo "ℹ️ 准备 release HASH_CHECK worktree 依赖"
  RABBY_MOBILE_RUN_POSTINSTALL=true bash ./scripts/ci/prepare-mobile-build.sh
  if [[ -f Gemfile ]]; then
    bundle check >/dev/null 2>&1 || bundle install
  fi
fi

if [[ $# -gt 0 ]]; then
  "$@"
elif [[ "$platform" == "ios" ]]; then
  ./scripts/deploy-ios-appstore.sh
else
  buildchannel="${buildchannel:-appstore}" ./scripts/deploy-android.sh
fi

hash_file() {
  shasum -a 256 "$1" | awk '{print $1}'
}

if [[ "$platform" == "ios" ]]; then
  ipa_path="$mobile_dir/ios/Package/appstore/RabbyMobile.ipa"
  if [[ ! -f "$ipa_path" ]]; then
    echo "❌ iOS release HASH_CHECK missing IPA: $ipa_path"
    exit 1
  fi
  cp "$ipa_path" "$export_dir/RabbyMobile.ipa"
  ipa_hash="$(hash_file "$export_dir/RabbyMobile.ipa")"
  cat >"$export_dir/release_hash_check_ios.json" <<EOF
{
  "platform": "ios",
  "git_commit": "$git_head_7",
  "git_commit_full": "$git_head_full",
  "injected_git_hash": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH",
  "injected_git_time": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME",
  "ipa": {
    "path": "RabbyMobile.ipa",
    "hash": "$ipa_hash"
  }
}
EOF
  echo "🍏 iOS release IPA hash: $ipa_hash"
else
  aab_path="$mobile_dir/android/app/build/outputs/bundle/release/app-release.aab"
  apk_path="$mobile_dir/android/app/build/outputs/apk/release/app-release.apk"
  aab_hash=""
  apk_hash=""
  if [[ -f "$aab_path" ]]; then
    cp "$aab_path" "$export_dir/app-release.aab"
    aab_hash="$(hash_file "$export_dir/app-release.aab")"
  fi
  if [[ -f "$apk_path" ]]; then
    cp "$apk_path" "$export_dir/app-release.apk"
    apk_hash="$(hash_file "$export_dir/app-release.apk")"
  fi
  if [[ -z "$aab_hash" && -z "$apk_hash" ]]; then
    echo "❌ Android release HASH_CHECK missing APK/AAB outputs"
    exit 1
  fi
  cat >"$export_dir/release_hash_check_android.json" <<EOF
{
  "platform": "android",
  "git_commit": "$git_head_7",
  "git_commit_full": "$git_head_full",
  "injected_git_hash": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH",
  "injected_git_time": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME",
  "apk": {
    "path": "app-release.apk",
    "hash": "$apk_hash"
  },
  "aab": {
    "path": "app-release.aab",
    "hash": "$aab_hash"
  }
}
EOF
  echo "🤖 Android release APK hash: $apk_hash"
  echo "🤖 Android release AAB hash: $aab_hash"
fi

echo "ℹ️ release HASH_CHECK export: $export_dir"
