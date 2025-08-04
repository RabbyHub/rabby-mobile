#!/bin/bash

ORIGINAL_DIR=$(pwd)            # 保存原始目录并设置退出时自动恢复
trap 'cd "$ORIGINAL_DIR"' EXIT # 设置退出时必定执行切回原目录（无论成功/失败）

# --- 报告生成目录 ---
# 报告路径：优先使用第一个参数，否则设置为运行脚本所在目录的上级目录
_log_parent_dir="${1:-$(dirname "$(dirname "${BASH_SOURCE[0]}")")}"
log_parent_dir="$(cd "$_log_parent_dir" >/dev/null 2>&1 && pwd)" # 得到绝对路径
LOG_DIR="$log_parent_dir/build_$(date '+%Y%m%d-%H%M%S')"
BUILD_REPORT_FILE="${LOG_DIR}/build_hashes.txt"

mkdir -p "$LOG_DIR"
if [ $? -ne 0 ]; then
  echo "❌ Failed to create directory: ${LOG_DIR}"
  exit 1
fi

# --- clone 到 /tmp/$git_head_7 目录进行验证 ---
git_head_7=$(git rev-parse --short=7 HEAD)
repo_root=$(git rev-parse --show-toplevel)

WORK_DIR="/tmp/validate-rabby-mobile-$git_head_7"
APP_DIR="$WORK_DIR/apps/mobile"
script_dir="$APP_DIR/scripts"


if [ -d "$WORK_DIR" ]; then
  echo "ℹ️: Removing existing work directory $WORK_DIR ..."
  # rm -rf $WORK_DIR
else
  echo "Will clone repo to $WORK_DIR"
  git clone $repo_root $WORK_DIR && cd $WORK_DIR && git checkout $git_head_7
fi

cd $APP_DIR || {
  echo "❌: Cannot switch to $APP_DIR"
  exit 1
}

echo "ℹ️ Running validation script at git commit: $git_head_7"

# --- 环境安排 ---
yarn install --frozen-lockfile
bundle install

# --- 环境变量 set ---
export ZERO_AR_DATE=1
export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
export SENTRY_DISABLE_AUTO_UPLOAD=true # 不上传 sentry 报告了，没啥用
export APP_ENV=hashing

# --- 覆写 .env.local ---
# https://www.npmjs.com/package/react-native-dotenv#override-envname
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
  done < <(grep -vE '^[[:space:]]*#|^[[:space:]]*$' "$OVERRIDE_ENV_FILE") # 先过滤掉纯注释行和空行
  echo "✅ Environment variables from $OVERRIDE_ENV_FILE loaded and exported."
fi

#@description 计算 moduleId 有没有冲突
validate_module_ids() {
  node "$script_dir/validate-module-ids.js" "$LOG_DIR/jsModuleId.log"

  if [ $? -ne 0 ]; then
    echo "❌: Metro 解析 module 时的 createModuleIdFactory 存在 id 碰撞，此验证脚本不再可靠"
    exit 1
  fi
}

#@description 输出当前环境
echo_envs() {
  echo
  echo
  echo "MacOS Version: $(sw_vers -productVersion)($(sw_vers -buildVersion))"
  echo "Git Commit Hash: $(git rev-parse HEAD)"
}
