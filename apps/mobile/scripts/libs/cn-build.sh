#!/bin/sh

cn_build_source_trace() {
  printf '[cn-build][trace] %s %s\n' "$(date '+%H:%M:%S')" "$*" >&2
}

cn_build_source_trace "start"

cn_build_enabled() {
  case "${RABBY_MOBILE_CN_BUILD:-false}" in
    true|1|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

cn_build_log() {
  printf '[cn-build] %s\n' "$*"
}

cn_build_clear_proxy_env() {
  unset http_proxy https_proxy all_proxy HTTP_PROXY HTTPS_PROXY ALL_PROXY
  unset no_proxy NO_PROXY
}

cn_build_prepare_node_env() {
  cn_build_source_trace "cn_build_prepare_node_env"
  cn_build_enabled || return 0

  cn_build_clear_proxy_env

  export SENTRY_DISABLE_AUTO_UPLOAD="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"
  export COCOAPODS_DISABLE_STATS="${COCOAPODS_DISABLE_STATS:-true}"

  cn_npm_registry="${RABBY_MOBILE_CN_NPM_REGISTRY:-https://registry.npmmirror.com}"
  export YARN_NPM_REGISTRY_SERVER="$cn_npm_registry"
  export YARN_HTTP_PROXY=""
  export YARN_HTTPS_PROXY=""
  export npm_config_registry="${npm_config_registry:-$cn_npm_registry}"
  export npm_config_proxy=""
  export npm_config_https_proxy=""
  export npm_config_noproxy="*"

  if [ -n "${RABBY_MOBILE_CN_HERMES_TARBALL_PATH:-}" ] && [ -z "${HERMES_ENGINE_TARBALL_PATH:-}" ]; then
    export HERMES_ENGINE_TARBALL_PATH="$RABBY_MOBILE_CN_HERMES_TARBALL_PATH"
    cn_build_log "using local Hermes tarball $HERMES_ENGINE_TARBALL_PATH"
  fi

  if [ -n "${RABBY_MOBILE_CN_RNCORE_TARBALL_PATH:-}" ] && [ -z "${RCT_TESTONLY_RNCORE_TARBALL_PATH:-}" ]; then
    export RCT_TESTONLY_RNCORE_TARBALL_PATH="$RABBY_MOBILE_CN_RNCORE_TARBALL_PATH"
    cn_build_log "using local RNCore tarball $RCT_TESTONLY_RNCORE_TARBALL_PATH"
  fi

  if [ -n "${RABBY_MOBILE_CN_RNDEP_TARBALL_PATH:-}" ] && [ -z "${RCT_USE_LOCAL_RN_DEP:-}" ]; then
    export RCT_USE_LOCAL_RN_DEP="$RABBY_MOBILE_CN_RNDEP_TARBALL_PATH"
    cn_build_log "using local RN dependency tarball $RCT_USE_LOCAL_RN_DEP"
  fi

  cn_build_log "using npm registry $cn_npm_registry"
}

cn_build_lockfile_bundler_version() {
  cn_build_source_trace "cn_build_lockfile_bundler_version"
  lockfile_path="$1/Gemfile.lock"
  if [ ! -f "$lockfile_path" ]; then
    return 0
  fi

  sed -n '/^BUNDLED WITH$/{n;p;}' "$lockfile_path" | xargs
}

cn_build_prepare_bundler() {
  cn_build_source_trace "cn_build_prepare_bundler"
  cn_build_enabled || return 0

  bundle_work_dir="$1"
  bundle_app_config="$2"
  gem_source="${RABBY_MOBILE_CN_RUBYGEMS_MIRROR:-https://gems.ruby-china.com}"
  bundler_version=$(cn_build_lockfile_bundler_version "$bundle_work_dir")

  cn_build_clear_proxy_env

  if [ -n "$bundler_version" ]; then
    if [ -f "$bundle_work_dir/.ruby-version" ] && [ -s "$HOME/.rvm/scripts/rvm" ]; then
      bash -lc '
        set -e
        work_dir="$1"
        bundler_version="$2"
        gem_source="$3"

        cd "$work_dir"
        unset GEM_HOME GEM_PATH BUNDLE_APP_CONFIG BUNDLE_PATH
        . "$HOME/.rvm/scripts/rvm"
        ruby_version="$(tr -d "\r\n" < .ruby-version)"
        ruby_gemset=""
        if [ -f .ruby-gemset ]; then
          ruby_gemset="$(tr -d "\r\n" < .ruby-gemset)"
        fi
        ruby_target="$ruby_version"
        if [ -n "$ruby_gemset" ]; then
          ruby_target="${ruby_target}@${ruby_gemset}"
        fi
        rvm use "$ruby_target" >/dev/null

        if ! bundle "_${bundler_version}_" --version >/dev/null 2>&1; then
          gem install bundler -v "$bundler_version" --no-document --clear-sources --source "$gem_source" >/dev/null
        fi
      ' bash "$bundle_work_dir" "$bundler_version" "$gem_source"
    elif ! bundle "_${bundler_version}_" --version >/dev/null 2>&1; then
      gem install bundler -v "$bundler_version" --no-document --clear-sources --source "$gem_source" >/dev/null
    fi
  fi

  if [ -n "$bundle_app_config" ]; then
    env BUNDLE_APP_CONFIG="$bundle_app_config" \
      bundle config set --local mirror.https://rubygems.org "$gem_source" >/dev/null
  else
    (
      cd "$bundle_work_dir" &&
        bundle config set --local mirror.https://rubygems.org "$gem_source" >/dev/null
    )
  fi

  cn_build_log "using rubygems mirror $gem_source"
}

cn_build_gradle_distribution_url() {
  cn_build_source_trace "cn_build_gradle_distribution_url"
  wrapper_properties="$1"
  distribution_url=$(sed -n 's/^distributionUrl=//p' "$wrapper_properties" | head -n 1 | tr -d '\r')
  distribution_url=$(printf '%s' "$distribution_url" | sed 's#\\:#:#g')
  distribution_filename="${distribution_url##*/}"

  printf '%s\n' "${RABBY_MOBILE_CN_GRADLE_DISTRIBUTION_URL:-https://mirrors.cloud.tencent.com/gradle/${distribution_filename}}"
}

cn_build_prepare_gradle_wrapper() {
  cn_build_source_trace "cn_build_prepare_gradle_wrapper"
  cn_build_enabled || return 0

  wrapper_properties="$1"
  backup_file="${wrapper_properties}.cn-build.bak"
  mirror_url=$(cn_build_gradle_distribution_url "$wrapper_properties")

  if [ ! -f "$backup_file" ]; then
    cp "$wrapper_properties" "$backup_file"
  fi

  python3 - "$wrapper_properties" "$mirror_url" <<'PY'
from pathlib import Path
import sys

wrapper_path = Path(sys.argv[1])
mirror_url = sys.argv[2]
lines = wrapper_path.read_text().splitlines()
updated = []

for line in lines:
    if line.startswith("distributionUrl="):
        escaped = mirror_url.replace(":", "\\:")
        updated.append(f"distributionUrl={escaped}")
    else:
        updated.append(line)

wrapper_path.write_text("\n".join(updated) + "\n")
PY

  export RABBY_MOBILE_CN_GRADLE_WRAPPER_BACKUP="$backup_file"
  cn_build_log "using Gradle distribution $mirror_url"
}

cn_build_restore_gradle_wrapper() {
  cn_build_source_trace "cn_build_restore_gradle_wrapper"
  cn_build_enabled || return 0

  wrapper_properties="$1"
  backup_file="${RABBY_MOBILE_CN_GRADLE_WRAPPER_BACKUP:-${wrapper_properties}.cn-build.bak}"

  if [ -f "$backup_file" ]; then
    mv "$backup_file" "$wrapper_properties"
  fi
}

cn_build_prepare_ios_signing_env() {
  cn_build_source_trace "cn_build_prepare_ios_signing_env"
  cn_build_enabled || return 0

  export RABBY_MOBILE_IOS_SKIP_MATCH="${RABBY_MOBILE_IOS_SKIP_MATCH:-true}"
  cn_build_log "will reuse local iOS signing assets and skip fastlane match"
}

cn_build_source_trace "file loaded"
