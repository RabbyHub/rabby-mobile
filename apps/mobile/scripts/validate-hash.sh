#!/bin/bash

# 保存原始目录并设置退出时自动恢复
ORIGINAL_DIR=$(pwd)
git_head=$(git rev-parse HEAD)
git_head_7=$(git rev-parse --short=7 HEAD)
repo_root=$(git rev-parse --show-toplevel)

WORK_DIR="/tmp/validate-rabby-mobile-$git_head_7"

if [ "$repo_root" == "$WORK_DIR" ]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
else
  if [ -d "$WORK_DIR" ]; then
    echo "ℹ️: Removing existing work directory $WORK_DIR ..."
    rm -rf $WORK_DIR;
  fi
  echo "Will clone repo to $WORK_DIR"
  git clone $repo_root $WORK_DIR && cd $WORK_DIR && git checkout $git_head_7;
  SCRIPT_DIR="$WORK_DIR/apps/mobile/scripts"
fi

cd $WORK_DIR/apps/mobile || {
  echo "❌: Cannot switch to $WORK_DIR/apps/mobile"
  exit 1
}

echo "ℹ️ Running validation script at git commit: $git_head_7"

EXPORT_DIR="${1:-$(pwd)}" # 优先使用第一个参数，否则设置为当前目录的 backups 子目录

# 设置退出时必定执行切回原目录（无论成功/失败）
trap 'cd "$ORIGINAL_DIR"' EXIT

PROJECT_PATH=$(dirname -- "${SCRIPT_DIR}")
cd "${SCRIPT_DIR}/.."

export ZERO_AR_DATE=1
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)

# 不上传 sentry 报告了，没啥用
export SENTRY_DISABLE_AUTO_UPLOAD=true
# https://www.npmjs.com/package/react-native-dotenv#override-envname
export APP_ENV=hashing

# 覆写 .env.local
OVERRIDE_ENV_FILE=".env"

if [ -f "$OVERRIDE_ENV_FILE" ]; then
  echo "ℹ️ Loading environment variables from $OVERRIDE_ENV_FILE..."
  # 使用 set -a 来自动导出之后设置的变量
  # 读取文件，忽略注释和空行，然后导出
  # 注意：这种方法对于包含特殊字符（如空格、#）的值处理可能需要更复杂的解析
  # 一个更健壮的方法是逐行读取和解析
  while IFS='=' read -r key value || [ -n "$key" ]; do
    # 移除可能的注释 (从第一个'#'开始)
    key_cleaned=$(echo "$key" | sed 's/#.*//' | awk '{$1=$1};1')                                       # awk '{$1=$1};1' 用于去除首尾空格
    value_cleaned=$(echo "$value" | sed 's/#.*//' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//') # 去除首尾空格

    # 移除可能存在于值两边的引号 (单引号或双引号)
    value_cleaned=$(echo "$value_cleaned" | sed -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')

    value_to_export="${value_cleaned:-pesudo_for_hashing}"

    if [ -n "$key_cleaned" ]; then # 确保 key 不是空的 (例如，空行或纯注释行)
      export "$key_cleaned=$value_to_export"
    fi
  done < <(grep -v '^[[:space:]]*#' "$OVERRIDE_ENV_FILE" | grep -v '^[[:space:]]*$') # 先过滤掉纯注释行和空行
  echo "✅ Environment variables from $OVERRIDE_ENV_FILE loaded and exported."
else
  echo "⚠️ Override file $OVERRIDE_ENV_FILE not found. No overrides applied."
fi

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
EXPORT_DIRNAME="build_${TIMESTAMP}"
EXPORT_DIR="${EXPORT_DIR}/${EXPORT_DIRNAME}"
BUILD_REPORT_FILE="${EXPORT_DIR}/build_hashes.txt"
PACKED_ZIP="$WORK_DIR/apps/mobile/$EXPORT_DIRNAME.zip"

APP_PATH="./ios/Package/RabbyMobile.xcarchive/Products/Applications/RabbyMobile.app"

if [ -n "$EXPORT_DIR" ]; then
  EXPORT_DIR=$(
    mkdir -p "$EXPORT_DIR"
    cd "$EXPORT_DIR" && pwd
  )
  echo "ℹ️  Export directory set to: $EXPORT_DIR"
fi

rm -rf ~/Library/Developer/Xcode/DerivedData/RabbyMobile-*
rm -rf "./ios/Package"
rm -rf "./ios/build"
rm -rf "./ios/DerivedData"
rm -rf node_modules

# 使用 yarn 安装依赖, 这里使用 --frozen-lockfile 来确保安装的依赖与 lockfile 一致
yarn install --frozen-lockfile

bundle install

cd ./ios && bundle exec pod deintegrate && RCT_NEW_ARCH_ENABLED=0 bundle exec pod install --deployment --repo-update --allow-root

if [ $? -ne 0 ]; then
  echo "❌: 安装 pods 依赖失败"
  exit 1
fi

cd ..

# cp ./ios/Pods/Pods.xcodeproj/project.pbxproj "$EXPORT_DIR/Pods.xcodeproj.project.pbxproj"

git checkout ./ios/RabbyMobile.xcodeproj/project.pbxproj

bundle exec fastlane ios hashcheck

node ./scripts/validate-module-ids.js "$PROJECT_PATH/jsModuleId.log"

if [ $? -ne 0 ]; then
  echo "❌: Metro 解析 module 时的 createModuleIdFactory 存在 id 碰撞，此验证脚本不再可靠"
  exit 1
fi

# Assets.car 特殊处理，它里面有个 Timestamp，还没法指定，只能先解析成 json，再把 timestamp 移除，对比 json 的 hash
if [ -f "$APP_PATH/Assets.car" ]; then
  xcrun assetutil --info "$APP_PATH/Assets.car" >"$APP_PATH/Assets.car.json" || exit 1
  # Timestamp, DumpToolVersion
  sed -i '' 's/"Timestamp" : [0-9]*/"Timestamp" : 0/' "$APP_PATH/Assets.car.json";
  sed -i '' 's/"DumpToolVersion" : [0-9]*\.[0-9]*/"DumpToolVersion" : 0/' "$APP_PATH/Assets.car.json";
  sed -i '' 's/"DumpToolVersion" : [0-9]*/"DumpToolVersion" : 0/' "$APP_PATH/Assets.car.json";

  rm -f "$APP_PATH/Assets.car"
fi

# 处理源码，先将其代码段剥离
otool -tV "$APP_PATH/RabbyMobile" >"$APP_PATH/RabbyMobile.s"
node ./scripts/normalize_objc_msgsend_ldr.js "$APP_PATH/RabbyMobile.s" "$PROJECT_PATH/ios/LinkMap.txt" >"$APP_PATH/RabbyMobile.asm"

rm -f "$APP_PATH/RabbyMobile"
rm -f "$APP_PATH/RabbyMobile.s"

# Trim machine-related data from the assembly file
chmod +x $SCRIPT_DIR/modify_plist_value.sh
fields_remove=(
  "BuildMachineOSBuild"
  # "DTPlatformBuild" "DTPlatformVersion" "DTSDKBuild" "DTSDKName" "DTXcode" "DTXcodeBuild"
)
# 遍历并修改 Info.plist 中的字段
for field in "${fields_remove[@]}"; do
  find "$APP_PATH" -name Info.plist -exec $SCRIPT_DIR/modify_plist_value.sh {} "$field" null \;
done

# 计算总哈希
OVERALL_HASH=$(find "$APP_PATH" -type f ! -name ".DS_Store" -print0 |
  LC_COLLATE=C sort -z |
  xargs -0 shasum -a 256 |
  tee -a "$BUILD_REPORT_FILE" |
  shasum -a 256 |
  awk '{print $1}')

# 计算 main.jsbundle 哈希
BUNDLE_HASH=$(shasum -a 256 "$APP_PATH/main.jsbundle" | awk '{print $1}')

# 新增导出逻辑 ======
if [ -n "$EXPORT_DIR" ]; then
  echo "⏳ Exporting build artifacts..."

  # 硬编码校验防止二进制缺失
  REQUIRED_FILES=("$APP_PATH/RabbyMobile.asm" "$APP_PATH/main.jsbundle")
  for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
      echo "❌ Critical error: Missing required file $file"
      exit 2
    fi
  done

  # 带时间戳的文件名
  BINARY_DEST="$EXPORT_DIR/RabbyMobile.asm"
  BUNDLE_DEST="$EXPORT_DIR/main.jsbundle"

  # 带进度反馈的复制
  rsync -cv "$APP_PATH/RabbyMobile.asm" "$BINARY_DEST"
  rsync -cv "$APP_PATH/main.jsbundle" "$BUNDLE_DEST"

  # 二次校验确保复制成功
  if [ ! -f "$BINARY_DEST" ] || [ ! -f "$BUNDLE_DEST" ]; then
    echo "❌ Export failed: File copy verification failed"
    exit 3
  fi

  # otool -tV "$BINARY_DEST" >"$EXPORT_DIR/RabbyMobile.s"
  mv "$PROJECT_PATH/ios/LinkMap.txt" "$EXPORT_DIR/LinkMap.txt"
  cp "$PROJECT_PATH/ios/Package/RabbyMobile-RabbyMobile.log" "$EXPORT_DIR/RabbyMobile-RabbyMobile.log"
  cp "$PROJECT_PATH/ios/Package/RabbyMobile.xcarchive/Products/Applications/RabbyMobile.app/modules.json" "$EXPORT_DIR/modules.json"
  # cp -r "$PROJECT_PATH/ios/DerivedData/Build/Intermediates.noindex" "$EXPORT_DIR/"
  mv "$PROJECT_PATH/jsModuleId.log" "$EXPORT_DIR/jsModuleId.log"
  # mv "$PROJECT_PATH/ios/DerivedData/Build/Intermediates.noindex/ArchiveIntermediates/RabbyMobile/IntermediateBuildFilesPath/RabbyMobile.build/Release-iphoneos/RabbyMobile.build/Objects-normal/arm64/RabbyMobile.LinkFileList" "$EXPORT_DIR/RabbyMobile.LinkFileList"

  echo "✅ Exported to:"
  echo "   - Binary: $BINARY_DEST"
  echo "   - Bundle: $BUNDLE_DEST"
fi

xcode_version=$(xcodebuild -version | head -n1 | sed 's/Xcode //');

{
  cat <<EOF

{
  "platform": "ios",
  "build_time": "$(date '+%Y-%m-%d %H:%M:%S %Z')",
  "xcode_version": "$xcode_version",
  "cocoapods_version": "$(bundle exec pod --version)",
  "clang_version": "$(clang --version | head -n1)",
  "swift_version": "$(swift --version | head -n1)",
  "hash": "$OVERALL_HASH",
  "bundle_hash": "$BUNDLE_HASH",
  "ruby_version": "$(ruby -v | head -n1)",
  "node_version": "$(node -v | head -n1)",
  "npm_version": "$(npm -v | head -n1)",
  "yarn_version": "$(yarn -v | head -n1)",
}

EOF
} >>"$BUILD_REPORT_FILE"

echo
echo
echo "MacOS Version: $(sw_vers -productVersion)($(sw_vers -buildVersion))"
echo "Xcode Version: $xcode_version"
echo "Git Commit Hash: $git_head"
echo "App SHA256 Hash: $OVERALL_HASH"

# zip $EXPORT_DIR, and put it under $WORK_DIR/apps/mobile;
zip -r -q "$PACKED_ZIP" "$EXPORT_DIR" && echo "✅ Exported zip to $PACKED_ZIP"
open $WORK_DIR/apps/mobile;
