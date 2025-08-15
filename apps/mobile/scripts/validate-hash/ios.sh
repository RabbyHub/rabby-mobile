# build-scripts/ios.sh
#!/bin/bash
# iOS 专属构建和哈希逻辑

run_ios_build_and_hash() {
  echo ""
  echo "================================================="
  echo "            开始 iOS 构建与校验"
  echo "================================================="

  local export_dir="$1"
  local build_report_json="$export_dir/build_hashes_ios.json"
  local app_path="$PROJECT_DIR/ios/Package/RabbyMobile.xcarchive/Products/Applications/RabbyMobile.app"

  local build_log_file="$export_dir/build.log"
  echo "ℹ️ iOS 构建日志将保存至: $build_log_file"

  # 清理, 安装 Pods, 构建
  echo "⏳ 清理环境、安装 Pods 并执行构建..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/RabbyMobile-* "$PROJECT_DIR/ios/Package" "$PROJECT_DIR/ios/build" "$PROJECT_DIR/ios/DerivedData"

  cd "$PROJECT_DIR/ios" && bundle exec pod deintegrate &>/dev/null && RCT_NEW_ARCH_ENABLED=0 bundle exec pod install --deployment --repo-update --allow-root >>"$build_log_file" 2>&1
  if [ $? -ne 0 ]; then
    echo "❌ Pods 安装失败，请检查日志: $build_log_file"
    exit 1
  fi

  cd "$PROJECT_DIR"
  git checkout "$PROJECT_DIR/ios/RabbyMobile.xcodeproj/project.pbxproj"
  bundle exec fastlane ios hashcheck >>"$build_log_file" 2>&1
  if [ ! -d "$app_path" ]; then
    echo "❌ Fastlane 构建失败，未在 $app_path 找到 .app 文件，请检查日志: $build_log_file"
    exit 1
  fi
  echo "✅ 构建完成"

  # 校验 Metro Module ID
  echo "⏳ 校验 Metro 模块 ID"
  {
    echo -e "\n--- Metro Module ID Validation at $(date) ---\n"
    validate_metro_modules
  } >> "$build_log_file" 2>&1
  if [ ${PIPESTATUS[0]} -ne 0 ]; then echo "❌ Metro 模块 ID 校验失败，请检查日志: $build_log_file"; exit 1; fi
  mv "$PROJECT_DIR/jsModuleId.log" "$export_dir/jsModuleId_ios.log"

  # 范式化 .app 包内容
  echo "⏳ 对构建产物进行范式化处理..."

  if [ -f "$app_path/Assets.car" ]; then
    xcrun assetutil --info "$app_path/Assets.car" >"$app_path/Assets.car.json"
    # 生成日期会不一样
    sed -i '' -e 's/"Timestamp" : [0-9]*/"Timestamp" : 0/' "$app_path/Assets.car.json"
    # 版本号不同
    sed -i '' -e 's/"DumpToolVersion" : .*/"DumpToolVersion" : 0,/' "$app_path/Assets.car.json"
    # "Authoring Tool": "@(#)PROGRAM:CoreThemeDefinition  PROJECT:CoreThemeDefinition-611  [IIO-2661.3.6]", 版本号会不一样
    sed -i '' -e 's/"Authoring Tool" : .*/"Authoring Tool" : "",/' "$app_path/Assets.car.json"
    rm -f "$app_path/Assets.car"
  fi

  otool -tV "$app_path/RabbyMobile" >"$app_path/RabbyMobile.s"
  node "$SCRIPT_DIR/normalize_objc_msgsend_ldr.js" "$app_path/RabbyMobile.s" "$PROJECT_DIR/ios/LinkMap.txt" >"$app_path/RabbyMobile.asm"
  rm -f "$app_path/RabbyMobile" "$app_path/RabbyMobile.s"

  # Trim machine-related data from the assembly file
  fields_remove=(
    "BuildMachineOSBuild"
    # "DTPlatformBuild" "DTPlatformVersion" "DTSDKBuild" "DTSDKName" "DTXcode" "DTXcodeBuild"
  )
  # 遍历并修改 Info.plist 中的字段
  for field in "${fields_remove[@]}"; do
    find "$app_path" -name Info.plist -exec $SCRIPT_DIR/modify_plist_value.sh {} "$field" null \;
  done

  echo "✅ 范式化处理完成"

  # 计算哈希
  echo "⏳ 计算 iOS 哈希..."
  local file_hashes_report="$export_dir/file_hashes_ios.txt"
  local overall_hash=$(find "$app_path" -type f ! -name ".DS_Store" -print0 | LC_COLLATE=C sort -z | xargs -0 shasum -a 256 | tee "$file_hashes_report" | shasum -a 256 | awk '{print $1}')
  local bundle_hash=$(shasum -a 256 "$app_path/main.jsbundle" | awk '{print $1}')

  # 导出产物和报告
  rsync -a "$app_path/RabbyMobile.asm" "$export_dir/RabbyMobile.asm"
  rsync -a "$app_path/Assets.car.json" "$export_dir/Assets.car.json"
  rsync -a "$app_path/main.jsbundle" "$export_dir/main.jsbundle_ios"
  mv "$PROJECT_DIR/ios/LinkMap.txt" "$export_dir/LinkMap.txt"

  local xcode_full_version=$(xcodebuild -version) # 直接 head -n 1 还会报错
  local xcode_version=$(echo "$xcode_full_version" | head -n 1)
  {
    cat <<EOF
{
  "platform": "ios",
  "build_time": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "git_commit": "$GIT_HEAD_7",
  "hash": "$overall_hash",
  "bundle_hash": "$bundle_hash",
  "environment": {
    "macOS_version": "$(sw_vers -productVersion) ($(sw_vers -buildVersion))",
    "xcode_version": "$xcode_version",
    "cocoapods_version": "$(bundle exec pod --version)",
    "clang_version": "$(clang --version | head -n1)",
    "node_version": "$(node -v)",
    "yarn_version": "$(yarn -v)"
  }
}
EOF
  } >"$build_report_json"

  echo "$overall_hash"
}
