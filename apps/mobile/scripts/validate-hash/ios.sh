# build-scripts/ios.sh
#!/bin/bash
# iOS 专属构建和哈希逻辑

# Installs the pods pinned by the committed Podfile.lock.
#
# `--deployment` is intentionally not used: it also rejects upstream podspec
# metadata edits such as a version being deprecated on trunk, which change
# SPEC CHECKSUMS without changing what gets built. verify_installed_podfile_lock
# enforces the lockfile contract afterwards instead.
#
# The first attempt uses the local spec index so only missing podspecs are
# fetched from the CDN. Later attempts refresh trunk, covering a stale index
# and transient CDN failures.
install_pods_for_validation() {
  local committed_podfile_lock="$1"
  local podfile_lock="$2"
  local build_log_file="$3"
  local max_attempts=3
  local attempt=1
  local repo_update_flag=""

  while [ "$attempt" -le "$max_attempts" ]; do
    # Each attempt resolves from the committed lockfile, never from a lockfile
    # a previous failed attempt may have rewritten.
    cp "$committed_podfile_lock" "$podfile_lock"
    echo -e "\n--- pod install attempt $attempt/$max_attempts ${repo_update_flag} at $(date) ---\n" >>"$build_log_file"
    # shellcheck disable=SC2086 # empty flag must expand to nothing
    if RCT_NEW_ARCH_ENABLED="${RCT_NEW_ARCH_ENABLED:-1}" bundle exec pod install $repo_update_flag --allow-root >>"$build_log_file" 2>&1; then
      return 0
    fi
    if [ "$attempt" -lt "$max_attempts" ]; then
      echo "[warn] pod install attempt $attempt failed; retrying with --repo-update" >>"$build_log_file"
      sleep $((attempt * 15))
    fi
    repo_update_flag="--repo-update"
    attempt=$((attempt + 1))
  done
  return 1
}

# Compares the Podfile.lock written by pod install with the committed one.
# Only checksum changes caused by an upstream deprecation are accepted; see
# verify_podfile_lock.rb for the exact rule.
verify_installed_podfile_lock() {
  local committed_podfile_lock="$1"
  local podfile_lock="$2"
  local build_log_file="$3"
  local output
  local status=0

  output=$(bundle exec ruby "$SCRIPT_DIR/verify_podfile_lock.rb" "$committed_podfile_lock" "$podfile_lock" 2>&1) || status=$?
  printf '\n--- Podfile.lock verification at %s ---\n%s\n' "$(date)" "$output" >>"$build_log_file"
  # Surface accepted deprecations and failures on the console as well.
  printf '%s\n' "$output" | grep -E '^\[(warn|error)\]' >&2 || true
  return "$status"
}

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

  cd "$PROJECT_DIR/ios"
  local podfile_lock="$PROJECT_DIR/ios/Podfile.lock"
  local committed_podfile_lock="$export_dir/Podfile.lock.committed"
  cp "$podfile_lock" "$committed_podfile_lock"

  # A fresh validation checkout has no Pods yet; deintegrate can fail there.
  # Keep its output for diagnosis and continue to the actual pod install.
  if ! bundle exec pod deintegrate >>"$build_log_file" 2>&1; then
    echo "[warn] pod deintegrate failed; continuing to pod install" >>"$build_log_file"
  fi
  if ! install_pods_for_validation "$committed_podfile_lock" "$podfile_lock" "$build_log_file"; then
    echo "❌ Pods 安装失败，请检查日志: $build_log_file"
    exit 1
  fi
  if ! verify_installed_podfile_lock "$committed_podfile_lock" "$podfile_lock" "$build_log_file"; then
    echo "❌ Podfile.lock 与提交版本不一致，请检查日志: $build_log_file"
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

  # Normalize every asset catalog, including framework catalogs.
  while IFS= read -r -d '' assets_car; do
    xcrun assetutil --info "$assets_car" >"$assets_car.json"
    # 生成日期会不一样
    sed -i '' -e 's/"Timestamp" : [0-9]*/"Timestamp" : 0/' "$assets_car.json"
    # 版本号不同
    sed -i '' -e 's/"DumpToolVersion" : .*/"DumpToolVersion" : 0,/' "$assets_car.json"
    # "Authoring Tool": "@(#)PROGRAM:CoreThemeDefinition  PROJECT:CoreThemeDefinition-611  [IIO-2661.3.6]", 版本号会不一样
    sed -i '' -e 's/"Authoring Tool" : .*/"Authoring Tool" : "",/' "$assets_car.json"
    # CoreUI 记录的是 assetutil/CoreUI 工具版本，系统补丁版本不同也可能变化
    sed -i '' -e 's/"AssetStorageVersion" : .*/"AssetStorageVersion" : "",/' "$assets_car.json"
    sed -i '' -e 's/"CoreUIVersion" : [0-9]*/"CoreUIVersion" : 0/' "$assets_car.json"
    sed -i '' -e 's/"MainVersion" : "@(#)PROGRAM:CoreUI  PROJECT:CoreUI-[^"]*"/"MainVersion" : "@(#)PROGRAM:CoreUI  PROJECT:CoreUI-0"/' "$assets_car.json"
    rm -f "$assets_car"
  done < <(find "$app_path" -name Assets.car -type f -print0)

  # Xcode may be installed as /Applications/Xcode.app or
  # /Applications/Xcode-<version>.app. Both the selection path and paths
  # embedded in Mach-O text sections must be normalized before hashing.
  local developer_dir
  developer_dir="${DEVELOPER_DIR:-$(xcode-select -p)}"
  local repo_root_alt=""
  case "$WORK_DIR" in
    /tmp/*) repo_root_alt="/private$WORK_DIR" ;;
    /private/tmp/*) repo_root_alt="${WORK_DIR#/private}" ;;
  esac
  local link_map_path="$PROJECT_DIR/ios/LinkMap.txt"

  # Replace every Mach-O file with its normalized `otool -tV` text. This
  # mirrors the release hashcheck contract and also removes volatile paths
  # from framework binaries such as OpenSSL.framework/OpenSSL.
  while IFS= read -r -d '' macho_path; do
    if ! file "$macho_path" | grep -q "Mach-O"; then
      continue
    fi
    if [ "$macho_path" = "$app_path/RabbyMobile" ]; then
      if ! otool -tV "$macho_path" >"$macho_path.s" 2>/dev/null; then
        rm -f "$macho_path.s"
        continue
      fi
      node "$SCRIPT_DIR/normalize_asm_paths.js" "$macho_path.s" \
        --repo-root "$WORK_DIR" \
        --repo-root-alt "$repo_root_alt" \
        --developer-dir "$developer_dir" \
        --export-dir "$export_dir"
      if [ -f "$link_map_path" ]; then
        node "$SCRIPT_DIR/normalize_objc_msgsend_ldr.js" "$macho_path.s" "$link_map_path" >"$macho_path.asm"
        rm -f "$macho_path.s"
      else
        mv "$macho_path.s" "$macho_path.asm"
      fi
      rm -f "$macho_path"
    else
      # Keep the complete framework binary (load commands and all sections) in
      # the hash. Require the pinned framework binary to embed the canonical
      # Xcode path; otherwise a rebuilt framework fails closed.
      node "$SCRIPT_DIR/check_macho_paths.js" "$macho_path" || exit 1
    fi
  done < <(find "$app_path" -type f -print0)

  # Trim machine-related data from the assembly file
  fields_remove=(
    "BuildMachineOSBuild"
    "DTPlatformBuild"
    "DTPlatformVersion"
    "DTSDKBuild"
    "DTSDKName"
    "DTXcode"
    "DTXcodeBuild"
  )
  # 遍历并修改 Info.plist 中的字段
  for field in "${fields_remove[@]}"; do
    find "$app_path" -name Info.plist -exec $SCRIPT_DIR/modify_plist_value.sh {} "$field" null \;
  done

  echo "✅ 范式化处理完成"

  # 计算哈希
  echo "⏳ 计算 iOS 哈希..."
  local file_hashes_report="$export_dir/file_hashes_ios.txt"
  local overall_hash=$(find "$app_path" -type f ! -name ".DS_Store" -print0 | LC_ALL=C LC_COLLATE=C sort -z | xargs -0 -P 1 shasum -a 256 | tee "$file_hashes_report" | shasum -a 256 | awk '{print $1}')
  local bundle_hash=$(shasum -a 256 "$app_path/main.jsbundle" | awk '{print $1}')

  # 导出产物和报告
  if [ -f "$app_path/RabbyMobile.asm" ]; then
    rsync -a "$app_path/RabbyMobile.asm" "$export_dir/RabbyMobile.asm"
  fi
  if [ -f "$app_path/Assets.car.json" ]; then
    rsync -a "$app_path/Assets.car.json" "$export_dir/Assets.car.json"
  fi
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
