#!/bin/sh

. $project_dir/scripts/build-cache/_fns.sh --source-only

turbo_build_enabled() {
  [ "${RABBY_MOBILE_TURBO_BUILD:-false}" = "true" ]
}

turbo_stable_env_enabled() {
  if turbo_build_enabled; then
    return 0
  fi

  case "${RABBY_MOBILE_TURBO_STABLE_ENV:-true}" in
    false|0|no|off)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

turbo_default_local_cache_dir() {
  if [ -n "${RABBY_MOBILE_TURBO_LOCAL_CACHE_DIR:-}" ]; then
    printf '%s\n' "$RABBY_MOBILE_TURBO_LOCAL_CACHE_DIR"
    return 0
  fi

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

turbo_should_prepare_gradle_env() {
  case "${BUILD_TARGET_PLATFORM:-}" in
    android)
      return 0
      ;;
  esac

  case "${RABBY_MOBILE_TURBO_ENABLE_GRADLE_ENV:-false}" in
    true|1|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

turbo_cache_mode() {
  case "${RABBY_MOBILE_TURBO_CACHE_MODE:-local-first}" in
    remote-first|l2-first|remote|l2)
      printf '%s\n' "remote-first"
      ;;
    *)
      printf '%s\n' "local-first"
      ;;
  esac
}

turbo_platform_fingerprint() {
  printf '%s/%s\n' "$(uname -s 2>/dev/null)" "$(uname -m 2>/dev/null)"
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

turbo_should_write_gradle_proxy_properties() {
  if ! turbo_should_prepare_gradle_env; then
    return 1
  fi

  if turbo_stable_env_enabled; then
    return 0
  fi

  case "${RABBY_MOBILE_GRADLE_WRITE_PROXY_PROPERTIES:-false}" in
    true|1|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

turbo_write_gradle_proxy_properties() {
  http_proxy_url=$(turbo_first_set_env_value http_proxy HTTP_PROXY all_proxy ALL_PROXY || true)
  https_proxy_url=$(turbo_first_set_env_value https_proxy HTTPS_PROXY all_proxy ALL_PROXY || true)
  no_proxy_value=$(turbo_first_set_env_value no_proxy NO_PROXY || true)
  gradle_properties_file="$GRADLE_USER_HOME/gradle.properties"
  global_gradle_properties="$(turbo_default_global_gradle_home)/gradle.properties"
  generated_block_begin="# BEGIN: generated by turbo build helper"
  generated_block_end="# END: generated by turbo build helper"
  tmp_gradle_properties=$(turbo_mktemp_file "rabby-gradle-properties")

  mkdir -p "$GRADLE_USER_HOME"

  if [ -f "$gradle_properties_file" ]; then
    source_gradle_properties="$gradle_properties_file"
  else
    source_gradle_properties="$global_gradle_properties"
  fi

  if [ -f "$source_gradle_properties" ]; then
    awk -v begin="$generated_block_begin" -v end="$generated_block_end" '
      index($0, begin) { skip = 1; next }
      index($0, end) { skip = 0; next }
      !skip { print }
    ' "$source_gradle_properties" >"$tmp_gradle_properties"
  else
    : >"$tmp_gradle_properties"
  fi

  if [ -n "$http_proxy_url" ] || [ -n "$https_proxy_url" ] || [ -n "$no_proxy_value" ]; then
    {
      printf '%s\n' "$generated_block_begin"
      printf '# Generated by turbo build helper\n'

      if [ -n "$http_proxy_url" ]; then
        printf 'systemProp.http.proxyHost=%s\n' "$(turbo_proxy_host "$http_proxy_url")"
        printf 'systemProp.http.proxyPort=%s\n' "$(turbo_proxy_port "$http_proxy_url")"
      fi

      if [ -n "$https_proxy_url" ]; then
        printf 'systemProp.https.proxyHost=%s\n' "$(turbo_proxy_host "$https_proxy_url")"
        printf 'systemProp.https.proxyPort=%s\n' "$(turbo_proxy_port "$https_proxy_url")"
      fi

      if [ -n "$no_proxy_value" ]; then
        non_proxy_hosts=$(turbo_java_non_proxy_hosts "$no_proxy_value")
        if [ -n "$non_proxy_hosts" ]; then
          printf 'systemProp.http.nonProxyHosts=%s\n' "$non_proxy_hosts"
          printf 'systemProp.https.nonProxyHosts=%s\n' "$non_proxy_hosts"
        fi
      fi

      printf '%s\n' "$generated_block_end"
    } >>"$tmp_gradle_properties"
  fi

  mv "$tmp_gradle_properties" "$gradle_properties_file"

  turbo_log "wrote Gradle proxy properties to $gradle_properties_file"
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

  if turbo_stable_env_enabled; then
    mkdir -p \
      "$RABBY_MOBILE_TURBO_WORK_ROOT" \
      "$RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT"

    export YARN_CACHE_FOLDER="${RABBY_MOBILE_TURBO_WORK_ROOT}/yarn"
    export RABBY_MOBILE_TURBO_BUNDLE_PATH="${RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT}/vendor/bundle"
    export RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG="${RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT}/bundle-config"
    export RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM="${RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM:-1}"
  fi

  if turbo_build_enabled; then
    mkdir -p "$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT"
  fi

  if turbo_should_prepare_gradle_env; then
    if turbo_stable_env_enabled; then
      export GRADLE_USER_HOME="${RABBY_MOBILE_TURBO_GRADLE_HOME_OVERRIDE:-${RABBY_MOBILE_TURBO_WORK_ROOT}/gradle-user-home}"
    else
      export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$(turbo_default_global_gradle_home)}"
    fi

    turbo_prepare_gradle_proxy_env

    if turbo_should_write_gradle_proxy_properties; then
      turbo_write_gradle_proxy_properties
    fi
  fi
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

turbo_seed_gradle_dependency_cache_from_global() {
  turbo_init_env

  local_modules_root="$GRADLE_USER_HOME/caches/modules-2"
  global_gradle_home=$(turbo_default_global_gradle_home)
  global_modules_root="$global_gradle_home/caches/modules-2"

  if [ -e "$local_modules_root" ]; then
    return 0
  fi

  if [ ! -d "$global_modules_root" ]; then
    return 0
  fi

  mkdir -p "$GRADLE_USER_HOME/caches"
  ln -s "$global_modules_root" "$local_modules_root"
  turbo_log "linked gradle dependency cache from $global_modules_root"
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
  tb_work_dir="$1"
  shift
  tb_ruby_target=$(turbo_project_ruby_target) || return 1
  tb_app_config="$RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG"
  tb_path="$RABBY_MOBILE_TURBO_BUNDLE_PATH"
  tb_force_ruby_platform="$RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM"

  bash -lc '
    set -e
    work_dir="$1"
    ruby_target="$2"
    bundle_app_config="$3"
    bundle_path="$4"
    bundle_force_ruby_platform="$5"
    shift 5

    cd "$work_dir"
    . "$HOME/.rvm/scripts/rvm"
    rvm use "$ruby_target" >/dev/null

    env \
      BUNDLE_APP_CONFIG="$bundle_app_config" \
      BUNDLE_PATH="$bundle_path" \
      BUNDLE_FORCE_RUBY_PLATFORM="$bundle_force_ruby_platform" \
      bundle "$@"
  ' bash "$tb_work_dir" "$tb_ruby_target" "$tb_app_config" "$tb_path" "$tb_force_ruby_platform" "$@"
}

turbo_bundle_exec() {
  tb_app_config="$RABBY_MOBILE_TURBO_BUNDLE_APP_CONFIG"
  tb_path="$RABBY_MOBILE_TURBO_BUNDLE_PATH"
  tb_force_ruby_platform="$RABBY_MOBILE_TURBO_BUNDLE_FORCE_RUBY_PLATFORM"
  tb_work_dir=$(pwd -P)

  if [ -f "$project_dir/.ruby-version" ] && [ -s "$HOME/.rvm/scripts/rvm" ]; then
    turbo_bundle_with_project_ruby "$tb_work_dir" "$@"
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

turbo_mktemp_file() {
  prefix="$1"
  mktemp "${TMPDIR:-/tmp}/${prefix}.XXXXXX"
}

turbo_mktemp_dir() {
  prefix="$1"
  mktemp -d "${TMPDIR:-/tmp}/${prefix}.XXXXXX"
}

turbo_background_upload_script() {
  printf '%s/scripts/turbo-build/_background_upload.sh\n' "$project_dir"
}

turbo_aws_available() {
  command -v aws >/dev/null 2>&1
}

turbo_sha256() {
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$@"
    return 0
  fi

  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$@"
    return 0
  fi

  echo "sha256 helper not found: expected 'shasum' or 'sha256sum'" >&2
  return 1
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

turbo_layer_remote_sync_env_var() {
  case "$1" in
    js-deps) printf '%s\n' "RABBY_MOBILE_TURBO_REMOTE_SYNC_JS_DEPS" ;;
    ruby-gems) printf '%s\n' "RABBY_MOBILE_TURBO_REMOTE_SYNC_RUBY_GEMS" ;;
    cocoapods) printf '%s\n' "RABBY_MOBILE_TURBO_REMOTE_SYNC_COCOAPODS" ;;
    workspace-build) printf '%s\n' "RABBY_MOBILE_TURBO_REMOTE_SYNC_WORKSPACE_BUILD" ;;
    gradle-home) printf '%s\n' "RABBY_MOBILE_TURBO_REMOTE_SYNC_GRADLE_HOME" ;;
    *) return 1 ;;
  esac
}

turbo_layer_remote_sync_enabled() {
  layer="$1"

  if ! turbo_remote_sync_enabled; then
    return 1
  fi

  env_name=$(turbo_layer_remote_sync_env_var "$layer" || true)
  if [ -n "$env_name" ]; then
    eval "env_value=\${$env_name:-}"
    case "$env_value" in
      false|0|no|off)
        return 1
        ;;
      true|1|yes|on)
        return 0
        ;;
    esac
  fi

  case "$layer" in
    gradle-home)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

turbo_layer_restore_prefers_remote() {
  layer="$1"

  if [ "$(turbo_cache_mode)" != "remote-first" ]; then
    return 1
  fi

  turbo_layer_remote_sync_enabled "$layer"
}

turbo_hash_git_files() {
  repo_root="$1"
  shift

  tmp_file=$(mktemp)
  git -C "$repo_root" ls-files "$@" | LC_ALL=C sort >"$tmp_file"

  {
    while IFS= read -r rel_path; do
      if [ -n "$rel_path" ] && [ -f "$repo_root/$rel_path" ]; then
        file_hash=$(turbo_sha256 "$repo_root/$rel_path" | awk '{print $1}')
        printf '%s:%s\n' "$rel_path" "$file_hash"
      fi
    done <"$tmp_file"
  } | turbo_sha256 | awk '{print $1}'

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
    "platform=$(turbo_platform_fingerprint)" \
    "node=$(node -v 2>/dev/null)" \
    "yarn=$(yarn --version 2>/dev/null)" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
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
    "platform=$(turbo_platform_fingerprint)" \
    "ruby=$ruby_version" \
    "bundler=$bundler_version" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
}

turbo_compute_cocoapods_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      apps/mobile/ios/Podfile \
      apps/mobile/ios/Podfile.lock
  )

  printf '%s\n' \
    "platform=$(turbo_platform_fingerprint)" \
    "xcode=$(xcodebuild -version 2>/dev/null | tr '\n' '|')" \
    "ruby=$(ruby -v 2>/dev/null)" \
    "cocoapods=$(turbo_bundle_exec exec pod --version 2>/dev/null || pod --version 2>/dev/null)" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
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
    "platform=$(turbo_platform_fingerprint)" \
    "java=$(java -version 2>&1 | head -n 1)" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
}

turbo_compute_workspace_build_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      package.json \
      yarn.lock \
      tsconfig.build.json \
      tsconfig.packages.build.json \
      packages
  )

  printf '%s\n' \
    "platform=$(turbo_platform_fingerprint)" \
    "node=$(node -v 2>/dev/null)" \
    "typescript=$(yarn tsc -v 2>/dev/null)" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
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

turbo_restore_local_dir_from_remote() {
  layer="$1"
  key="$2"
  remote_path=$(turbo_remote_archive_path "$layer" "$key")
  local_dir=$(turbo_local_layer_dir "$layer" "$key")

  if ! turbo_layer_remote_sync_enabled "$layer"; then
    return 1
  fi

  if ! turbo_aws_available; then
    turbo_log "skip remote restore for $layer because aws cli is unavailable"
    return 1
  fi

  tmp_archive=$(turbo_mktemp_file "rabby-turbo-restore")
  tmp_dir=$(turbo_mktemp_dir "rabby-turbo-restore-dir")

  if ! aws s3 cp "$remote_path" "$tmp_archive" --only-show-errors >/dev/null 2>&1; then
    rm -f "$tmp_archive"
    rm -rf "$tmp_dir"
    return 1
  fi

  if ! tar -xf "$tmp_archive" -C "$tmp_dir"; then
    rm -f "$tmp_archive"
    rm -rf "$tmp_dir"
    return 1
  fi

  rm -f "$tmp_archive"
  rm -rf "$local_dir"
  mkdir -p "$(dirname "$local_dir")"
  mv "$tmp_dir" "$local_dir"
  turbo_log "restored $layer cache from $remote_path"
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

  if turbo_layer_restore_prefers_remote "$layer"; then
    if turbo_restore_local_dir_from_remote "$layer" "$key"; then
      for rel_path in "$@"; do
        rm -rf "$RABBY_MOBILE_REPO_ROOT/$rel_path"
      done
      turbo_copy_paths "$local_dir" "$RABBY_MOBILE_REPO_ROOT" "$@" || true
      return 0
    fi
  fi

  if [ -d "$local_dir" ]; then
    turbo_log "restored $layer cache from local mirror"
    for rel_path in "$@"; do
      rm -rf "$RABBY_MOBILE_REPO_ROOT/$rel_path"
    done
    turbo_copy_paths "$local_dir" "$RABBY_MOBILE_REPO_ROOT" "$@" || true
    return 0
  fi

  if turbo_restore_local_dir_from_remote "$layer" "$key"; then
    for rel_path in "$@"; do
      rm -rf "$RABBY_MOBILE_REPO_ROOT/$rel_path"
    done
    turbo_copy_paths "$local_dir" "$RABBY_MOBILE_REPO_ROOT" "$@" || true
    return 0
  fi

  return 1
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

  if ! turbo_layer_remote_sync_enabled "$layer"; then
    return 0
  fi

  if turbo_aws_available; then
    if ! aws s3 ls "$remote_path" >/dev/null 2>&1; then
      tmp_archive=$(turbo_mktemp_file "rabby-turbo-save")
      # shellcheck disable=SC2086
      tar -cf "$tmp_archive" -C "$RABBY_MOBILE_REPO_ROOT" $existing_paths
      aws s3 cp "$tmp_archive" "$remote_path" --only-show-errors >/dev/null 2>&1 \
        && turbo_log "uploaded $layer cache to $remote_path"
      rm -f "$tmp_archive"
    fi
  fi
}

turbo_workspace_build_paths() {
  git -C "$RABBY_MOBILE_REPO_ROOT" ls-files 'packages/*/tsconfig.build.json' \
    | LC_ALL=C sort \
    | while IFS= read -r rel_path; do
      package_dir=${rel_path%/tsconfig.build.json}
      printf '%s\n' "$package_dir/dist"
      printf '%s\n' "$package_dir/tsconfig.build.tsbuildinfo"
    done
}

turbo_clear_workspace_build_outputs() {
  turbo_workspace_build_paths | while IFS= read -r rel_path; do
    rm -rf "$RABBY_MOBILE_REPO_ROOT/$rel_path"
  done
}

turbo_workspace_build_key_stamp() {
  printf '%s\n' "$RABBY_MOBILE_TURBO_WORK_ROOT/workspace-build.current-key"
}

turbo_android_build_artifacts_stamp_file() {
  printf '%s\n' "$RABBY_MOBILE_TURBO_WORK_ROOT/android-build-artifacts.current-key"
}

turbo_ios_build_artifacts_stamp_file() {
  printf '%s\n' "$RABBY_MOBILE_TURBO_WORK_ROOT/ios-build-artifacts.current-key"
}

turbo_dir_has_files() {
  dir_path="$1"
  [ -d "$dir_path" ] || return 1
  find "$dir_path" -type f -print -quit 2>/dev/null | grep -q .
}

turbo_compute_android_build_artifacts_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      package.json \
      yarn.lock \
      .yarn/patches \
      apps/mobile/package.json \
      apps/mobile/babel.config.js \
      apps/mobile/metro.config.js \
      apps/mobile/react-native.config.js \
      apps/mobile/tsconfig.worker.json \
      apps/mobile/scripts/fns.sh \
      apps/mobile/android/link-assets-manifest.json \
      apps/mobile/assets/fonts \
      apps/mobile/assets/custom \
      apps/mobile/worker-src \
      apps/mobile-local-pages \
      packages/base-utils
  )

  printf '%s\n' \
    "platform=$(turbo_platform_fingerprint)" \
    "node=$(node -v 2>/dev/null)" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
}

turbo_android_build_artifacts_ready() {
  key="$1"
  stamp_file=$(turbo_android_build_artifacts_stamp_file)
  custom_assets_dir="$project_dir/android/app/src/main/assets/custom"
  builtin_pages_dir="$project_dir/android/app/src/main/assets/custom/builtin-pages"
  fonts_dir="$project_dir/android/app/src/main/assets/fonts"
  local_pages_output_dir="$project_dir/assets/android/builtin-pages"
  worker_bundle="$project_dir/android/app/src/main/assets/threads/worker.thread.bundle"

  [ -f "$stamp_file" ] || return 1
  [ "$(cat "$stamp_file" 2>/dev/null)" = "$key" ] || return 1
  [ -f "$worker_bundle" ] || return 1
  turbo_dir_has_files "$fonts_dir" || return 1
  turbo_dir_has_files "$custom_assets_dir" || return 1
  turbo_dir_has_files "$builtin_pages_dir" || return 1
  turbo_dir_has_files "$local_pages_output_dir" || return 1
}

turbo_mark_android_build_artifacts_ready() {
  key="$1"
  stamp_file=$(turbo_android_build_artifacts_stamp_file)
  mkdir -p "$(dirname "$stamp_file")"
  printf '%s' "$key" >"$stamp_file"
}

turbo_compute_ios_build_artifacts_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      package.json \
      yarn.lock \
      .yarn/patches \
      apps/mobile/package.json \
      apps/mobile/babel.config.js \
      apps/mobile/metro.config.js \
      apps/mobile/react-native.config.js \
      apps/mobile/tsconfig.worker.json \
      apps/mobile/scripts/fns.sh \
      apps/mobile/ios/link-assets-manifest.json \
      apps/mobile/assets/fonts \
      apps/mobile/assets/custom \
      apps/mobile/worker-src \
      apps/mobile-local-pages \
      packages/base-utils
  )

  printf '%s\n' \
    "platform=$(turbo_platform_fingerprint)" \
    "node=$(node -v 2>/dev/null)" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
}

turbo_ios_build_artifacts_ready() {
  key="$1"
  stamp_file=$(turbo_ios_build_artifacts_stamp_file)
  ios_resources_dir="$project_dir/ios/RabbyMobile/Resources"
  local_pages_output_dir="$project_dir/assets/ios/builtin-pages"
  worker_bundle="$project_dir/assets/ios/threads/worker.thread.jsbundle"

  [ -f "$stamp_file" ] || return 1
  [ "$(cat "$stamp_file" 2>/dev/null)" = "$key" ] || return 1
  [ -f "$worker_bundle" ] || return 1
  turbo_dir_has_files "$ios_resources_dir" || return 1
  turbo_dir_has_files "$local_pages_output_dir" || return 1
}

turbo_mark_ios_build_artifacts_ready() {
  key="$1"
  stamp_file=$(turbo_ios_build_artifacts_stamp_file)
  mkdir -p "$(dirname "$stamp_file")"
  printf '%s' "$key" >"$stamp_file"
}

turbo_cocoapods_ready() {
  podfile_lock="$project_dir/ios/Podfile.lock"
  pods_manifest_lock="$project_dir/ios/Pods/Manifest.lock"
  xcworkspace_data="$project_dir/ios/RabbyMobile.xcworkspace/contents.xcworkspacedata"

  [ -d "$project_dir/ios/Pods" ] || return 1
  [ -f "$podfile_lock" ] || return 1
  [ -f "$pods_manifest_lock" ] || return 1
  [ -f "$xcworkspace_data" ] || return 1
  cmp -s "$podfile_lock" "$pods_manifest_lock"
}

turbo_gradle_wrapper_version() {
  wrapper_properties="$project_dir/android/gradle/wrapper/gradle-wrapper.properties"

  if [ ! -f "$wrapper_properties" ]; then
    return 1
  fi

  distribution_url=$(sed -n 's/^distributionUrl=//p' "$wrapper_properties" | head -n 1)
  distribution_url="${distribution_url//\\:/:}"

  case "$distribution_url" in
    *gradle-*-bin.zip|*gradle-*-all.zip)
      version_part="${distribution_url##*gradle-}"
      version_part="${version_part%-bin.zip}"
      version_part="${version_part%-all.zip}"
      printf '%s\n' "$version_part"
      ;;
    *)
      return 1
      ;;
  esac
}

turbo_gradle_state_paths() {
  printf '%s\n' ".turbo-build/gradle-user-home/gradle.properties"
  printf '%s\n' ".turbo-build/gradle-user-home/wrapper"

  gradle_wrapper_version=$(turbo_gradle_wrapper_version || true)
  if [ -n "$gradle_wrapper_version" ]; then
    printf '%s\n' ".turbo-build/gradle-user-home/caches/$gradle_wrapper_version"
  fi

  printf '%s\n' ".turbo-build/gradle-user-home/caches/jars-9"
  printf '%s\n' ".turbo-build/gradle-user-home/caches/journal-1"
}

turbo_gradle_local_home_dir() {
  key="$1"
  printf '%s/.turbo-build/gradle-user-home\n' "$(turbo_local_layer_dir gradle-home "$key")"
}

turbo_compute_ios_derived_data_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    turbo_hash_git_files "$repo_root" \
      apps/mobile/ios/Podfile \
      apps/mobile/ios/Podfile.lock \
      apps/mobile/ios/RabbyMobile.xcodeproj/project.pbxproj \
      apps/mobile/ios/RabbyMobile/Info.plist \
      apps/mobile/package.json \
      yarn.lock
  )

  printf '%s\n' \
    "platform=$(turbo_platform_fingerprint)" \
    "xcode=$(xcodebuild -version 2>/dev/null | tr '\n' '|')" \
    "files=$files_hash" \
    | turbo_sha256 | awk '{print $1}'
}

turbo_ios_derived_data_dir() {
  key="$1"
  printf '%s/ios-derived-data/%s\n' "$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT" "$key"
}

turbo_prepare_ios_derived_data() {
  turbo_init_env
  key=$(turbo_compute_ios_derived_data_key)
  derived_data_dir=$(turbo_ios_derived_data_dir "$key")
  mkdir -p "$derived_data_dir"
  export RABBY_MOBILE_TURBO_IOS_DERIVED_DATA_PATH="$derived_data_dir"
}

turbo_use_gradle_home_cache_key() {
  key="$1"
  local_home_dir=$(turbo_gradle_local_home_dir "$key")
  local_home_link="${RABBY_MOBILE_TURBO_WORK_ROOT}/gradle-user-home"

  mkdir -p "$(dirname "$local_home_dir")" "$RABBY_MOBILE_TURBO_WORK_ROOT"
  rm -rf "$local_home_link"
  ln -s "$local_home_dir" "$local_home_link"

  export RABBY_MOBILE_TURBO_GRADLE_HOME_OVERRIDE="$local_home_dir"
  export GRADLE_USER_HOME="$local_home_dir"
}

turbo_restore_gradle_state_from_remote() {
  key="$1"
  turbo_restore_local_dir_from_remote gradle-home "$key"
}

turbo_save_gradle_state_to_remote() {
  key="$1"
  local_dir=$(turbo_local_layer_dir gradle-home "$key")
  remote_path=$(turbo_remote_archive_path gradle-home "$key")
  upload_marker="$local_dir/.remote-upload.pid"
  upload_log="$local_dir/.remote-upload.log"
  background_upload_script=$(turbo_background_upload_script)

  if ! turbo_layer_remote_sync_enabled gradle-home; then
    return 0
  fi

  if ! turbo_aws_available; then
    return 0
  fi

  if aws s3 ls "$remote_path" >/dev/null 2>&1; then
    return 0
  fi

  if [ ! -x "$background_upload_script" ]; then
    turbo_log "skip remote save for gradle-home because upload helper is unavailable: $background_upload_script"
    return 0
  fi

  if [ -f "$upload_marker" ]; then
    upload_pid=$(cat "$upload_marker" 2>/dev/null || true)
    if [ -n "$upload_pid" ] && kill -0 "$upload_pid" >/dev/null 2>&1; then
      turbo_log "gradle-home remote upload already in progress (pid: $upload_pid)"
      return 0
    fi
    rm -f "$upload_marker"
  fi

  nohup "$background_upload_script" \
    "$local_dir" \
    "$remote_path" \
    "$upload_marker" \
    "$upload_log" \
    $(turbo_gradle_state_paths) >/dev/null 2>&1 &

  upload_pid="$!"
  turbo_log "started background upload for gradle-home cache to $remote_path (pid: $upload_pid)"
}

turbo_workspace_build_ready() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"

  (
    cd "$repo_root" &&
      node <<'EOF' >/dev/null 2>&1
[
  '@rabby-wallet/base-utils',
  '@rabby-wallet/biz-utils',
  '@rabby-wallet/service-address',
  '@rabby-wallet/service-keyring',
  '@rabby-wallet/object-multiplex',
  '@rabby-wallet/persist-store',
  '@rabby-wallet/eth-keyring-onekey',
].forEach(require.resolve);
EOF
  )
}

turbo_prepare_workspace_build() {
  turbo_init_env
  cache_key=$(turbo_compute_workspace_build_cache_key)
  stamp_file=$(turbo_workspace_build_key_stamp)
  current_key=""

  if [ -f "$stamp_file" ]; then
    current_key=$(cat "$stamp_file")
  fi

  if [ "$current_key" != "$cache_key" ]; then
    turbo_clear_workspace_build_outputs
  fi

  set -- $(turbo_workspace_build_paths)

  if turbo_build_enabled; then
    turbo_restore_layer workspace-build "$cache_key" "$@" || true
  fi

  if ! turbo_workspace_build_ready; then
    turbo_log "workspace package outputs missing or stale, running yarn build"
    (
      cd "$RABBY_MOBILE_REPO_ROOT" &&
        yarn build
    ) || return $?
  else
    turbo_log "workspace package outputs already available"
  fi

  if turbo_build_enabled; then
    turbo_save_layer workspace-build "$cache_key" "$@"
  fi

  printf '%s' "$cache_key" >"$stamp_file"
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

    turbo_prepare_workspace_build
  else
    if [ -n "$CI" ]; then
      turbo_log "skip extra yarn install in CI; assuming dependencies are already prepared"
    else
      (cd "$RABBY_MOBILE_REPO_ROOT" && yarn)
    fi
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
    if turbo_cocoapods_ready; then
      turbo_log "cocoapods already up to date"
      return 0
    fi

    turbo_restore_layer cocoapods "$cache_key" apps/mobile/ios/Pods || true

    if turbo_cocoapods_ready; then
      turbo_log "cocoapods restored and already up to date"
      return 0
    fi

    (cd "$project_dir/ios" && turbo_bundle_exec exec pod install) || return $?
    turbo_save_layer cocoapods "$cache_key" apps/mobile/ios/Pods
  else
    (cd "$project_dir/ios" && bundle exec pod install --repo-update) || return $?
  fi
}

turbo_restore_gradle_state() {
  build_cache_restore_android_gradle_state
}

turbo_save_gradle_state() {
  build_cache_save_android_gradle_state
}
