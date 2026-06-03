# build-scripts/common.sh
#!/bin/bash
# 通用函数库，不直接执行，由主脚本引入

# 检查标准输出是否连接到一个终端
if [ -t 1 ]; then
  TEE_TARGET="/dev/tty"
else
  TEE_TARGET="/dev/stderr"
fi

repo_yarn() {
  yarn "$@"
}

activate_project_ruby() {
  if [ ! -f "$PROJECT_DIR/.ruby-version" ] || [ ! -s "$HOME/.rvm/scripts/rvm" ]; then
    return 0
  fi

  # Hashcheck can be launched from the repo root, where RVM's interactive
  # directory hook has not switched to apps/mobile/.ruby-version yet.
  # shellcheck source=/dev/null
  source "$HOME/.rvm/scripts/rvm"
  restore_cleanup_trap
  rvm use "$(cat "$PROJECT_DIR/.ruby-version")" >/dev/null
}

run_command_with_log() {
  local label="$1"
  local log_file="$2"
  shift 2

  mkdir -p "$(dirname "$log_file")"
  : >"$log_file"

  set +e
  "$@" >"$log_file" 2>&1
  local command_status=$?
  set -e

  if [ "$command_status" -ne 0 ]; then
    echo "❌ ${label} 失败，请检查日志: $log_file"
    echo "----- ${label} 日志尾部 -----"
    tail -n 200 "$log_file" || true
    echo "----- 结束 -----"
    return "$command_status"
  fi

  return 0
}

hash_directory_contents() {
  local content_dir="$1"
  local report_file="$2"

  (
    cd "$content_dir"
    find . -type f ! -name ".DS_Store" -print0 |
      LC_ALL=C LC_COLLATE=C sort -z |
      while IFS= read -r -d '' rel_path; do
        local file_hash
        file_hash="$(shasum -a 256 "$rel_path" | awk '{print $1}')"
        printf '%s  %s\n' "$file_hash" "${rel_path#./}"
      done
  ) | tee "$report_file" | shasum -a 256 | awk '{print $1}'
}

is_hashcheck_work_dir() {
  local work_dir="${1:-}"
  [[ -n "$work_dir" && "$work_dir" == *"/validate-rabby-mobile-"* ]]
}

is_registered_worktree() {
  local source_repo="${1:-}"
  local work_dir="${2:-}"

  if [[ -z "$source_repo" || -z "$work_dir" ]]; then
    return 1
  fi

  git -C "$source_repo" worktree list --porcelain 2>/dev/null | grep -Fxq "worktree $work_dir"
}

remove_hashcheck_work_dir() {
  local work_dir="${1:-}"
  local source_repo="${2:-}"

  if ! is_hashcheck_work_dir "$work_dir"; then
    echo "⚠️ 检测到 WORK_DIR 变量不安全或为空，跳过删除步骤"
    return 0
  fi

  if [[ -n "$source_repo" ]] && is_registered_worktree "$source_repo" "$work_dir"; then
    echo "ℹ️ 删除临时 worktree: $work_dir"
    git -C "$source_repo" worktree remove --force "$work_dir" >/dev/null 2>&1 || rm -rf "$work_dir"
    git -C "$source_repo" worktree prune >/dev/null 2>&1 || true
    return 0
  fi

  echo "ℹ️ 删除临时工作目录: $work_dir"
  rm -rf "$work_dir"
}


# 此函数将在脚本退出时被调用
cleanup() {
  local original_exit_code=$?
  local restore_dir=""

  echo ""

  if [ -n "${ORIGINAL_DIR:-}" ] && [ -d "$ORIGINAL_DIR" ]; then
    restore_dir="$ORIGINAL_DIR"
  elif [ -d /tmp ]; then
    restore_dir="$(cd /tmp && pwd -P)"
  else
    restore_dir="/"
  fi

  # Move out of the temp worktree before deleting it. This matters when the
  # script is launched from a pre-created /tmp validation checkout.
  if [ -n "$restore_dir" ]; then
    cd "$restore_dir" 2>/dev/null || true
  fi

  if [[ "${HASHCHECK_KEEP_WORK_DIR:-}" == "true" ]]; then
    echo "ℹ️ HASHCHECK_KEEP_WORK_DIR=true，保留工作目录: ${WORK_DIR:-}"
  elif [[ "${HASHCHECK_WORKTREE_CREATED:-}" == "true" || "${HASHCHECK_WORKSPACE_MODE_EFFECTIVE:-}" == "worktree" || "${HASHCHECK_WORKSPACE_MODE_EFFECTIVE:-}" == "clone" ]]; then
    remove_hashcheck_work_dir "${WORK_DIR:-}" "${HASHCHECK_SOURCE_REPO:-}"
  else
    echo "ℹ️ 未创建临时工作目录，跳过清理: ${WORK_DIR:-}"
  fi

  exit "$original_exit_code"
}

suspend_cleanup_trap() {
  trap - EXIT SIGINT SIGTERM
}

restore_cleanup_trap() {
  trap cleanup EXIT SIGINT SIGTERM
}

# 函数：设置并准备工作区 (默认使用固定路径 worktree 以保证路径稳定)
setup_workspace() {
  ORIGINAL_DIR=$(pwd)
  # trap cleanup EXIT 会在脚本退出时（无论成功失败）调用 cleanup 函数
  # 同时它也会捕获 SIGINT (Ctrl+C) 和 SIGTERM
  restore_cleanup_trap

  # 1. 获取当前 Git 仓库的真实物理路径 (pwd -P 会解析所有符号链接)
  local current_repo_real_path=$(cd "$(git rev-parse --show-toplevel)" && pwd -P)
  local workspace_mode="${HASHCHECK_WORKSPACE_MODE:-worktree}"
  export HASHCHECK_SOURCE_REPO="$current_repo_real_path"
  export HASHCHECK_EXPORT_REPO_ROOT="${HASHCHECK_EXPORT_REPO_ROOT:-$current_repo_real_path}"

  # 2. 计算出目标临时工作目录的“预期”真实物理路径
  export GIT_HEAD_7=$(git rev-parse --short=7 HEAD)
  export GIT_HEAD_FULL=$(git rev-parse HEAD)
  local expected_work_dir_path="$(cd /tmp && pwd -P)/validate-rabby-mobile-$GIT_HEAD_7"

  # 3. 对两个已解析的、无歧义的路径进行精确比较
  if [[ "$workspace_mode" == "current" || "${HASHCHECK_USE_CURRENT_WORKSPACE:-}" == "true" ]]; then
    echo "ℹ️ HASHCHECK_WORKSPACE_MODE=current，直接使用当前 Git 工作区"
    export WORK_DIR="$current_repo_real_path"
    export REPO_ROOT="$WORK_DIR"
    export HASHCHECK_USING_CURRENT_WORKSPACE=true
    export HASHCHECK_WORKTREE_CREATED=false
    export HASHCHECK_WORKSPACE_MODE_EFFECTIVE=current
  elif [ "$current_repo_real_path" == "$expected_work_dir_path" ]; then
    echo "ℹ️ 检测到已在固定校验目录中，跳过工作区准备步骤"
    export WORK_DIR="$current_repo_real_path"
    export REPO_ROOT="$WORK_DIR"
    export HASHCHECK_USING_CURRENT_WORKSPACE=false
    export HASHCHECK_WORKTREE_CREATED=false
    export HASHCHECK_WORKSPACE_MODE_EFFECTIVE=precreated
  else
    export WORK_DIR="$expected_work_dir_path"
    export REPO_ROOT="$WORK_DIR"
    export HASHCHECK_USING_CURRENT_WORKSPACE=false
    export HASHCHECK_WORKTREE_CREATED=false
    export HASHCHECK_WORKSPACE_MODE_EFFECTIVE="$workspace_mode"

    if [ -d "$WORK_DIR" ]; then
      echo "ℹ️ 移除已存在的工作目录: $WORK_DIR..."
      remove_hashcheck_work_dir "$WORK_DIR" "$HASHCHECK_SOURCE_REPO"
    fi

    if [[ "$workspace_mode" == "clone" ]]; then
      echo "ℹ️ 克隆仓库到: $WORK_DIR"
      git clone "$HASHCHECK_SOURCE_REPO" "$WORK_DIR" >/dev/null 2>&1 && cd "$WORK_DIR" && git checkout -q "$GIT_HEAD_FULL"
    else
      echo "ℹ️ 创建固定路径 worktree: $WORK_DIR"
      git -C "$HASHCHECK_SOURCE_REPO" worktree prune >/dev/null 2>&1 || true
      git -C "$HASHCHECK_SOURCE_REPO" worktree add --detach "$WORK_DIR" "$GIT_HEAD_FULL" >/dev/null 2>&1
      export HASHCHECK_WORKTREE_CREATED=true
    fi
  fi

  export PROJECT_DIR="$WORK_DIR/apps/mobile"
  export SCRIPT_DIR="$PROJECT_DIR/scripts/validate-hash"

  cd "$PROJECT_DIR" || {
    echo "❌ 无法切换到项目根目录"
    exit 1
  }
  activate_project_ruby
  # RVM hooks can reset EXIT traps while switching Ruby versions, so install
  # the cleanup trap again after activation.
  restore_cleanup_trap

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
  # Some generic shell variables are consumed by transitive JS dependencies
  # during Metro/Babel transforms. Keep them out of hashcheck bundles.
  unset DEBUG
  export RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_HASH="$(git rev-parse HEAD)"
  export RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_TIME="$(TZ=UTC0 git show --quiet --date='format-local:%Y-%m-%dT%H:%M:%S+00:00' --format='%cd' HEAD)"

  if [ -n "${RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH:-}" ]; then
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH_SOURCE="RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH"
  elif [ -n "${RABBY_MOBILE_HASHCHECK_GIT_HASH:-}" ]; then
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH="$RABBY_MOBILE_HASHCHECK_GIT_HASH"
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH_SOURCE="RABBY_MOBILE_HASHCHECK_GIT_HASH"
  else
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH="$RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_HASH"
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH_SOURCE="actual_git"
  fi

  if [ -n "${RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME:-}" ]; then
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME_SOURCE="RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME"
  elif [ -n "${RABBY_MOBILE_HASHCHECK_GIT_TIME:-}" ]; then
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME="$RABBY_MOBILE_HASHCHECK_GIT_TIME"
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME_SOURCE="RABBY_MOBILE_HASHCHECK_GIT_TIME"
  else
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME="$RABBY_MOBILE_HASHCHECK_ACTUAL_GIT_TIME"
    export RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME_SOURCE="actual_git"
  fi

  export RABBY_MOBILE_HASHCHECK_GIT_HASH="$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_HASH"
  export RABBY_MOBILE_HASHCHECK_GIT_TIME="$RABBY_MOBILE_HASHCHECK_INJECTED_GIT_TIME"

  # --- 覆盖代码中用到的环境变量 ---
  export RABBY_MOBILE_CODE="RABBY_MOBILE_CODE_DEV"

  # write APP_ENV to .xcode.env.local
  echo "export APP_ENV=$APP_ENV" > ios/.xcode.env.local
  echo "unset DEBUG" >> ios/.xcode.env.local
  echo "export RABBY_MOBILE_FE_SERVICE_URL=\"\"" >> ios/.xcode.env.local

  rm -f .env.hashing && cp .env .env.hashing;

  local env_file=".env.hashing"
  local sensitive_vars=(
    "RABBY_MOBILE_KR_PWD" "$RABBY_MOBILE_KR_PWD"
    "RABBY_MOBILE_CODE" "$RABBY_MOBILE_CODE"
    "RABBY_MOBILE_BUILD_CHANNEL" "appstore"
    "RABBY_MOBILE_FE_SERVICE_URL" ""
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
  if [[ "${HASHCHECK_USING_CURRENT_WORKSPACE:-}" == "true" && "${HASHCHECK_CLEAN_NODE_MODULES:-}" != "true" ]]; then
    echo "ℹ️ 当前工作区模式下保留 node_modules；如需强制清理可设置 HASHCHECK_CLEAN_NODE_MODULES=true"
  else
    rm -rf node_modules
  fi
  local install_log_dir="$PROJECT_DIR/.hash-validate-logs"
  local bundle_check_log="$install_log_dir/bundle-check.log"
  local bundle_install_log="$install_log_dir/bundle-install.log"
  local shared_bundle_path="${HASHCHECK_BUNDLE_PATH:-}"

  if [[ -z "$shared_bundle_path" && "${HASHCHECK_USING_CURRENT_WORKSPACE:-}" != "true" && -d "$HASHCHECK_SOURCE_REPO/apps/mobile/vendor/bundle" ]]; then
    shared_bundle_path="$HASHCHECK_SOURCE_REPO/apps/mobile/vendor/bundle"
  fi
  if [[ -n "$shared_bundle_path" ]]; then
    export BUNDLE_PATH="$shared_bundle_path"
    echo "ℹ️ 使用 Bundler 缓存目录: $BUNDLE_PATH"
    bundle config set --local path "$BUNDLE_PATH" >/dev/null
  fi

  run_command_with_log "yarn install" "$install_log_dir/yarn-install.log" \
    repo_yarn install --immutable
  mkdir -p "$install_log_dir"
  if bundle check >"$bundle_check_log" 2>&1; then
    echo "✅ Bundler 依赖已满足"
  else
    run_command_with_log "bundle install" "$bundle_install_log" \
      bundle install
  fi

  rm -rf "$install_log_dir"
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
