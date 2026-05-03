# build-scripts/android.sh
#!/bin/bash
# Android 专属构建和哈希逻辑

resolve_android_llvm_strip() {
  local candidate
  local search_roots=()
  local android_local_properties="$PROJECT_DIR/android/local.properties"
  local local_sdk_dir
  local local_ndk_dir

  if [[ -n "${RABBY_MOBILE_ANDROID_LLVM_STRIP:-}" ]]; then
    printf '%s\n' "$RABBY_MOBILE_ANDROID_LLVM_STRIP"
    return
  fi
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
    done < <(find "$search_root" -path '*/toolchains/llvm/prebuilt/*/bin/llvm-strip' -type f 2>/dev/null | LC_ALL=C sort)
  done

  if command -v llvm-strip >/dev/null 2>&1; then
    command -v llvm-strip
  fi
}

normalize_android_apk_content() {
  local apk_path="$1"
  local normalized_hash_report="$2"
  local normalized_dir="$3"
  local llvm_strip_path
  local normalized_hash

  rm -rf "$normalized_dir"
  mkdir -p "$normalized_dir"
  unzip -qo "$apk_path" -d "$normalized_dir"

  rm -rf "$normalized_dir/META-INF"
  rm -f "$normalized_dir/assets/dexopt/baseline.prof" "$normalized_dir/assets/dexopt/baseline.profm"

  llvm_strip_path="$(resolve_android_llvm_strip || true)"
  if [[ -z "$llvm_strip_path" || ! -x "$llvm_strip_path" ]]; then
    echo "❌ Android hash normalization requires llvm-strip, but it was not found" >&2
    return 1
  fi

  find "$normalized_dir" -name "*.so" -type f -print0 |
    while IFS= read -r -d '' so_path; do
      chmod u+w "$so_path" 2>/dev/null || true
      "$llvm_strip_path" --strip-all "$so_path" >/dev/null 2>&1 || true
    done

  normalized_hash="$(hash_directory_contents "$normalized_dir" "$normalized_hash_report")"
  rm -rf "$normalized_dir"
  printf '%s\n' "$normalized_hash"
}

run_android_build_and_hash() {
  echo ""
  echo "================================================="
  echo "          开始 Android 构建与校验"
  echo "================================================="

  local export_dir="$1"
  local build_report_json="$export_dir/build_hashes_android.json"
  local unsigned_apk_path="$export_dir/app-hash-unsigned.apk"

  local build_log_file="$export_dir/build.log"
  echo "ℹ️ Android 构建日志将保存至: $build_log_file"

  # 构建
  echo "⏳ 执行 Android 构建..."
  bundle exec fastlane android hashcheck destination_path:"$export_dir" >>"$build_log_file" 2>&1
  if [ ! -f "$unsigned_apk_path" ]; then
    echo "❌ Fastlane 构建失败，未找到未签名的 APK，请检查日志: $build_log_file"
    exit 1
  fi
  echo "✅ 构建完成"

# 校验 Metro Module ID (输出到日志)
  echo "⏳ 校验 Metro 模块 ID"
  {
    echo -e "\n--- Metro Module ID Validation at $(date) ---\n"
    validate_metro_modules
  } >> "$build_log_file" 2>&1
  # 检查上一条命令（即 validate_metro_modules）的退出状态码
  if [ ${PIPESTATUS[0]} -ne 0 ]; then echo "❌ Metro 模块 ID 校验失败，请检查日志: $build_log_file"; exit 1; fi
  mv "$PROJECT_DIR/jsModuleId.log" "$export_dir/jsModuleId_android.log"

  # 计算哈希
  local raw_apk_hash
  local normalized_apk_hash
  local file_hashes_report="$export_dir/file_hashes_android_normalized_content.txt"
  local normalized_content_dir="$export_dir/normalized_android_apk_content"
  raw_apk_hash=$(shasum -a 256 "$unsigned_apk_path" | awk '{print $1}')
  if ! normalized_apk_hash="$(normalize_android_apk_content "$unsigned_apk_path" "$file_hashes_report" "$normalized_content_dir")"; then
    echo "❌ Android normalized content hash failed"
    exit 1
  fi

  local bundle_path="$PROJECT_DIR/android/app/build/generated/assets/createBundleHashJsAndAssets/index.android.bundle"
  local bundle_hash=$(shasum -a 256 "$bundle_path" | awk '{print $1}')

  # 导出产物和报告
  mv "$bundle_path" "$export_dir/main.jsbundle_android"
  local java_version
  local gradle_version
  local node_version
  local yarn_version
  suspend_cleanup_trap
  java_version=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' || true)
  gradle_version=$("$PROJECT_DIR/android/gradlew" --version | awk '/^Gradle / {print $2; exit}' || true)
  node_version=$(node -v || true)
  yarn_version=$(yarn -v || true)
  restore_cleanup_trap
{
  cat <<EOF
{
  "platform": "android",
  "build_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "git_commit": "$GIT_HEAD_7",
  "git_commit_full": "$RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_HASH",
  "actual_git": {
    "commit": "$GIT_HEAD_7",
    "commit_full": "$RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_HASH",
    "commit_time": "$RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_TIME"
  },
  "injected_git": {
    "commit_full": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH",
    "commit_time": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME",
    "commit_source": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH_SOURCE",
    "time_source": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME_SOURCE"
  },
  "hash": "$normalized_apk_hash",
  "bundle_hash": "$bundle_hash",
  "artifacts": {
    "js_bundle": {
      "hash": "$bundle_hash",
      "exported_as": "main.jsbundle_android"
    },
    "raw_apk": {
      "hash": "$raw_apk_hash",
      "exported_as": "app-hash-unsigned.apk"
    },
    "normalized_apk": {
      "hash": "$normalized_apk_hash",
      "file_hashes": "file_hashes_android_normalized_content.txt"
    }
  },
  "comparison": {
    "bundle_hash": "$bundle_hash",
    "final_artifact_kind": "normalized_apk_content",
    "final_artifact_hash": "$normalized_apk_hash",
    "raw_apk_hash": "$raw_apk_hash"
  },
  "environment": {
    "java_version": "$java_version",
    "gradle_version": "$gradle_version",
    "node_version": "$node_version",
    "yarn_version": "$yarn_version"
  }
}
EOF
  } >"$build_report_json"

  echo "$normalized_apk_hash"
}
