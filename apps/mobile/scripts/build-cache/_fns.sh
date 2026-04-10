#!/bin/sh

build_cache_enabled() {
  [ "${RABBY_MOBILE_TURBO_BUILD:-false}" = "true" ]
}

build_cache_log() {
  printf '[build-cache] %s\n' "$*"
}

build_cache_default_local_cache_dir() {
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

build_cache_default_global_gradle_home() {
  printf '%s\n' "${RABBY_MOBILE_GLOBAL_GRADLE_HOME:-$HOME/.gradle}"
}

build_cache_remote_cache_configured() {
  [ -n "${RABBY_MOBILE_BUILD_BUCKET:-}" ]
}

build_cache_should_prepare_gradle_env() {
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

build_cache_cache_mode() {
  case "${RABBY_MOBILE_TURBO_CACHE_MODE:-local-first}" in
    remote-first|l2-first|remote|l2)
      printf '%s\n' "remote-first"
      ;;
    *)
      printf '%s\n' "local-first"
      ;;
  esac
}

build_cache_platform_fingerprint() {
  printf '%s/%s\n' "$(uname -s 2>/dev/null)" "$(uname -m 2>/dev/null)"
}

build_cache_first_set_env_value() {
  for env_name in "$@"; do
    eval "env_value=\${$env_name:-}"
    if [ -n "$env_value" ]; then
      printf '%s\n' "$env_value"
      return 0
    fi
  done
  return 1
}

build_cache_proxy_scheme() {
  proxy_url="$1"
  if [ "${proxy_url#*://}" != "$proxy_url" ]; then
    printf '%s\n' "${proxy_url%%://*}"
  fi
}

build_cache_proxy_authority() {
  proxy_url="$1"
  proxy_rest="${proxy_url#*://}"
  if [ "$proxy_rest" = "$proxy_url" ]; then
    proxy_rest="$proxy_url"
  fi
  proxy_rest="${proxy_rest%%/*}"
  printf '%s\n' "${proxy_rest##*@}"
}

build_cache_proxy_host() {
  proxy_authority=$(build_cache_proxy_authority "$1")
  case "$proxy_authority" in
    *:*) printf '%s\n' "${proxy_authority%%:*}" ;;
    *) printf '%s\n' "$proxy_authority" ;;
  esac
}

build_cache_proxy_port() {
  proxy_url="$1"
  proxy_authority=$(build_cache_proxy_authority "$proxy_url")
  case "$proxy_authority" in
    *:*) printf '%s\n' "${proxy_authority##*:}" ;;
    *)
      case "$(build_cache_proxy_scheme "$proxy_url")" in
        https) printf '%s\n' "443" ;;
        *) printf '%s\n' "80" ;;
      esac
      ;;
  esac
}

build_cache_java_non_proxy_hosts() {
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

build_cache_prepare_gradle_proxy_env() {
  http_proxy_url=$(build_cache_first_set_env_value http_proxy HTTP_PROXY all_proxy ALL_PROXY || true)
  https_proxy_url=$(build_cache_first_set_env_value https_proxy HTTPS_PROXY all_proxy ALL_PROXY || true)
  no_proxy_value=$(build_cache_first_set_env_value no_proxy NO_PROXY || true)

  proxy_opts=""

  if [ -n "$http_proxy_url" ]; then
    proxy_opts="$proxy_opts -Dhttp.proxyHost=$(build_cache_proxy_host "$http_proxy_url") -Dhttp.proxyPort=$(build_cache_proxy_port "$http_proxy_url")"
  fi

  if [ -n "$https_proxy_url" ]; then
    proxy_opts="$proxy_opts -Dhttps.proxyHost=$(build_cache_proxy_host "$https_proxy_url") -Dhttps.proxyPort=$(build_cache_proxy_port "$https_proxy_url")"
  fi

  if [ -n "$no_proxy_value" ]; then
    non_proxy_hosts=$(build_cache_java_non_proxy_hosts "$no_proxy_value")
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
      build_cache_log "prepared GRADLE_OPTS proxy settings for Gradle wrapper"
      ;;
  esac

  case " ${JAVA_TOOL_OPTIONS:-} " in
    *" -Dhttp.proxyHost="*|*" -Dhttps.proxyHost="*) ;;
    *)
      export JAVA_TOOL_OPTIONS="$proxy_opts${JAVA_TOOL_OPTIONS:+ $JAVA_TOOL_OPTIONS}"
      build_cache_log "prepared JAVA_TOOL_OPTIONS proxy settings for Gradle daemon"
      ;;
  esac
}

build_cache_should_write_gradle_proxy_properties() {
  if ! build_cache_should_prepare_gradle_env; then
    return 1
  fi

  if build_cache_enabled; then
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

build_cache_write_gradle_proxy_properties() {
  http_proxy_url=$(build_cache_first_set_env_value http_proxy HTTP_PROXY all_proxy ALL_PROXY || true)
  https_proxy_url=$(build_cache_first_set_env_value https_proxy HTTPS_PROXY all_proxy ALL_PROXY || true)
  no_proxy_value=$(build_cache_first_set_env_value no_proxy NO_PROXY || true)
  gradle_properties_file="$GRADLE_USER_HOME/gradle.properties"
  global_gradle_properties="$(build_cache_default_global_gradle_home)/gradle.properties"
  generated_block_begin="# BEGIN: generated by build cache helper"
  generated_block_end="# END: generated by build cache helper"
  tmp_gradle_properties=$(build_cache_mktemp_file "rabby-gradle-properties")

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
      printf '# Generated by build cache helper\n'

      if [ -n "$http_proxy_url" ]; then
        printf 'systemProp.http.proxyHost=%s\n' "$(build_cache_proxy_host "$http_proxy_url")"
        printf 'systemProp.http.proxyPort=%s\n' "$(build_cache_proxy_port "$http_proxy_url")"
      fi

      if [ -n "$https_proxy_url" ]; then
        printf 'systemProp.https.proxyHost=%s\n' "$(build_cache_proxy_host "$https_proxy_url")"
        printf 'systemProp.https.proxyPort=%s\n' "$(build_cache_proxy_port "$https_proxy_url")"
      fi

      if [ -n "$no_proxy_value" ]; then
        non_proxy_hosts=$(build_cache_java_non_proxy_hosts "$no_proxy_value")
        if [ -n "$non_proxy_hosts" ]; then
          printf 'systemProp.http.nonProxyHosts=%s\n' "$non_proxy_hosts"
          printf 'systemProp.https.nonProxyHosts=%s\n' "$non_proxy_hosts"
        fi
      fi

      printf '%s\n' "$generated_block_end"
    } >>"$tmp_gradle_properties"
  fi

  mv "$tmp_gradle_properties" "$gradle_properties_file"

  build_cache_log "wrote Gradle proxy properties to $gradle_properties_file"
}

build_cache_repo_root() {
  cd "$project_dir/../.." && pwd
}

build_cache_init_env() {
  export RABBY_MOBILE_REPO_ROOT="${RABBY_MOBILE_REPO_ROOT:-$(build_cache_repo_root)}"
  export RABBY_MOBILE_TURBO_WORK_ROOT="${RABBY_MOBILE_REPO_ROOT}/.turbo-build"
  export RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT="${project_dir}/.turbo-build"
  export RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT="${RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT:-$(build_cache_default_local_cache_dir)}"

  if build_cache_remote_cache_configured; then
    export RABBY_MOBILE_TURBO_REMOTE_CACHE_ROOT="s3://${RABBY_MOBILE_BUILD_BUCKET}/_private/rabby-mobile/build-cache"
  else
    unset RABBY_MOBILE_TURBO_REMOTE_CACHE_ROOT
  fi

  if build_cache_enabled; then
    mkdir -p \
      "$RABBY_MOBILE_TURBO_WORK_ROOT" \
      "$RABBY_MOBILE_TURBO_MOBILE_WORK_ROOT" \
      "$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT"
  fi

  if build_cache_should_prepare_gradle_env; then
    if build_cache_enabled; then
      export GRADLE_USER_HOME="${RABBY_MOBILE_TURBO_GRADLE_HOME_OVERRIDE:-${RABBY_MOBILE_TURBO_WORK_ROOT}/gradle-user-home}"
    else
      export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$(build_cache_default_global_gradle_home)}"
    fi

    build_cache_prepare_gradle_proxy_env
  fi
}

build_cache_seed_gradle_wrapper_from_global() {
  build_cache_init_env

  local_wrapper_root="$GRADLE_USER_HOME/wrapper"
  local_wrapper_dists="$local_wrapper_root/dists"
  global_gradle_home=$(build_cache_default_global_gradle_home)
  global_wrapper_dists="$global_gradle_home/wrapper/dists"

  if [ -d "$local_wrapper_dists" ]; then
    return 0
  fi

  if [ ! -d "$global_wrapper_dists" ]; then
    return 0
  fi

  mkdir -p "$local_wrapper_root"
  cp -R "$global_wrapper_dists" "$local_wrapper_dists"
  build_cache_log "seeded gradle wrapper dists from $global_wrapper_dists"
}

build_cache_seed_gradle_dependency_cache_from_global() {
  build_cache_init_env

  local_modules_root="$GRADLE_USER_HOME/caches/modules-2"
  global_gradle_home=$(build_cache_default_global_gradle_home)
  global_modules_root="$global_gradle_home/caches/modules-2"

  if [ -e "$local_modules_root" ]; then
    return 0
  fi

  if [ ! -d "$global_modules_root" ]; then
    return 0
  fi

  mkdir -p "$GRADLE_USER_HOME/caches"
  ln -s "$global_modules_root" "$local_modules_root"
  build_cache_log "linked gradle dependency cache from $global_modules_root"
}

build_cache_mktemp_file() {
  prefix="$1"
  mktemp "${TMPDIR:-/tmp}/${prefix}.XXXXXX"
}

build_cache_background_upload_script() {
  printf '%s/scripts/turbo-build/_background_upload.sh\n' "$project_dir"
}

build_cache_aws_available() {
  command -v aws >/dev/null 2>&1
}

build_cache_sha256() {
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

build_cache_remote_sync_enabled() {
  if ! build_cache_enabled; then
    return 1
  fi

  if ! build_cache_remote_cache_configured; then
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

build_cache_layer_remote_sync_enabled() {
  if ! build_cache_remote_sync_enabled; then
    return 1
  fi

  case "${RABBY_MOBILE_TURBO_REMOTE_SYNC_GRADLE_HOME:-}" in
    false|0|no|off)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

build_cache_layer_restore_prefers_remote() {
  if [ "$(build_cache_cache_mode)" != "remote-first" ]; then
    return 1
  fi

  build_cache_layer_remote_sync_enabled
}

build_cache_hash_git_files() {
  repo_root="$1"
  shift

  tmp_file=$(mktemp)
  git -C "$repo_root" ls-files "$@" | LC_ALL=C sort >"$tmp_file"

  {
    while IFS= read -r rel_path; do
      if [ -n "$rel_path" ] && [ -f "$repo_root/$rel_path" ]; then
        file_hash=$(build_cache_sha256 "$repo_root/$rel_path" | awk '{print $1}')
        printf '%s:%s\n' "$rel_path" "$file_hash"
      fi
    done <"$tmp_file"
  } | build_cache_sha256 | awk '{print $1}'

  rm -f "$tmp_file"
}

build_cache_compute_gradle_cache_key() {
  repo_root="$RABBY_MOBILE_REPO_ROOT"
  files_hash=$(
    build_cache_hash_git_files "$repo_root" \
      apps/mobile/android/build.gradle \
      apps/mobile/android/settings.gradle \
      apps/mobile/android/gradle.properties \
      apps/mobile/android/app/build.gradle \
      apps/mobile/android/gradle/wrapper/gradle-wrapper.properties \
      apps/mobile/package.json \
      yarn.lock
  )

  printf '%s\n' \
    "platform=$(build_cache_platform_fingerprint)" \
    "java=$(java -version 2>&1 | head -n 1)" \
    "files=$files_hash" \
    | build_cache_sha256 | awk '{print $1}'
}

build_cache_gradle_wrapper_version() {
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

build_cache_gradle_state_paths() {
  printf '%s\n' ".turbo-build/gradle-user-home/gradle.properties"
  printf '%s\n' ".turbo-build/gradle-user-home/wrapper"

  gradle_wrapper_version=$(build_cache_gradle_wrapper_version || true)
  if [ -n "$gradle_wrapper_version" ]; then
    printf '%s\n' ".turbo-build/gradle-user-home/caches/$gradle_wrapper_version"
  fi

  printf '%s\n' ".turbo-build/gradle-user-home/caches/jars-9"
  printf '%s\n' ".turbo-build/gradle-user-home/caches/journal-1"
}

build_cache_local_layer_dir() {
  key="$1"
  printf '%s/gradle-home/%s\n' "$RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT" "$key"
}

build_cache_remote_archive_path() {
  key="$1"
  printf '%s/gradle-home/%s.tar\n' "$RABBY_MOBILE_TURBO_REMOTE_CACHE_ROOT" "$key"
}

build_cache_restore_local_dir_from_remote() {
  key="$1"
  remote_path=$(build_cache_remote_archive_path "$key")
  local_dir=$(build_cache_local_layer_dir "$key")

  if ! build_cache_layer_remote_sync_enabled; then
    return 1
  fi

  if ! build_cache_aws_available; then
    build_cache_log "skip remote restore for gradle-home because aws cli is unavailable"
    return 1
  fi

  tmp_archive=$(build_cache_mktemp_file "rabby-build-cache-restore")
  tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/rabby-build-cache-restore-dir.XXXXXX")

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
  build_cache_log "restored gradle-home cache from $remote_path"
}

build_cache_gradle_local_home_dir() {
  key="$1"
  printf '%s/.turbo-build/gradle-user-home\n' "$(build_cache_local_layer_dir "$key")"
}

build_cache_use_gradle_home_cache_key() {
  key="$1"
  local_home_dir=$(build_cache_gradle_local_home_dir "$key")
  local_home_link="${RABBY_MOBILE_TURBO_WORK_ROOT}/gradle-user-home"

  mkdir -p "$(dirname "$local_home_dir")" "$RABBY_MOBILE_TURBO_WORK_ROOT"
  rm -rf "$local_home_link"
  ln -s "$local_home_dir" "$local_home_link"

  export RABBY_MOBILE_TURBO_GRADLE_HOME_OVERRIDE="$local_home_dir"
  export GRADLE_USER_HOME="$local_home_dir"
}

build_cache_restore_android_gradle_state() {
  build_cache_init_env
  cache_key=$(build_cache_compute_gradle_cache_key)

  if build_cache_should_write_gradle_proxy_properties; then
    build_cache_write_gradle_proxy_properties
  fi

  if ! build_cache_enabled; then
    return 0
  fi

  build_cache_use_gradle_home_cache_key "$cache_key"

  if build_cache_layer_restore_prefers_remote; then
    build_cache_restore_local_dir_from_remote "$cache_key" || true
  fi

  if [ -d "$GRADLE_USER_HOME" ]; then
    build_cache_log "restored gradle-home cache from local mirror"
  else
    build_cache_restore_local_dir_from_remote "$cache_key" || true
  fi

  build_cache_seed_gradle_wrapper_from_global
  build_cache_seed_gradle_dependency_cache_from_global
}

build_cache_save_android_gradle_state_to_remote() {
  key="$1"
  local_dir=$(build_cache_local_layer_dir "$key")
  remote_path=$(build_cache_remote_archive_path "$key")
  upload_marker="$local_dir/.remote-upload.pid"
  upload_log="$local_dir/.remote-upload.log"
  background_upload_script=$(build_cache_background_upload_script)

  if ! build_cache_layer_remote_sync_enabled; then
    return 0
  fi

  if ! build_cache_aws_available; then
    return 0
  fi

  if aws s3 ls "$remote_path" >/dev/null 2>&1; then
    return 0
  fi

  if [ ! -x "$background_upload_script" ]; then
    build_cache_log "skip remote save for gradle-home because upload helper is unavailable: $background_upload_script"
    return 0
  fi

  if [ -f "$upload_marker" ]; then
    upload_pid=$(cat "$upload_marker" 2>/dev/null || true)
    if [ -n "$upload_pid" ] && kill -0 "$upload_pid" >/dev/null 2>&1; then
      build_cache_log "gradle-home remote upload already in progress (pid: $upload_pid)"
      return 0
    fi
    rm -f "$upload_marker"
  fi

  nohup "$background_upload_script" \
    "$local_dir" \
    "$remote_path" \
    "$upload_marker" \
    "$upload_log" \
    $(build_cache_gradle_state_paths) >/dev/null 2>&1 &

  upload_pid="$!"
  build_cache_log "started background upload for gradle-home cache to $remote_path (pid: $upload_pid)"
}

build_cache_save_android_gradle_state() {
  build_cache_init_env
  cache_key=$(build_cache_compute_gradle_cache_key)

  if ! build_cache_enabled; then
    return 0
  fi

  build_cache_use_gradle_home_cache_key "$cache_key"
  build_cache_log "gradle-home cache already materialized in local mirror"
  build_cache_save_android_gradle_state_to_remote "$cache_key"
}
