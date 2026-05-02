# build-scripts/ios.sh
#!/bin/bash
# iOS 专属构建和哈希逻辑

scan_ios_path_leaks() {
  local scan_dir="$1"
  local report_file="$2"
  shift 2

  : >"$report_file"

  while IFS= read -r -d '' file_path; do
    for needle in "$@"; do
      if [ -z "$needle" ]; then
        continue
      fi

      strings -a "$file_path" 2>/dev/null | grep -F "$needle" | while IFS= read -r leaked_line; do
        printf '%s\t%s\t%s\n' "$file_path" "$needle" "$leaked_line" >>"$report_file"
      done
    done
  done < <(find "$scan_dir" -type f ! -name ".DS_Store" -print0)
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
  local repo_root_alt="$2"
  local developer_dir="$3"

  HASHCHECK_REPO_ROOT="$REPO_ROOT" \
    HASHCHECK_REPO_ROOT_ALT="$repo_root_alt" \
    HASHCHECK_DEVELOPER_DIR="$developer_dir" \
    perl -0pi -e '
      my %path_map = (
        HASHCHECK_REPO_ROOT => "/__rabby_repo__",
        HASHCHECK_REPO_ROOT_ALT => "/__rabby_repo__",
        HASHCHECK_DEVELOPER_DIR => "/__rabby_xcode_developer__",
      );

      for my $key (sort { length($ENV{$b} // "") <=> length($ENV{$a} // "") } keys %path_map) {
        my $from = $ENV{$key};
        next unless defined $from && length $from;
        s/\Q$from\E/$path_map{$key}/g;
      }
    ' "$asm_file"
}

run_ios_build_and_hash() {
  echo ""
  echo "================================================="
  echo "            开始 iOS 构建与校验"
  echo "================================================="

  local export_dir="$1"
  local build_report_json="$export_dir/build_hashes_ios.json"
  local app_path="$PROJECT_DIR/ios/Package/RabbyMobile.xcarchive/Products/Applications/RabbyMobile.app"
  local ipa_path="$PROJECT_DIR/ios/Package/RabbyMobile.ipa"
  local developer_dir=$(xcode-select -p)
  local repo_root_alt=$(hashcheck_alt_tmp_path "$REPO_ROOT")

  local build_log_file="$export_dir/build.log"
  echo "ℹ️ iOS 构建日志将保存至: $build_log_file"

  # 清理, 安装 Pods, 构建
  echo "⏳ 清理环境、安装 Pods 并执行构建..."
  rm -rf ~/Library/Developer/Xcode/DerivedData/RabbyMobile-* "$PROJECT_DIR/ios/Package" "$PROJECT_DIR/ios/build" "$PROJECT_DIR/ios/DerivedData"

  echo "⏳ 构建 iOS worker bundle..."
  repo_yarn buildworker:prod:ios >>"$build_log_file" 2>&1
  if [ $? -ne 0 ]; then
    echo "❌ iOS worker bundle 构建失败，请检查日志: $build_log_file"
    exit 1
  fi

  cd "$PROJECT_DIR/ios" && bundle exec ruby -S pod deintegrate &>/dev/null && RCT_NEW_ARCH_ENABLED=0 bundle exec ruby -S pod install --deployment --repo-update --allow-root >>"$build_log_file" 2>&1
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

  local raw_file_hashes_report="$export_dir/file_hashes_ios_raw_app.txt"
  local raw_app_hash=$(find "$app_path" -type f ! -name ".DS_Store" -print0 | LC_ALL=C LC_COLLATE=C sort -z | xargs -0 -P 1 shasum -a 256 | tee "$raw_file_hashes_report" | shasum -a 256 | awk '{print $1}')
  local raw_ipa_hash_json="null"
  if [ -f "$ipa_path" ]; then
    local raw_ipa_hash=$(shasum -a 256 "$ipa_path" | awk '{print $1}')
    raw_ipa_hash_json="\"$raw_ipa_hash\""
  fi

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

  local previous_dir=$(pwd)
  cd "$app_path"
  otool -tV RabbyMobile >"$app_path/RabbyMobile.s"
  cd "$previous_dir"
  normalize_ios_asm_path_prefixes "$app_path/RabbyMobile.s" "$repo_root_alt" "$developer_dir"
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
  local overall_hash=$(find "$app_path" -type f ! -name ".DS_Store" -print0 | LC_ALL=C LC_COLLATE=C sort -z | xargs -0 -P 1 shasum -a 256 | tee "$file_hashes_report" | shasum -a 256 | awk '{print $1}')
  local bundle_hash=$(shasum -a 256 "$app_path/main.jsbundle" | awk '{print $1}')
  local path_leaks_report="$export_dir/path_leaks_ios.txt"
  local broad_path_leaks_report="$export_dir/path_leaks_ios_broad.txt"
  scan_ios_path_leaks "$app_path" "$path_leaks_report" "$REPO_ROOT" "$repo_root_alt" "$developer_dir"
  scan_ios_path_leaks "$app_path" "$broad_path_leaks_report" "/Applications/Xcode" "/Users/"
  local path_leak_count=$(wc -l <"$path_leaks_report" | tr -d '[:space:]')
  local broad_path_leak_count=$(wc -l <"$broad_path_leaks_report" | tr -d '[:space:]')

  # 导出产物和报告
  rsync -a "$app_path/RabbyMobile.asm" "$export_dir/RabbyMobile.asm"
  rsync -a "$app_path/Assets.car.json" "$export_dir/Assets.car.json"
  rsync -a "$app_path/main.jsbundle" "$export_dir/main.jsbundle_ios"
  mv "$PROJECT_DIR/ios/LinkMap.txt" "$export_dir/LinkMap.txt"

  local xcode_full_version
  local xcode_version
  local macos_product_version
  local macos_build_version
  local cocoapods_version
  local clang_version
  local node_version
  local yarn_version
  suspend_cleanup_trap
  xcode_full_version=$(xcodebuild -version || true) # 直接 head -n 1 还会报错
  xcode_version=$(echo "$xcode_full_version" | head -n 1)
  macos_product_version=$(sw_vers -productVersion || true)
  macos_build_version=$(sw_vers -buildVersion || true)
  cocoapods_version=$(bundle exec pod --version || true)
  clang_version=$(clang --version | head -n1 || true)
  node_version=$(node -v || true)
  yarn_version=$(yarn -v || true)
  restore_cleanup_trap
  {
    cat <<EOF
{
  "platform": "ios",
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
  "injected_git_time": "$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME",
  "hash": "$overall_hash",
  "bundle_hash": "$bundle_hash",
  "artifacts": {
    "js_bundle": {
      "hash": "$bundle_hash",
      "exported_as": "main.jsbundle_ios"
    },
    "raw_app": {
      "hash": "$raw_app_hash",
      "file_hashes": "file_hashes_ios_raw_app.txt"
    },
    "raw_ipa": {
      "hash": $raw_ipa_hash_json
    },
    "normalized_app": {
      "hash": "$overall_hash",
      "file_hashes": "file_hashes_ios.txt"
    }
  },
  "comparison": {
    "bundle_hash": "$bundle_hash",
    "final_artifact_kind": "normalized_app",
    "final_artifact_hash": "$overall_hash",
    "raw_app_hash": "$raw_app_hash",
    "raw_ipa_hash": $raw_ipa_hash_json
  },
  "path_prefix_map": {
    "repo_root": "$REPO_ROOT",
    "repo_root_alt": "$repo_root_alt",
    "canonical_repo_root": "/__rabby_repo__",
    "developer_dir": "$developer_dir",
    "canonical_developer_dir": "/__rabby_xcode_developer__",
    "normalized_asm_paths": true,
    "path_leak_report": "path_leaks_ios.txt",
    "path_leak_count": $path_leak_count,
    "broad_path_leak_report": "path_leaks_ios_broad.txt",
    "broad_path_leak_count": $broad_path_leak_count
  },
  "environment": {
    "macOS_version": "$macos_product_version ($macos_build_version)",
    "xcode_version": "$xcode_version",
    "cocoapods_version": "$cocoapods_version",
    "clang_version": "$clang_version",
    "node_version": "$node_version",
    "yarn_version": "$yarn_version"
  }
}
EOF
  } >"$build_report_json"

  echo "$overall_hash"
}
