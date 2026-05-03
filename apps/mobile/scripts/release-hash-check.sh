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
unset LC_ALL
export LANG=en_US.UTF-8
export LC_CTYPE=en_US.UTF-8
export LC_COLLATE=C
export LC_NUMERIC=C
export LC_TIME=C
export TZ=UTC
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
export RABBY_MOBILE_HASH_CHECK_IOS_BUILD_NUMBER="${RABBY_MOBILE_HASH_CHECK_IOS_BUILD_NUMBER:-1}"
export RABBY_MOBILE_NODE_VERSION="${RABBY_MOBILE_RELEASE_HASH_CHECK_NODE_VERSION:-22.17.1}"
export RABBY_MOBILE_METRO_MAX_WORKERS="${RABBY_MOBILE_RELEASE_HASH_CHECK_METRO_MAX_WORKERS:-1}"
export RABBY_MOBILE_METRO_NODE_MAX_OLD_SPACE_SIZE="${RABBY_MOBILE_RELEASE_HASH_CHECK_METRO_NODE_MAX_OLD_SPACE_SIZE:-8192}"
export BUNDLE_PATH="${RABBY_MOBILE_RELEASE_HASH_CHECK_BUNDLE_PATH:-$source_repo/apps/mobile/vendor/bundle}"
export BUNDLE_FORCE_RUBY_PLATFORM="${BUNDLE_FORCE_RUBY_PLATFORM:-true}"
mkdir -p "$BUNDLE_PATH"

prepare_hashing_environment() {
  local env_file=".env.hashing"
  local temp_file

  export RABBY_MOBILE_BUILD_ENV=production
  export buildchannel=appstore
  export RABBY_MOBILE_KR_PWD=pesudo_for_hashing
  export RABBY_MOBILE_CODE=RABBY_MOBILE_CODE_DEV

  if [[ -f ".env" ]]; then
    cp ".env" "$env_file"
  else
    : >"$env_file"
  fi

  local env_overrides=(
    "RABBY_MOBILE_KR_PWD" "$RABBY_MOBILE_KR_PWD"
    "RABBY_MOBILE_CODE" "$RABBY_MOBILE_CODE"
    "RABBY_MOBILE_BUILD_CHANNEL" "appstore"
    "RABBY_MOBILE_FE_SERVICE_URL" ""
  )

  for ((i = 0; i < ${#env_overrides[@]}; i += 2)); do
    local var_name="${env_overrides[i]}"
    local var_value="${env_overrides[i + 1]}"

    if [[ -z "$var_value" ]]; then
      var_value="pesudo_for_hashing"
    fi

    export "$var_name=$var_value"

    temp_file="$(mktemp)"
    grep -v -E "^[[:space:]]*$var_name=" "$env_file" >"$temp_file" || true
    mv "$temp_file" "$env_file"
    printf '%s=%s\n' "$var_name" "$var_value" >>"$env_file"
  done

  echo "ℹ️ release HASH_CHECK 已生成固定 .env.hashing"
}

write_ios_xcode_env() {
  {
    echo "export APP_ENV=$APP_ENV"
    echo "unset DEBUG"
    echo "export RABBY_MOBILE_FE_SERVICE_URL=\"\""
  } >"$mobile_dir/ios/.xcode.env.local"
}

write_android_hermes_wrapper() {
  local hermes_os_bin
  local wrapper_path="$mobile_dir/.release-hash-check-hermesc-wrapper.sh"

  case "$(uname -s)" in
    Darwin) hermes_os_bin="osx-bin" ;;
    Linux) hermes_os_bin="linux64-bin" ;;
    *)
      echo "❌ Unsupported OS for Hermes wrapper: $(uname -s)"
      exit 1
      ;;
  esac

  cat >"$wrapper_path" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

input_path=""
for arg in "$@"; do
  if [[ "$arg" != -* && -f "$arg" ]]; then
    input_path="$arg"
  fi
done

if [[ -n "$input_path" && -n "${RABBY_MOBILE_HERMESC_RAW_BUNDLE_PATH:-}" ]]; then
  mkdir -p "$(dirname "$RABBY_MOBILE_HERMESC_RAW_BUNDLE_PATH")"
  cp "$input_path" "$RABBY_MOBILE_HERMESC_RAW_BUNDLE_PATH"
fi

real_hermesc="$RABBY_MOBILE_HERMESC_MOBILE_DIR/node_modules/react-native/sdks/hermesc/$RABBY_MOBILE_HERMESC_OS_BIN/hermesc"
if [[ ! -x "$real_hermesc" ]]; then
  real_hermesc="$RABBY_MOBILE_HERMESC_MOBILE_DIR/node_modules/hermes-engine/$RABBY_MOBILE_HERMESC_OS_BIN/hermesc"
fi
if [[ ! -x "$real_hermesc" ]]; then
  echo "❌ Hermes compiler not found for release HASH_CHECK" >&2
  exit 1
fi

exec "$real_hermesc" "$@"
EOF
  chmod +x "$wrapper_path"

  export RABBY_MOBILE_HERMESC_MOBILE_DIR="$mobile_dir"
  export RABBY_MOBILE_HERMESC_OS_BIN="$hermes_os_bin"
  export RABBY_MOBILE_HERMESC_WRAPPER="$wrapper_path"
  export RABBY_MOBILE_HERMESC_RAW_BUNDLE_PATH="$mobile_dir/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle.raw"
}

stop_android_gradle_daemons() {
  if [[ -x "$mobile_dir/android/gradlew" ]]; then
    echo "ℹ️ 停止旧 Gradle daemon，避免复用非 HASH_CHECK 环境"
    (cd "$mobile_dir/android" && ./gradlew --stop >/dev/null 2>&1) || true
  fi
}

cd "$mobile_dir"
prepare_hashing_environment
if [[ "$platform" == "ios" ]]; then
  write_ios_xcode_env
else
  write_android_hermes_wrapper
  stop_android_gradle_daemons
fi

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
  bundle_path="$mobile_dir/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle"
  raw_bundle_path="$mobile_dir/android/app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle.raw"
  module_id_log_path="$mobile_dir/jsModuleId.log"
  aab_hash=""
  apk_hash=""
  bundle_hash=""
  raw_bundle_hash=""
  if [[ -f "$aab_path" ]]; then
    cp "$aab_path" "$export_dir/app-release.aab"
    aab_hash="$(hash_file "$export_dir/app-release.aab")"
  fi
  if [[ -f "$apk_path" ]]; then
    cp "$apk_path" "$export_dir/app-release.apk"
    apk_hash="$(hash_file "$export_dir/app-release.apk")"
  fi
  if [[ -f "$bundle_path" ]]; then
    cp "$bundle_path" "$export_dir/main.jsbundle_android"
    bundle_hash="$(hash_file "$export_dir/main.jsbundle_android")"
  fi
  if [[ -f "$raw_bundle_path" ]]; then
    cp "$raw_bundle_path" "$export_dir/main.raw.jsbundle_android"
    raw_bundle_hash="$(hash_file "$export_dir/main.raw.jsbundle_android")"
  fi
  if [[ -f "$module_id_log_path" ]]; then
    cp "$module_id_log_path" "$export_dir/jsModuleId_android.log"
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
  "bundle": {
    "path": "main.jsbundle_android",
    "hash": "$bundle_hash"
  },
  "raw_bundle": {
    "path": "main.raw.jsbundle_android",
    "hash": "$raw_bundle_hash"
  },
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
