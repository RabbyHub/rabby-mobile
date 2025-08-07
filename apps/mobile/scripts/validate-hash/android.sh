# build-scripts/android.sh
#!/bin/bash
# Android 专属构建和哈希逻辑

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

  # 关键路径 AOT 机器码
  files_to_delete=(
    "assets/dexopt/baseline.prof"
    "assets/dexopt/baseline.profm"
  )

  zip -d -q $unsigned_apk_path "${files_to_delete[@]}" || true

  # 计算哈希
  local file_hashes_report="$export_dir/file_hashes_android.txt"
  local overall_hash=$(shasum -a 256 $unsigned_apk_path | awk '{print $1}')

  local bundle_path="$PROJECT_DIR/android/app/build/generated/assets/createBundleHashJsAndAssets/index.android.bundle"
  local bundle_hash=$(shasum -a 256 "$bundle_path" | awk '{print $1}')

  # 导出产物和报告
  mv "$bundle_path" "$export_dir/main.jsbundle_android"
  {
    cat <<EOF
{
  "platform": "android",
  "build_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "git_commit": "$GIT_HEAD_7",
  "hash": "$overall_hash",
  "bundle_hash": "$bundle_hash",
  "environment": {
    "java_version": "$(java -version 2>&1 | awk -F '\"' '/version/ {print $2}')",
    "gradle_version": "$(cd "$PROJECT_DIR/android" && ./gradlew --version | grep 'Gradle' | awk '{print $2}')",
    "node_version": "$(node -v)",
    "yarn_version": "$(yarn -v)"
  }
}
EOF
  } >"$build_report_json"

  echo "$overall_hash"
}
