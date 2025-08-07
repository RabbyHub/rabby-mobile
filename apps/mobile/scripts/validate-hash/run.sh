#!/bin/bash
# 主入口脚本：React Native 一致性构建校验
#
# 用法:
#   ./run.sh ios          # 只运行 iOS 校验
#   ./run.sh android      # 只运行 Android 校验
#   ./run.sh all          # (默认) 运行两个平台并计算组合哈希

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"

source "$SCRIPT_DIR/common.sh"
source "$SCRIPT_DIR/ios.sh"
source "$SCRIPT_DIR/android.sh"

PLATFORM=${1:-all}

# 运行通用设置
setup_workspace
setup_environment
install_common_dependencies

# 定义总的导出目录
TIMESTAMP=$(date '+%Y%m%d-%H%M%S')
EXPORT_BASE_DIR="$REPO_ROOT/apps/mobile/validation_exports_${TIMESTAMP}"
mkdir -p "$EXPORT_BASE_DIR"
echo "ℹ️ 构建产物将导出至: $EXPORT_BASE_DIR"

ios_hash=""
android_hash=""

# 根据参数执行平台特定构建
if [[ "$PLATFORM" == "all" || "$PLATFORM" == "ios" ]]; then
  IOS_EXPORT_DIR="$EXPORT_BASE_DIR/ios"
  mkdir -p "$IOS_EXPORT_DIR"
  ios_hash=$(run_ios_build_and_hash "$IOS_EXPORT_DIR" | tee "${TEE_TARGET}" | tail -n 1)
fi

if [[ "$PLATFORM" == "all" || "$PLATFORM" == "android" ]]; then
  ANDROID_EXPORT_DIR="$EXPORT_BASE_DIR/android"
  mkdir -p "$ANDROID_EXPORT_DIR"
  android_hash=$(run_android_build_and_hash "$ANDROID_EXPORT_DIR" | tee "${TEE_TARGET}" | tail -n 1)
fi

# 获取操作系统信息
OS_INFO=""
if [[ "$(uname)" == "Darwin" ]]; then
    OS_INFO="macOS $(sw_vers -productVersion)"
elif [[ "$(uname)" == "Linux" ]]; then
    OS_INFO=$(lsb_release -ds 2>/dev/null || cat /etc/*-release 2>/dev/null | head -n1 || uname -a)
fi

# 最终汇总
echo ""
echo "================================================="
echo "                校验结果汇总"
echo "================================================="
echo "操作系统: $OS_INFO"
echo "Git 提交版本: $GIT_HEAD_7"
echo "产物导出目录: $EXPORT_BASE_DIR"
echo "-------------------------------------------------"

if [ -n "$ios_hash" ]; then
  echo "🍏 iOS Hash: $ios_hash"
fi
if [ -n "$android_hash" ]; then
  echo "🤖 Android Hash: $android_hash"
fi

if [ -n "$ios_hash" ] && [ -n "$android_hash" ]; then
  COMBINED_HASH=$(printf "%s\n%s" "$ios_hash" "$android_hash" | sort | shasum -a 256 | awk '{print $1}')

  echo "🔗 总哈希: $COMBINED_HASH"

  echo "{\"combined_hash\": \"$COMBINED_HASH\", \"ios_hash\": \"$ios_hash\", \"android_hash\": \"$android_hash\"}" > "$EXPORT_BASE_DIR/final_summary.json"
fi

# open "$EXPORT_BASE_DIR"
