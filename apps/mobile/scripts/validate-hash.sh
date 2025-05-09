#!/bin/bash

EXPORT_DIR="${1:-$(pwd)}" # 优先使用第一个参数，否则设置为当前目录的 backups 子目录

# 保存原始目录并设置退出时自动恢复
ORIGINAL_DIR=$(pwd)
# 设置退出时必定执行切回原目录（无论成功/失败）
trap 'cd "$ORIGINAL_DIR"' EXIT

# 获取脚本所在绝对路径
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
PROJECT_PATH=$(dirname -- "${SCRIPT_DIR}")
cd "${SCRIPT_DIR}/.."

export ZERO_AR_DATE=1
export SOURCE_DATE_EPOCH=1600000000

# 不上传 sentry 报告了，没啥用
export SENTRY_DISABLE_AUTO_UPLOAD=true
# https://www.npmjs.com/package/react-native-dotenv#override-envname
# 覆写 .env
export APP_ENV=hashing

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
EXPORT_DIR="${EXPORT_DIR}/build_${TIMESTAMP}"
BUILD_REPORT_FILE="${EXPORT_DIR}/build_hashes.txt"

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

# macOS 的 APFS 文件系统在文件扫描时不保证顺序一致。尝试在 pod install 后，对 Pods/ 下文件执行一次排序构建
# find Pods -type f -print0 | sort -z | xargs -0 cat > /dev/null
cd ./ios && bundle exec pod install --deployment && cd ..

# cp ./ios/Pods/Pods.xcodeproj/project.pbxproj "$EXPORT_DIR/Pods.xcodeproj.project.pbxproj"

git checkout ./ios/RabbyMobile.xcodeproj/project.pbxproj

bundle exec fastlane ios hashcheck

# Assets.car 特殊处理，它里面有个 Timestamp，还没法指定，只能先解析成 json，再把 timestamp 移除，对比 json 的 hash
if [ -f "$APP_PATH/Assets.car" ]; then
  xcrun assetutil --info "$APP_PATH/Assets.car" >"$APP_PATH/Assets.car.json" || exit 1
  sed -i '' 's/"Timestamp" : [0-9]*/"Timestamp" : 0/' "$APP_PATH/Assets.car.json" && rm -f "$APP_PATH/Assets.car"
fi

# 去掉路径相关信息
strip -S "$APP_PATH/RabbyMobile" || exit 1

# 计算总哈希
OVERALL_HASH=$(find "$APP_PATH" -type f ! -name ".DS_Store" -print0 |
  sort -z |
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
  REQUIRED_FILES=("$APP_PATH/RabbyMobile" "$APP_PATH/main.jsbundle")
  for file in "${REQUIRED_FILES[@]}"; do
    if [ ! -f "$file" ]; then
      echo "❌ Critical error: Missing required file $file"
      exit 2
    fi
  done

  # 带时间戳的文件名
  BINARY_DEST="$EXPORT_DIR/RabbyMobile"
  BUNDLE_DEST="$EXPORT_DIR/main.jsbundle"

  # 带进度反馈的复制
  rsync -cv "$APP_PATH/RabbyMobile" "$BINARY_DEST"
  rsync -cv "$APP_PATH/main.jsbundle" "$BUNDLE_DEST"

  # 二次校验确保复制成功
  if [ ! -f "$BINARY_DEST" ] || [ ! -f "$BUNDLE_DEST" ]; then
    echo "❌ Export failed: File copy verification failed"
    exit 3
  fi

  otool -tV "$BINARY_DEST" > "$EXPORT_DIR/RabbyMobile.s"
  mv "$PROJECT_PATH/ios/LinkMap.txt" "$EXPORT_DIR/LinkMap.txt"
  cp "$PROJECT_PATH/ios/Package/RabbyMobile-RabbyMobileRegression.log" "$EXPORT_DIR/RabbyMobile-RabbyMobileRegression.log"
  # cp -r "$PROJECT_PATH/ios/DerivedData/Build/Intermediates.noindex" "$EXPORT_DIR/"

  echo "✅ Exported to:"
  echo "   - Binary: $BINARY_DEST"
  echo "   - Bundle: $BUNDLE_DEST"
fi

{
  cat <<EOF

{
  "platform": "ios",
  "build_time": "$(date '+%Y-%m-%d %H:%M:%S %Z')",
  "xcode_version": "$(xcodebuild -version | head -n1 | sed 's/Xcode //')",
  "cocoapods_version": "$(bundle exec pod --version)",
  "clang_version": "$(clang --version | head -n1)",
  "swift_version": "$(swift --version | head -n1)",
  "hash": "$OVERALL_HASH",
  "bundle_hash": "$BUNDLE_HASH"
}

EOF
} >>"$BUILD_REPORT_FILE"

echo "✅ App SHA256 Hash: $OVERALL_HASH"
