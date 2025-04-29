#!/bin/bash

# 不上传 sentry 报告了，没啥用
export SENTRY_DISABLE_AUTO_UPLOAD=true

TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
BUILD_REPORT_FILE="build_info_${TIMESTAMP}.txt"

APP_PATH="./ios/Package/RabbyMobile.xcarchive/Products/Applications/RabbyMobile.app"

rm -rf "./ios/Package"
rm -rf "./ios/DerivedData"

cd ./ios && bundle exec pod install --deployment && cd ..

git checkout ./ios/RabbyMobile.xcodeproj/project.pbxproj

bundle exec fastlane ios hashcheck

# Assets.car 特殊处理，它里面有个 Timestamp，还没法指定，只能先解析成 json，再把 timestamp 移除，对比 json 的 hash
if [ -f "$APP_PATH/Assets.car" ]; then
    xcrun assetutil --info "$APP_PATH/Assets.car" >"$APP_PATH/Assets.car.json" || exit 1
    sed -i '' 's/"Timestamp" : [0-9]*/"Timestamp" : 0/' "$APP_PATH/Assets.car.json" && rm -f "$APP_PATH/Assets.car"
fi

# 计算总哈希
OVERALL_HASH=$(find "$APP_PATH" -type f ! -name ".DS_Store" -print0 | \
  sort -z | \
  xargs -0 shasum -a 256 | \
  tee -a "$BUILD_REPORT_FILE" | \
  shasum -a 256 | \
  awk '{print $1}')

# 计算 main.jsbundle 哈希
BUNDLE_HASH=$(shasum -a 256 "$APP_PATH/main.jsbundle" | awk '{print $1}')

{
  cat << EOF

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
} >> "$BUILD_REPORT_FILE"

echo "✅ App SHA256 Hash: $OVERALL_HASH"
