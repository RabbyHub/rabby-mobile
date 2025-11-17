# build-scripts/common.sh
#!/bin/bash
# 通用函数库，不直接执行，由主脚本引入

# 检查标准输出是否连接到一个终端
if [ -t 1 ]; then
  TEE_TARGET="/dev/tty"
else
  TEE_TARGET="/dev/stderr"
fi


# 此函数将在脚本退出时被调用
cleanup() {
  local original_exit_code=$?
  echo ""

  # 安全检查：确保 WORK_DIR 变量存在且符合预期格式，防止误删
  if [[ -n "$WORK_DIR" && "$WORK_DIR" == *"/validate-rabby-mobile-"* ]]; then
    echo "ℹ️ 删除临时工作目录: $WORK_DIR"
    rm -rf "$WORK_DIR"
  else
    echo "⚠️ 检测到 WORK_DIR 变量不安全或为空，跳过删除步骤"
  fi

  # 恢复到原始目录（这个是之前的 trap 内容）
  cd "$ORIGINAL_DIR"

  exit "$original_exit_code"
}

# 函数：设置并准备工作区 (克隆仓库到 /tmp 以保证环境纯净)
setup_workspace() {
  ORIGINAL_DIR=$(pwd)
  # trap cleanup EXIT 会在脚本退出时（无论成功失败）调用 cleanup 函数
  # 同时它也会捕获 SIGINT (Ctrl+C) 和 SIGTERM
  trap cleanup EXIT SIGINT SIGTERM

  # 1. 获取当前 Git 仓库的真实物理路径 (pwd -P 会解析所有符号链接)
  local current_repo_real_path=$(cd "$(git rev-parse --show-toplevel)" && pwd -P)

  # 2. 计算出目标临时工作目录的“预期”真实物理路径
  export GIT_HEAD_7=$(git rev-parse --short=7 HEAD)
  local expected_work_dir_path="$(cd /tmp && pwd -P)/validate-rabby-mobile-$GIT_HEAD_7"

  # 3. 对两个已解析的、无歧义的路径进行精确比较
  if [ "$current_repo_real_path" == "$expected_work_dir_path" ]; then
    echo "ℹ️ 检测到已在临时校验目录中，跳过克隆步骤"
    export WORK_DIR="$current_repo_real_path"
    export REPO_ROOT="$WORK_DIR"
  else
    export WORK_DIR="$expected_work_dir_path"
    export REPO_ROOT=$(git rev-parse --show-toplevel)

    if [ -d "$WORK_DIR" ]; then
      # 这段代码现在几乎不会被执行，因为 trap 会负责清理
      echo "ℹ️ 移除已存在的工作目录: $WORK_DIR..."
      rm -rf "$WORK_DIR"
    fi

    echo "ℹ️ 克隆仓库到: $WORK_DIR"
    git clone "$current_repo_real_path" "$WORK_DIR" >/dev/null 2>&1 && cd "$WORK_DIR" && git checkout -q "$GIT_HEAD_7"
  fi

  export PROJECT_DIR="$WORK_DIR/apps/mobile"
  export SCRIPT_DIR="$PROJECT_DIR/scripts/validate-hash"

  cd "$PROJECT_DIR" || {
    echo "❌ 无法切换到项目根目录"
    exit 1
  }

  echo "ℹ️ 在以下目录中运行校验: $(pwd)"
  echo "ℹ️ Git 提交版本: $GIT_HEAD_7"
  echo "-------------------------------------------------"
}

# 函数：设置通用环境变量并加载 .env 文件
setup_environment() {
  export ZERO_AR_DATE=1
  export SOURCE_DATE_EPOCH=$(git log -1 --format=%ct)
  export SENTRY_DISABLE_AUTO_UPLOAD=true
  export APP_ENV=hashing

  # --- 覆盖代码中用到的环境变量 ---
  export RABBY_MOBILE_CODE="RABBY_MOBILE_CODE_DEV"

  # write APP_ENV to .xcode.env.local
  echo "export APP_ENV=$APP_ENV" > ios/.xcode.env.local

  rm -f .env.hashing && cp .env .env.hashing;
  local apiKey="";
  if [ -z $RABBY_MOBILE_SAFE_API_KEY ] && [ ! -z $MOBILE_SAFE_API_KEY ]; then
    export RABBY_MOBILE_SAFE_API_KEY=$MOBILE_SAFE_API_KEY
  fi

  local env_file=".env.hashing"
  local sensitive_vars=(
    "RABBY_MOBILE_SAFE_API_KEY" "$RABBY_MOBILE_SAFE_API_KEY"
    "RABBY_MOBILE_KR_PWD" "$RABBY_MOBILE_KR_PWD"
    "RABBY_MOBILE_BUILD_CHANNEL" "appstore"
  )

  for ((i=0; i<${#sensitive_vars[@]}; i+=2)); do
    var_name="${sensitive_vars[i]}"
    var_value="${sensitive_vars[i+1]}"
    if [ -z "$var_value" ]; then
      echo "⚠️ warning: environment variable $var_name is not set, using placeholder instead"
      var_value="pesudo_for_hashing"
    else
      echo "ℹ️ detected value of $var_name"
    fi
    echo "$var_name=$var_value" >> .env.hashing

    sed -i '' -e "/^$var_name=/d" "$env_file"
    echo "$var_name=${var_value:-pesudo_for_hashing}" >> "$env_file"
  done

  # the exports below is useless for this variable on iOS, because xcode build phase use /bin/sh but all build env does not use it.
  if [ -f "$env_file" ]; then
    echo "ℹ️ Loading environment variables from $env_file..."
    while IFS='=' read -r key value || [ -n "$key" ]; do
      key_cleaned=$(echo "$key" | sed 's/#.*//' | awk '{$1=$1};1')
      if [ -z "$key_cleaned" ]; then continue; fi
      value_cleaned=$(echo "$value" | sed 's/#.*//' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
      value_to_export="${value_cleaned:-pesudo_for_hashing}"
      export "$key_cleaned=$value_to_export"
    done < <(grep -v '^[[:space:]]*#' "$env_file" | grep -v '^[[:space:]]*$')
    echo "✅ Loaded environment variables."
  else
    echo "⚠️ Environment variable file $env_file not found."
  fi
}

# 函数：安装通用依赖
install_common_dependencies() {
  echo "⏳ 安装通用依赖 (yarn & bundle)"
  rm -rf node_modules
  # 将输出重定向到 /dev/null，彻底丢弃
  yarn install --frozen-lockfile >/dev/null
  bundle install >/dev/null
  echo "✅ 通用依赖安装完毕"
}

# 函数：校验 Metro Module ID 是否冲突 (无参数，固定路径)
validate_metro_modules() {
  echo "ℹ️ 校验 Metro 模块 ID..."
  local log_file="$PROJECT_DIR/jsModuleId.log"
  node "$SCRIPT_DIR/validate-module-ids.js" "$log_file"
  if [ $? -ne 0 ]; then
    echo "❌ 检测到 Metro 模块 ID 冲突，校验结果不再可靠"
    exit 1
  fi
  echo "✅ Metro 模块 ID 校验通过"
}
