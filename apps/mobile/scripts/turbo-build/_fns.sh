#!/bin/sh

turbo_build_enabled() {
  [ "${RABBY_MOBILE_TURBO_BUILD:-false}" = "true" ]
}

turbo_default_local_cache_dir() {
  if [ -n "${RABBY_MOBILE_LOCAL_BUILD_CACHE_DIR:-}" ]; then
    printf '%s\n' "$RABBY_MOBILE_LOCAL_BUILD_CACHE_DIR"
    return 0
  fi

  if [ "$(uname -s)" = "Darwin" ]; then
    printf '%s\n' "$HOME/Library/Caches/rabby-mobile/build-cache"
  else
    printf '%s\n' "$HOME/.cache/rabby-mobile/build-cache"
  fi
}

turbo_default_global_gradle_home() {
  printf '%s\n' "${RABBY_MOBILE_GLOBAL_GRADLE_HOME:-$HOME/.gradle}"
}

turbo_first_set_env_value() {
  for env_name in "$@"; do
    eval "env_value=\${$env_name:-}"
    if [ -n "$env_value" ]; then
      printf '%s\n' "$env_value"
      return 0
    fi
  done
  return 1
}

turbo_proxy_scheme() {
  proxy_url="$1"
  if [ "${proxy_url#*://}" != "$proxy_url" ]; then
    printf '%s\n' "${proxy_url%%://*}"
  fi
}

turbo_proxy_authority() {
  proxy_url="$1"
  proxy_rest="${proxy_url#*://}"
  if [ "$proxy_rest" = "$proxy_url" ]; then
    proxy_rest="$proxy_url"
  fi
  proxy_rest="${proxy_rest%%/*}"
  printf '%s\n' "${proxy_rest##*@}"
}

turbo_proxy_host() {
  proxy_authority=$(turbo_proxy_authority "$1")
  case "$proxy_authority" in
    *:*) printf '%s\n' "${proxy_authority%%:*}" ;;
    *) printf '%s\n' "$proxy_authority" ;;
  esac
}

turbo_proxy_port() {
  proxy_url="$1"
  proxy_authority=$(turbo_proxy_authority "$proxy_url")
  case "$proxy_authority" in
    *:*) printf '%s\n' "${proxy_authority##*:}" ;;
    *)
      case "$(turbo_proxy_scheme "$proxy_url")" in
        https) printf '%s\n' "443" ;;
        *) printf '%s\n' "80" ;;
      esac
      ;;
  esac
}

turbo_java_non_proxy_hosts() {
  non_proxy_value="$1"
  old_ifs=$IFS
  IFS=','
  set -- $non_proxy_value
  IFS=$old_ifs

  non_proxy_hosts=""
  for host in "$@"; do
    host=$(printf '%s' "$host" | tr -d ' ')
    [ -z "$host" ] && continue
    case "$host" in
      .*) host="*$host" ;;
    esac
    if [ -n "$non_proxy_hosts" ]; then
      non_proxy_hosts="$non_proxy_hosts|$host"
    else
      non_proxy_hosts="$host"
    fi
  done

  printf '%s\n' "$non_proxy_hosts"
}

turbo_prepare_gradle_proxy_env() {
  http_proxy_url=$(turbo_first_set_env_value http_proxy HTTP_PROXY all_proxy ALL_PROXY || true)
  https_proxy_url=$(turbo_first_set_env_value https_proxy HTTPS_PROXY all_proxy ALL_PROXY || true)
  no_proxy_value=$(turbo_first_set_env_value no_proxy NO_PROXY || true)

  proxy_opts=""

  if [ -n "$http_proxy_url" ]; then
    proxy_opts="$proxy_opts -Dhttp.proxyHost=$(turbo_proxy_host "$http_proxy_url") -Dhttp.proxyPort=$(turbo_proxy_port "$http_proxy_url")"
  fi

  if [ -n "$https_proxy_url" ]; then
    proxy_opts="$proxy_opts -Dhttps.proxyHost=$(turbo_proxy_host "$https_proxy_url") -Dhttps.proxyPort=$(turbo_proxy_port "$https_proxy_url")"
  fi

  if [ -n "$no_proxy_value" ]; then
    non_proxy_hosts=$(turbo_java_non_proxy_hosts "$no_proxy_value")
    if [ -n "$non_proxy_hosts" ]; then
      proxy_opts="$proxy_opts -Dhttp.nonProxyHosts=$non_proxy_hosts -Dhttps.nonProxyHosts=$non_proxy_hosts"
    fi
  fi

  proxy_opts="${proxy_opts# }"
  if [ -z "$proxy_opts" ]; then
    return 0
  fi

  case " ${GRADLE_OPTS:-} " in
    *" -Dhttp.proxyHost="*|*" -Dhttps.proxyHost="*) ;;
    *)
      export GRADLE_OPTS="$proxy_opts${GRADLE_OPTS:+ $GRADLE_OPTS}"
      turbo_log "prepared GRADLE_OPTS proxy settings for Gradle wrapper"
      ;;
  esac

  case " ${JAVA_TOOL_OPTIONS:-} " in
    *" -Dhttp.proxyHost="*|*" -Dhttps.proxyHost="*) ;;
    *)
      export JAVA_TOOL_OPTIONS="$proxy_opts${JAVA_TOOL_OPTIONS:+ $JAVA_TOOL_OPTIONS}"
      turbo_log "prepared JAVA_TOOL_OPTIONS proxy settings for Gradle daemon"
      ;;
  esac
}

turbo_remote_cache_configured() {
  [ -n "${RABBY_MOBILE_BUILD_BUCKET:-}" ]
}

turbo_repo_root() {
  cd "$project_dir/../.." && pwd
}

turbo_init_env() {
  export RABBY_MOBILE_REPO_ROOT="${RABBY_MOBILE_REPO_ROOT:-$(turbo_repo_root)}"
  export RABBY_MOBILE_TURBO_WORK_ROOT="${RABBY_MOBILE_REPO_ROOT}/.turbo-build"
  export RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT="${project_dir}/.turbo-build"
  export RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT="${RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT:-$(turbo_default_local_cache_dir)}"

  if turbo_remote_cache_configured; then
    export RABBY_MOBILE_TURBO_REMOTE_CACHE_ROOT="s3://${RABBY_MOBILE_BUILD_BUCKET}/_private/rabby-mobile/build-cache"
  else
    unset RABBY_MOBILE_TURBO_REMOTE_CACHE_ROOT
  fi

  mkdir -p \
    "$RABBY_MOBILE_TURBO_WORK_ROOT" \
    "$RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT" \
    "$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT"

  export YARN_CACHE_FOLDER="${RABBY_MOBILE_TURBO_WORK_ROOT}/yarn"
  export RABBY_MOBILE_TURBO_BUNDLE_PATH="${RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT}/vendor/bundle"
  export RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG="${RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT}/bundle-config"
  export RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM="${RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM:-1}"
  export GRADLE_USER_HOME="${RABBY_MOBILE_TURBO_WORK_ROOT}/gradle-user-home"
  turbo_prepare_gradle_proxy_env
}

turbo_seed_gradle_wrapper_from_global() {
  turbo_init_env

  local_wrapper_root="$GRADLE_USER_HOME/wrapper"
  local_wrapper_dists="$local_wrapper_root/dists"
  global_gradle_home=$(turbo_default_global_gradle_home)
  global_wrapper_dists="$global_gradle_home/wrapper/dists"

  if [ -d "$local_wrapper_dists" ]; then
    return 0
  fi

  if [ ! -d "$global_wrapper_dists" ]; then
    return 0
  fi

  mkdir -p "$local_wrapper_root"
  cp -R "$global_wrapper_dists" "$local_wrapper_dists"
  turbo_log "seeded gradle wrapper dists from $global_wrapper_dists"
}

turbo_project_ruby_version() {
  if [ -f "$project_dir/.ruby-version" ]; then
    tr -d '\r\n' <"$project_dir/.ruby-version"
  fi
}

turbo_project_ruby_gemset() {
  if [ -f "$project_dir/.ruby-gemset" ]; then
    tr -d '\r\n' <"$project_dir/.ruby-gemset"
  fi
}

turbo_project_ruby_target() {
  ruby_version=$(turbo_project_ruby_version)
  ruby_gemset=$(turbo_project_ruby_gemset)

  if [ -z "$ruby_version" ]; then
    return 1
  fi

  if [ -n "$ruby_gemset" ]; then
    printf '%s@%s\n' "$ruby_version" "$ruby_gemset"
  else
    printf '%s\n' "$ruby_version"
  fi
}

turbo_bundle_with_project_ruby() {
  tb_ruby_target=$(turbo_project_ruby_target) || return 1
  tb_app_config="$RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG"
  tb_path="$RABBY_MOBILE_TURBO_BUNDLE_PATH"
  tb_force_ruby_platform="$RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM"

  bash -lc '
    set -e
    project_dir="$1"
    ruby_target="$2"
    bundle_app_config="$3"
    bundle_path="$4"
    bundle_force_ruby_platform="$5"
    shift 5

    cd "$project_dir"
    . "$HOME/.rvm/scripts/rvm"
    rvm use "$ruby_target" >/dev/null

    env \
      BUNDLE_APP_CONFIG="$bundle_app_config" \
      BUNDLE_PATH="$bundle_path" \
      BUNDLE_FORCE_RUBY_PLATFORM="$bundle_force_ruby_platform" \
      bundle "$@"
  ' bash "$project_dir" "$tb_ruby_target" "$tb_app_config" "$tb_path" "$tb_force_ruby_platform" "$@"
}

turbo_bundle_exec() {
  tb_app_config="$RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG"
  tb_path="$RABBY_MOBILE_TURBO_BUNDLE_PATH"
  tb_force_ruby_platform="$RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM"

  if [ -f "$project_dir/.ruby-version" ] && [ -s "$HOME/.rvm/scripts/rvm" ]; then
    turbo_bundle_with_project_ruby "$@"
    return $?
  fi

  env \
    BUNDLE_APP_CONFIG="$tb_app_config" \
    BUNDLE_PATH="$tb_path" \
    BUNDLE_FORCE_RUBY_PLATFORM="$tb_force_ruby_platform" \
    bundle "$@"
}

turbo_log() {
  printf '[turbo-build] %s\n' "$*"
}

turbo_aws_available() {
  command -v aws >/dev/null 2>&1
}

turbo_remote_sync_enabled() {
  if ! turbo_build_enabled; then
    return 1
  fi

  if ! turbo_remote_cache_configured; then
    return 1
  fi

  case "${RABBY_MOBILE_TURBO_REMOTE_SYNC:-}" in
    false|0|no|off)
      return 1
      ;;
    true|1|yes|on)
      return 0
      ;;
    *)
      return 0
      ;;
  esac
}

turbo_hash_git_files() {
  repo_root="$1"
  shift

  tmp_file=$(mktemp)
  git -C "$repo_root" ls-files "$@" | LC_ALL=C sort >"$tmp_file"

  {
    while IFS= read -r rel_path; do
      if [ -n "$rel_path" ] && [ -f "$repo_root/$rel_path" ]; then
        file_hash=$(shasum -a 256 "$repo_root/$rel_path" | awk '{print $1}')
        printf '%s:%s\n' "$rel_path" "$file_hash"
      fi
    done <"$tmp_file"
  } | shasum -a 256 | awk '{print $1}'

  rm -f "$tmp_file"
}

turbo_compute_js_deps_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      package.json \
      yarn.lock \
      .yarnrc.yml \
      .yarn/patches \
      apps/mobile/package.json
  )

  printf '%s\n' \
    "node=$(node -v 2>/dev/null)" \
    "yarn=$(yarn --version 2>/dev/null)" \
    "files=$files_hash" \
    | shasum -a 256 | awk '{print $1}'
}

turbo_compute_ruby_bundle_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      apps/mobile/Gemfile \
      apps/mobile/Gemfile.lock \
      apps/mobile/.bundle/config
  )

  ruby_version=$(turbo_bundle_exec exec ruby -v 2>/dev/null || ruby -v 2>/dev/null)
  bundler_version=$(turbo_bundle_exec --version 2>/dev/null || bundle --version 2>/dev/null)

  printf '%s\n' \
    "ruby=$ruby_version" \
    "bundler=$bundler_version" \
    "files=$files_hash" \
    | shasum -a 256 | awk '{print $1}'
}

turbo_compute_cocoapods_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      apps/mobile/ios/Podfile \
      apps/mobile/ios/Podfile.lock
  )

  printf '%s\n' \
    "xcode=$(xcodebuild -version 2>/dev/null | tr '\n' '|')" \
    "ruby=$(ruby -v 2>/dev/null)" \
    "cocoapods=$(turbo_bundle_exec exec pod --version 2>/dev/null || pod --version 2>/dev/null)" \
    "files=$files_hash" \
    | shasum -a 256 | awk '{print $1}'
}

turbo_compute_gradle_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      apps/mobile/android/build.gradle \
      apps/mobile/android/settings.gradle \
      apps/mobile/android/gradle.properties \
      apps/mobile/android/app/build.gradle \
      apps/mobile/android/gradle/wrapper/gradle-wrapper.properties \
      apps/mobile/package.json \
      yarn.lock
  )

  printf '%s\n' \
    "java=$(java -version 2>&1 | head -n 1)" \
    "files=$files_hash" \
    | shasum -a 256 | awk '{print $1}'
}

turbo_local_layer_dir() {
  layer="$1"
  key="$2"
  printf '%s/%s/%s\n' "$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT" "$layer" "$key"
}

turbo_remote_archive_path() {
  layer="$1"
  key="$2"
  printf '%s/%s/%s.tar\n' "$RABBY_MOBILE_TURBO_REMOTE_CACHE_ROOT" "$layer" "$key"
}

turbo_copy_paths() {
  src_root="$1"
  dest_root="$2"
  shift 2

  existing_paths=""
  for rel_path in "$@"; do
    if [ -e "$src_root/$rel_path" ]; then
      existing_paths="$existing_paths $rel_path"
    fi
  done

  if [ -z "$existing_paths" ]; then
    return 1
  fi

  mkdir -p "$dest_root"
  # shellcheck disable=SC2086
  tar -cf - -C "$src_root" $existing_paths | tar -xf - -C "$dest_root"
}

turbo_restore_layer() {
  layer="$1"
  key="$2"
  shift 2

  local_dir=$(turbo_local_layer_dir "$layer" "$key")
  remote_path=$(turbo_remote_archive_path "$layer" "$key")

  if [ -d "$local_dir" ]; then
    turbo_log "restored $layer cache from local mirror"
    for rel_path in "$@"; do
      rm -rf "$RABBY_MOBILE_REPO_ROOT/$rel_path"
    done
    turbo_copy_paths "$local_dir" "$RABBY_MOBILE_REPO_ROOT" "$@" || true
    return 0
  fi

  if ! turbo_remote_sync_enabled; then
    return 1
  fi

  if ! turbo_aws_available; then
    turbo_log "skip remote restore for $layer because aws cli is unavailable"
    return 1
  fi

  tmp_archive=$(mktemp "${TMPDIR:-/tmp}/rabby-turbo-restore.XXXXXX.tar")
  if ! aws s3 cp "$remote_path" "$tmp_archive" --only-show-errors >/dev/null 2>&1; then
    rm -f "$tmp_archive"
    return 1
  fi

  for rel_path in "$@"; do
    rm -rf "$RABBY_MOBILE_REPO_ROOT/$rel_path"
  done

  tar -xf "$tmp_archive" -C "$RABBY_MOBILE_REPO_ROOT"
  rm -f "$tmp_archive"

  rm -rf "$local_dir"
  turbo_copy_paths "$RABBY_MOBILE_REPO_ROOT" "$local_dir" "$@" || true
  turbo_log "restored $layer cache from $remote_path"
  return 0
}

turbo_save_layer() {
  layer="$1"
  key="$2"
  shift 2

  local_dir=$(turbo_local_layer_dir "$layer" "$key")
  remote_path=$(turbo_remote_archive_path "$layer" "$key")
  mkdir -p "$(dirname "$local_dir")"

  existing_paths=""
  for rel_path in "$@"; do
    if [ -e "$RABBY_MOBILE_REPO_ROOT/$rel_path" ]; then
      existing_paths="$existing_paths $rel_path"
    fi
  done

  if [ -z "$existing_paths" ]; then
    turbo_log "skip saving $layer because no cacheable paths exist"
    return 0
  fi

  rm -rf "$local_dir"
  turbo_copy_paths "$RABBY_MOBILE_REPO_ROOT" "$local_dir" "$@" || true
  turbo_log "saved $layer cache to local mirror"

  if ! turbo_remote_sync_enabled; then
    return 0
  fi

  if turbo_aws_available; then
    if ! aws s3 ls "$remote_path" >/dev/null 2>&1; then
      tmp_archive=$(mktemp "${TMPDIR:-/tmp}/rabby-turbo-save.XXXXXX.tar")
      # shellcheck disable=SC2086
      tar -cf "$tmp_archive" -C "$RABBY_MOBILE_REPO_ROOT" $existing_paths
      aws s3 cp "$tmp_archive" "$remote_path" --only-show-errors >/dev/null 2>&1 \
        && turbo_log "uploaded $layer cache to $remote_path"
      rm -f "$tmp_archive"
    fi
  fi
}

turbo_prepare_js_dependencies() {
  turbo_init_env
  cache_key=$(turbo_compute_js_deps_cache_key)

  if turbo_build_enabled; then
    turbo_restore_layer js-deps "$cache_key" \
      .turbo-build/yarn \
      .yarn/install-state.gz \
      .yarn/unplugged || true

    (
      cd "$RABBY_MOBILE_REPO_ROOT" &&
        yarn install --immutable --mode=skip-build
    )

    turbo_save_layer js-deps "$cache_key" \
      .turbo-build/yarn \
      .yarn/install-state.gz \
      .yarn/unplugged
  else
    (cd "$RABBY_MOBILE_REPO_ROOT" && yarn)
  fi
}

turbo_prepare_ruby_bundle() {
  turbo_init_env
  cache_key=$(turbo_compute_ruby_bundle_cache_key)

  if turbo_build_enabled; then
    turbo_restore_layer ruby-gems "$cache_key" \
      apps/mobile/.turbo-build/vendor/bundle \
      apps/mobile/.turbo-build/bundle-config || true
  fi

  if ! turbo_bundle_exec check >/dev/null 2>&1; then
    turbo_bundle_exec install --path "$RABBY_MOBILE_TURBO_BUNDLE_PATH"
  else
    turbo_log "ruby bundle already satisfied"
  fi

  if turbo_build_enabled; then
    turbo_save_layer ruby-gems "$cache_key" \
      apps/mobile/.turbo-build/vendor/bundle \
      apps/mobile/.turbo-build/bundle-config
  fi
}

turbo_prepare_cocoapods() {
  turbo_init_env
  cache_key=$(turbo_compute_cocoapods_cache_key)

  if turbo_build_enabled; then
    turbo_restore_layer cocoapods "$cache_key" apps/mobile/ios/Pods || true
    (cd "$project_dir/ios" && turbo_bundle_exec exec pod install)
    turbo_save_layer cocoapods "$cache_key" apps/mobile/ios/Pods
  else
    (cd "$project_dir/ios" && bundle exec pod install --repo-update)
  fi
}

turbo_restore_gradle_state() {
  turbo_init_env
  cache_key=$(turbo_compute_gradle_cache_key)

  if turbo_build_enabled; then
    turbo_restore_layer gradle-home "$cache_key" .turbo-build/gradle-user-home || true
    turbo_seed_gradle_wrapper_from_global
  fi
}

turbo_save_gradle_state() {
  turbo_init_env
  cache_key=$(turbo_compute_gradle_cache_key)

  if turbo_build_enabled; then
    turbo_save_layer gradle-home "$cache_key" .turbo-build/gradle-user-home
  fi
}
