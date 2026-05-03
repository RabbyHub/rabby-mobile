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
work_root="${RABBY_MOBILE_RELEASE_HASH_CHECK_WORK_ROOT:-$tmp_root}"
mkdir -p "$work_root"
work_root="$(cd "$work_root" && pwd -P)"
work_dir="$work_root/rabby-mobile-release-hash-check-$platform-$git_head_7"
mobile_dir="$work_dir/apps/mobile"
export_base="${RABBY_MOBILE_RELEASE_HASH_CHECK_EXPORT_ROOT:-$source_repo/apps/mobile}/release_hash_check_exports_$(date '+%Y%m%d-%H%M%S')"
export_dir="$export_base/$platform"

cleanup() {
  local original_exit_code=$?
  cd "$source_repo" 2>/dev/null || true
  if [[ -d "$work_dir" ]]; then
    if [[ "$platform" == "android" && -x "$mobile_dir/android/gradlew" ]]; then
      echo "ℹ️ 停止 release HASH_CHECK Gradle daemon"
      (cd "$mobile_dir/android" && ./gradlew --stop >/dev/null 2>&1) || true
    fi
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
export RABBY_MOBILE_HASHCHECK_SOURCE_REPO="$source_repo"
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
export RABBY_MOBILE_TURBO_RVM_LOGIN_SHELL=false
export RABBY_MOBILE_YARN_INSTALL_SKIP_BUILDS="${RABBY_MOBILE_YARN_INSTALL_SKIP_BUILDS:-true}"
export RABBY_MOBILE_POSTINSTALL_DIRECT="${RABBY_MOBILE_POSTINSTALL_DIRECT:-true}"
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

  : >"$env_file"

  local env_overrides=(
    "RABBY_MOBILE_KR_PWD" "$RABBY_MOBILE_KR_PWD"
    "RABBY_MOBILE_CODE" "$RABBY_MOBILE_CODE"
    "RABBY_MOBILE_BUILD_CHANNEL" "appstore"
    "RABBY_MOBILE_FE_SERVICE_URL" ""
    "RABBY_MOBILE_E2E_SILENT_LOGS" "false"
    "DEV_CONSOLE_URL" ""
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

  cp "$env_file" ".env"
  echo "ℹ️ release HASH_CHECK 已生成固定 .env / .env.hashing"
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
if [[ -f Gemfile ]]; then
  bundle config set --local path "$BUNDLE_PATH" >/dev/null
  bundle config set --local force_ruby_platform "$BUNDLE_FORCE_RUBY_PLATFORM" >/dev/null
fi
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

hash_directory_contents() {
  local content_dir="$1"
  local report_file="$2"

  (
    cd "$content_dir"
    find . -type f ! -name ".DS_Store" -print0 |
      LC_ALL=C LC_COLLATE=C sort -z |
      while IFS= read -r -d '' rel_path; do
        local file_hash
        file_hash="$(shasum -a 256 "$rel_path" | awk '{print $1}')"
        printf '%s  %s\n' "$file_hash" "${rel_path#./}"
      done
  ) | tee "$report_file" | shasum -a 256 | awk '{print $1}'
}

hashcheck_alt_tmp_path() {
  local path_value="$1"

  case "$path_value" in
    /private/tmp/*) printf '/tmp/%s\n' "${path_value#/private/tmp/}" ;;
    /tmp/*) printf '/private/tmp/%s\n' "${path_value#/tmp/}" ;;
    *) printf '%s\n' "$path_value" ;;
  esac
}

normalize_ios_asm_path_prefixes() {
  local asm_file="$1"
  local repo_root="$2"
  local repo_root_alt="$3"
  local developer_dir="$4"

  HASHCHECK_REPO_ROOT="$repo_root" \
    HASHCHECK_REPO_ROOT_ALT="$repo_root_alt" \
    HASHCHECK_DEVELOPER_DIR="$developer_dir" \
    HASHCHECK_EXPORT_DIR="${export_dir:-}" \
    perl -0pi -e '
      my %path_map = (
        HASHCHECK_REPO_ROOT => "/__rabby_repo__",
        HASHCHECK_REPO_ROOT_ALT => "/__rabby_repo__",
        HASHCHECK_DEVELOPER_DIR => "/__rabby_xcode_developer__",
        HASHCHECK_EXPORT_DIR => "/__rabby_hashcheck_export__",
      );

      for my $key (sort { length($ENV{$b} // "") <=> length($ENV{$a} // "") } keys %path_map) {
        my $from = $ENV{$key};
        next unless defined $from && length $from;
        s/\Q$from\E/$path_map{$key}/g;
      }
    ' "$asm_file"
}

normalize_ios_asset_catalog() {
  local assets_car_path="$1"

  if [[ ! -f "$assets_car_path" ]]; then
    return
  fi

  xcrun assetutil --info "$assets_car_path" >"$assets_car_path.json"
  perl -0pi \
    -e 's/"Timestamp" : [0-9]+/"Timestamp" : 0/g;' \
    -e 's/"DumpToolVersion" : .*?([,\n])/"DumpToolVersion" : 0$1/g;' \
    -e 's/"Authoring Tool" : .*?([,\n])/"Authoring Tool" : ""$1/g;' \
    "$assets_car_path.json"
  rm -f "$assets_car_path"
}

normalize_ios_macho_file() {
  local macho_path="$1"
  local normalized_app_path="$2"
  local repo_root="$3"
  local repo_root_alt="$4"
  local developer_dir="$5"
  local link_map_path="$6"
  local asm_path="$macho_path.s"
  local normalized_asm_path="$macho_path.asm"
  local rel_path

  if ! otool -tV "$macho_path" >"$asm_path" 2>/dev/null; then
    rm -f "$asm_path"
    return
  fi

  normalize_ios_asm_path_prefixes "$asm_path" "$repo_root" "$repo_root_alt" "$developer_dir"
  rel_path="${macho_path#$normalized_app_path/}"

  if [[ "$rel_path" == "RabbyMobile" && -f "$link_map_path" ]]; then
    node "$mobile_dir/scripts/validate-hash/normalize_objc_msgsend_ldr.js" "$asm_path" "$link_map_path" >"$normalized_asm_path"
    rm -f "$asm_path"
  else
    mv "$asm_path" "$normalized_asm_path"
  fi

  rm -f "$macho_path"
}

normalize_ios_release_content() {
  local ipa_path="$1"
  local normalized_hash_report="$2"
  local normalized_dir="$export_dir/normalized_ipa_content"
  local normalized_app_path="$normalized_dir/Payload/RabbyMobile.app"
  local developer_dir
  local repo_root_alt
  local link_map_path="$mobile_dir/ios/LinkMap.txt"
  local normalized_hash

  rm -rf "$normalized_dir"
  mkdir -p "$normalized_dir"
  unzip -q "$ipa_path" -d "$normalized_dir"

  developer_dir="$(xcode-select -p)"
  repo_root_alt="$(hashcheck_alt_tmp_path "$work_dir")"

  find "$normalized_dir" -name "_CodeSignature" -type d -prune -exec rm -rf {} +
  find "$normalized_dir" -name "embedded.mobileprovision" -type f -delete

  find "$normalized_dir" -name Info.plist -type f -print0 |
    while IFS= read -r -d '' plist_path; do
      "$mobile_dir/scripts/validate-hash/modify_plist_value.sh" "$plist_path" "BuildMachineOSBuild" null >/dev/null
    done

  find "$normalized_dir" -name Assets.car -type f -print0 |
    while IFS= read -r -d '' assets_car_path; do
      normalize_ios_asset_catalog "$assets_car_path"
    done

  find "$normalized_app_path" -type f -print0 |
    while IFS= read -r -d '' file_path; do
      if file "$file_path" | grep -q "Mach-O"; then
        normalize_ios_macho_file "$file_path" "$normalized_app_path" "$work_dir" "$repo_root_alt" "$developer_dir" "$link_map_path"
      fi
    done

  normalized_hash="$(hash_directory_contents "$normalized_dir" "$normalized_hash_report")"
  rm -rf "$normalized_dir"
  printf '%s\n' "$normalized_hash"
}

resolve_android_llvm_strip() {
  local candidate
  local search_roots=()
  local android_local_properties="$mobile_dir/android/local.properties"
  local local_sdk_dir
  local local_ndk_dir

  if [[ -n "${ANDROID_NDK_ROOT:-}" ]]; then
    search_roots+=("$ANDROID_NDK_ROOT")
  fi
  if [[ -n "${ANDROID_NDK_HOME:-}" ]]; then
    search_roots+=("$ANDROID_NDK_HOME")
  fi
  if [[ -n "${ANDROID_NDK:-}" ]]; then
    search_roots+=("$ANDROID_NDK")
  fi
  if [[ -n "${NDK_HOME:-}" ]]; then
    search_roots+=("$NDK_HOME")
  fi
  if [[ -n "${ANDROID_NDK_LATEST_HOME:-}" ]]; then
    search_roots+=("$ANDROID_NDK_LATEST_HOME")
  fi
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME/ndk" ]]; then
    search_roots+=("$ANDROID_HOME/ndk")
  fi
  if [[ -n "${ANDROID_HOME:-}" && -d "$ANDROID_HOME/ndk-bundle" ]]; then
    search_roots+=("$ANDROID_HOME/ndk-bundle")
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT/ndk" ]]; then
    search_roots+=("$ANDROID_SDK_ROOT/ndk")
  fi
  if [[ -n "${ANDROID_SDK_ROOT:-}" && -d "$ANDROID_SDK_ROOT/ndk-bundle" ]]; then
    search_roots+=("$ANDROID_SDK_ROOT/ndk-bundle")
  fi
  if [[ -f "$android_local_properties" ]]; then
    local_sdk_dir="$(sed -n 's/^sdk\.dir=//p' "$android_local_properties" | tail -n 1)"
    local_ndk_dir="$(sed -n 's/^ndk\.dir=//p' "$android_local_properties" | tail -n 1)"
    if [[ -n "$local_ndk_dir" ]]; then
      search_roots+=("$local_ndk_dir")
    fi
    if [[ -n "$local_sdk_dir" ]]; then
      search_roots+=("$local_sdk_dir/ndk")
      search_roots+=("$local_sdk_dir/ndk-bundle")
    fi
  fi
  search_roots+=(
    "$HOME/Library/Android/sdk/ndk"
    "$HOME/Library/Android/sdk/ndk-bundle"
    "$HOME/Android/Sdk/ndk"
    "$HOME/Android/Sdk/ndk-bundle"
    "/Users/Shared/Library/Android/sdk/ndk"
    "/Users/Shared/Library/Android/sdk/ndk-bundle"
    "/opt/android-sdk/ndk"
    "/opt/android-sdk/ndk-bundle"
    "/usr/local/share/android-sdk/ndk"
    "/usr/local/share/android-sdk/ndk-bundle"
  )

  for search_root in "${search_roots[@]}"; do
    [[ -d "$search_root" ]] || continue
    while IFS= read -r candidate; do
      if [[ -x "$candidate" ]]; then
        printf '%s\n' "$candidate"
        return
      fi
    done < <(find "$search_root" -path '*/toolchains/llvm/prebuilt/*/bin/llvm-strip' \( -type f -o -type l \) 2>/dev/null | LC_ALL=C sort)
  done

  if command -v llvm-strip >/dev/null 2>&1; then
    command -v llvm-strip
  fi
}

normalize_android_release_archive_content() {
  local archive_path="$1"
  local archive_kind="$2"
  local normalized_hash_report="$3"
  local llvm_strip_path="${RABBY_MOBILE_ANDROID_LLVM_STRIP:-}"
  local normalized_hash
  local strip_work_dir

  # Hash ZIP entries directly instead of extracting the archive. APKs can contain
  # resource entries that differ only by case, and macOS' default filesystem would
  # collapse those paths during unzip, making the normalized hash host-dependent.
  strip_work_dir="$(mktemp -d "${TMPDIR:-/tmp}/rabby-android-release-normalize.XXXXXX")"

  if [[ -z "$llvm_strip_path" ]]; then
    llvm_strip_path="$(resolve_android_llvm_strip || true)"
  fi

  if [[ -z "$llvm_strip_path" || ! -x "$llvm_strip_path" ]]; then
    echo "❌ Android release normalization requires llvm-strip, but it was not found" >&2
    rm -rf "$strip_work_dir"
    return 1
  fi

  normalized_hash="$(
    zipinfo -1 "$archive_path" |
      LC_ALL=C LC_COLLATE=C sort |
      while IFS= read -r entry_path; do
        [[ -n "$entry_path" && "$entry_path" != */ ]] || continue
        if should_skip_android_release_archive_entry "$entry_path"; then
          continue
        fi

        if [[ "$entry_path" == *.so ]]; then
          local so_hash_name
          local so_path
          so_hash_name="$(printf '%s' "$entry_path" | shasum -a 256 | awk '{print $1}')"
          so_path="$strip_work_dir/$so_hash_name.so"
          unzip -p "$archive_path" "$entry_path" >"$so_path"
          chmod u+w "$so_path" 2>/dev/null || true
          "$llvm_strip_path" --strip-all "$so_path" >/dev/null 2>&1 || true
          printf '%s  %s\n' "$(shasum -a 256 "$so_path" | awk '{print $1}')" "$entry_path"
        else
          printf '%s  %s\n' "$(unzip -p "$archive_path" "$entry_path" | shasum -a 256 | awk '{print $1}')" "$entry_path"
        fi
      done
  )"

  printf '%s\n' "$normalized_hash" >"$normalized_hash_report"
  rm -rf "$strip_work_dir"
  printf '%s\n' "$normalized_hash" | shasum -a 256 | awk '{print $1}'
}

should_skip_android_release_archive_entry() {
  local entry_path="$1"

  case "$entry_path" in
    META-INF/*|assets/dexopt/baseline.prof|assets/dexopt/baseline.profm|BUNDLE-METADATA/com.android.tools*|BUNDLE-METADATA/com.android.tools*/*)
      return 0
      ;;
  esac

  return 1
}

if [[ "$platform" == "ios" ]]; then
  ipa_path="$mobile_dir/ios/Package/appstore/RabbyMobile.ipa"
  if [[ ! -f "$ipa_path" ]]; then
    echo "❌ iOS release HASH_CHECK missing IPA: $ipa_path"
    exit 1
  fi
  cp "$ipa_path" "$export_dir/RabbyMobile.ipa"
  ipa_hash="$(hash_file "$export_dir/RabbyMobile.ipa")"
  normalized_content_report="$export_dir/file_hashes_ios_release_normalized_content.txt"
  normalized_content_hash="$(normalize_ios_release_content "$ipa_path" "$normalized_content_report")"
  cat >"$export_dir/release_hash_check_ios.json" <<EOF
{
  "platform": "ios",
  "git_commit": "$git_head_7",
  "git_commit_full": "$git_head_full",
  "injected_git_hash": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH",
  "injected_git_time": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME",
  "hash": "$normalized_content_hash",
  "final_artifact_kind": "normalized_ipa_app_content",
  "final_artifact_hash": "$normalized_content_hash",
  "ipa": {
    "path": "RabbyMobile.ipa",
    "hash": "$ipa_hash"
  },
  "normalized_content": {
    "kind": "normalized_ipa_app_content",
    "hash": "$normalized_content_hash",
    "file_hashes": "file_hashes_ios_release_normalized_content.txt"
  }
}
EOF
  echo "🍏 iOS release IPA hash: $ipa_hash"
  echo "🍏 iOS release normalized content hash: $normalized_content_hash"
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
  normalized_apk_hash=""
  normalized_aab_hash=""
  normalized_release_hash=""
  if [[ -f "$aab_path" ]]; then
    cp "$aab_path" "$export_dir/app-release.aab"
    aab_hash="$(hash_file "$export_dir/app-release.aab")"
    normalized_aab_hash="$(normalize_android_release_archive_content "$aab_path" "aab" "$export_dir/file_hashes_android_release_aab_normalized_content.txt")"
  fi
  if [[ -f "$apk_path" ]]; then
    cp "$apk_path" "$export_dir/app-release.apk"
    apk_hash="$(hash_file "$export_dir/app-release.apk")"
    normalized_apk_hash="$(normalize_android_release_archive_content "$apk_path" "apk" "$export_dir/file_hashes_android_release_apk_normalized_content.txt")"
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
  normalized_release_hash="$(printf '%s\n%s\n' "$normalized_apk_hash" "$normalized_aab_hash" | grep -v '^$' | LC_ALL=C sort | shasum -a 256 | awk '{print $1}')"
  cat >"$export_dir/release_hash_check_android.json" <<EOF
{
  "platform": "android",
  "git_commit": "$git_head_7",
  "git_commit_full": "$git_head_full",
  "injected_git_hash": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH",
  "injected_git_time": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME",
  "hash": "$normalized_release_hash",
  "final_artifact_kind": "combined_normalized_android_release_content",
  "final_artifact_hash": "$normalized_release_hash",
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
    "hash": "$apk_hash",
    "normalized_content": {
      "kind": "normalized_apk_content",
      "hash": "$normalized_apk_hash",
      "file_hashes": "file_hashes_android_release_apk_normalized_content.txt"
    }
  },
  "aab": {
    "path": "app-release.aab",
    "hash": "$aab_hash",
    "normalized_content": {
      "kind": "normalized_aab_content",
      "hash": "$normalized_aab_hash",
      "file_hashes": "file_hashes_android_release_aab_normalized_content.txt"
    }
  },
  "normalized_content": {
    "kind": "combined_normalized_android_release_content",
    "hash": "$normalized_release_hash",
    "apk_hash": "$normalized_apk_hash",
    "aab_hash": "$normalized_aab_hash"
  }
}
EOF
  echo "🤖 Android release APK hash: $apk_hash"
  echo "🤖 Android release AAB hash: $aab_hash"
  echo "🤖 Android release normalized content hash: $normalized_release_hash"
fi

echo "ℹ️ release HASH_CHECK export: $export_dir"
