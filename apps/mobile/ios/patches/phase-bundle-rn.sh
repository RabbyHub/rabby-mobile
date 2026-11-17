#!/bin/bash

set -e

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $(dirname $script_dir))

# Produce mode (used by deploy-ios-adhoc.sh): redirect the bundle output before
# any build-info write so the whole phase can run outside Xcode.
if [ -n "${RABBY_MOBILE_PREBUNDLE_OUT:-}" ]; then
  export TARGET_BUILD_DIR="$RABBY_MOBILE_PREBUNDLE_OUT"
  export UNLOCALIZED_RESOURCES_FOLDER_PATH="."
  export REACT_NATIVE_PATH="${REACT_NATIVE_PATH:-$project_dir/node_modules/react-native}"
  export PROJECT_DIR="${PROJECT_DIR:-$project_dir}"
  export SRCROOT="${SRCROOT:-$project_dir}"
  export TARGET_NAME="${TARGET_NAME:-RabbyMobile}"
  mkdir -p "$RABBY_MOBILE_PREBUNDLE_OUT"
fi

. "$project_dir/scripts/fns.sh" --source-only

WITH_ENVIRONMENT="$REACT_NATIVE_PATH/scripts/xcode/with-environment.sh"
REACT_NATIVE_XCODE="$REACT_NATIVE_PATH/scripts/react-native-xcode.sh"
SENTRY_XCODE="../node_modules/@sentry/react-native/scripts/sentry-xcode.sh"
export CLI_PATH="$project_dir/scripts/metro-bundle-cli.js"

# Persist Metro's transform cache outside the per-job temp directory so
# consecutive builds can reuse it. The cache key already includes cacheVersion.
if [ -z "${RABBY_MOBILE_METRO_CACHE_DIR:-}" ]; then
  metro_cache_root="${RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT:-$HOME/Library/Caches/rabby-mobile/build-cache}"
  RABBY_MOBILE_METRO_CACHE_DIR="$metro_cache_root/metro-cache"
  mkdir -p "$RABBY_MOBILE_METRO_CACHE_DIR" 2>/dev/null || true
  export RABBY_MOBILE_METRO_CACHE_DIR
fi
echo "[RabbyMobileBuild] METRO_CACHE_DIR is $RABBY_MOBILE_METRO_CACHE_DIR"
export RABBY_MOBILE_METRO_CLI_DELEGATE="$REACT_NATIVE_PATH/scripts/bundle.js"

# you can also run `sudo ln -s $(which node) /usr/local/bin/node` on macOS
export NODE_BINARY=$(command -v node);
echo "[RabbyMobileBuild] NODE_BINARY is $NODE_BINARY"

# if [ -z $SENTRY_AUTH_TOKEN ]; then
#    echo "[RabbyMobileBuild] no SENTRY_AUTH_TOKEN set, abort bundle"
#    exit 1;
# fi

echo "[RabbyMobileBuild] customize build environment vars"
echo "[RabbyMobileBuild] CONFIGURATION is $CONFIGURATION"
load_env_var_from_candidate_files RABBY_MOBILE_CODE || true
if [[ "$CONFIGURATION" == "Release" ]]; then
  [ -z $RABBY_MOBILE_BUILD_ENV ] && export RABBY_MOBILE_BUILD_ENV="production"
  [ -z $buildchannel ] && export buildchannel="appstore"
  if ! validate_rabbit_code; then
    echo "[RabbyMobileBuild] invalid RABBY_MOBILE_CODE, abort bundle"
    exit 1;
  fi
fi
if [[ "$CONFIGURATION" == "Regression" ]]; then
  [ -z $RABBY_MOBILE_BUILD_ENV ] && export RABBY_MOBILE_BUILD_ENV="regression"
  if ! validate_rabbit_code; then
    echo "[RabbyMobileBuild] invalid RABBY_MOBILE_CODE, abort bundle"
    exit 1;
  fi
fi
if [ -z "${APP_ENV:-}" ] && [ -n "${RABBY_MOBILE_BUILD_ENV:-}" ]; then
  export APP_ENV="$RABBY_MOBILE_BUILD_ENV"
fi
if [[ "$APP_ENV" == "hashing" ]] && [[ "$RABBY_MOBILE_CODE" == "RABBY_MOBILE_CODE_DEV" ]]; then
  echo "[RabbyMobileBuild] hashing mode allows fixed RABBY_MOBILE_CODE_DEV."
fi
if [[ "$CONFIGURATION" == "Release" ]] && [[ "$RABBY_MOBILE_CODE" == "RABBY_MOBILE_CODE_DEV" ]] && [[ "$APP_ENV" != "hashing" ]]; then
  echo "[RabbyMobileBuild] Release build is using fallback RABBY_MOBILE_CODE_DEV."
  echo "[RabbyMobileBuild] Run deploy-ios-appstore.sh once or generate ios/RabbyMobile/AppConfig.Release.local.xcconfig with the production RABBY_MOBILE_CODE before packaging."
  exit 1;
fi
if [[ "$CONFIGURATION" == "Regression" ]] && [[ "$RABBY_MOBILE_CODE" == "RABBY_MOBILE_CODE_DEV" ]] && [[ "$APP_ENV" != "hashing" ]]; then
  echo "[RabbyMobileBuild] Regression build is using fallback RABBY_MOBILE_CODE_DEV."
  echo "[RabbyMobileBuild] Run deploy-ios-adhoc.sh once or generate ios/RabbyMobile/AppConfig.Regression.local.xcconfig with the shared regression RABBY_MOBILE_CODE before packaging."
  exit 1;
fi
echo "[RabbyMobileBuild] buildchannel is $buildchannel"

resolve_bundle_env_file() {
  env_file="$project_dir/.env"
  if [ "$APP_ENV" == "hashing" ]; then
    env_file="$project_dir/.env.hashing"
  elif [ "$CONFIGURATION" == "Release" ]; then
    env_file="$project_dir/.env.production"
  elif [ "$CONFIGURATION" == "Regression" ]; then
    if [ -f "$project_dir/.env.regression" ]; then
      env_file="$project_dir/.env.regression"
    elif [ -f "$project_dir/.env.local" ]; then
      env_file="$project_dir/.env.local"
    else
      env_file="$project_dir/.env"
    fi
  elif [ -f "$project_dir/.env.local" ]; then
    env_file="$project_dir/.env.local"
  fi

  printf '%s\n' "$env_file"
}

read_bundle_env_value() {
  local env_file="$1"
  local env_key="$2"

  [ -f "$env_file" ] || return 1

  awk -v key="$env_key" '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    {
      line = $0
      sub(/\r$/, "", line)
      sub(/^[[:space:]]*export[[:space:]]+/, "", line)
      pos = index(line, "=")
      if (pos == 0) next

      current_key = substr(line, 1, pos - 1)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", current_key)
      if (current_key != key) next

      value = substr(line, pos + 1)
      sub(/[[:space:]]*#.*$/, "", value)
      gsub(/^[[:space:]]+|[[:space:]]+$/, "", value)

      first = substr(value, 1, 1)
      last = substr(value, length(value), 1)
      if ((first == "\"" && last == "\"") || (first == "'"'"'" && last == "'"'"'")) {
        value = substr(value, 2, length(value) - 2)
      }

      print value
      exit
    }
  ' "$env_file"
}

log_bundle_env_value() {
  local env_file="$1"
  local env_key="$2"
  local visibility="$3"
  local shell_value file_value effective_value effective_source

  eval "shell_value=\${$env_key:-}"
  file_value=$(read_bundle_env_value "$env_file" "$env_key" 2>/dev/null || true)

  if [ -n "$shell_value" ]; then
    effective_value="$shell_value"
    effective_source="shell-env"
  elif [ -n "$file_value" ]; then
    effective_value="$file_value"
    effective_source="dotenv-file"
  else
    effective_value=""
    effective_source="unset"
  fi

  if [ "$visibility" = "secret" ]; then
    echo "[RabbyMobileBuild] env diagnostics: $env_key shell=$([ -n "$shell_value" ] && echo set || echo unset) file=$([ -n "$file_value" ] && echo set || echo unset) effective_source=$effective_source"
  else
    echo "[RabbyMobileBuild] env diagnostics: $env_key shell=${shell_value:-<unset>} file=${file_value:-<unset>} effective=${effective_value:-<unset>} effective_source=$effective_source"
  fi
}

log_bundle_env_diagnostics() {
  local env_file="$1"
  local dotenv_mode="${APP_ENV:-${BABEL_ENV:-${NODE_ENV:-development}}}"

  echo "[RabbyMobileBuild] env diagnostics begin"
  echo "[RabbyMobileBuild] env diagnostics: CONFIGURATION=${CONFIGURATION:-unset} RABBY_MOBILE_BUILD_ENV=${RABBY_MOBILE_BUILD_ENV:-unset} APP_ENV=${APP_ENV:-unset} BABEL_ENV=${BABEL_ENV:-unset} NODE_ENV=${NODE_ENV:-unset} dotenv_mode=$dotenv_mode buildchannel=${buildchannel:-unset}"
  echo "[RabbyMobileBuild] env diagnostics: expected_dotenv_file=$env_file exists=$([ -f "$env_file" ] && echo yes || echo no)"
  log_bundle_env_value "$env_file" RABBY_MOBILE_BUILD_CHANNEL public
  log_bundle_env_value "$env_file" RABBY_MOBILE_FE_SERVICE_URL public
  log_bundle_env_value "$env_file" RABBY_MOBILE_KR_PWD secret
  log_bundle_env_value "$env_file" RABBY_MOBILE_CODE secret
  echo "[RabbyMobileBuild] env diagnostics end"
}

check_env_file() {
  env_file=$(resolve_bundle_env_file)
  if [ "$APP_ENV" == "hashing" ]; then
    echo "[RabbyMobileBuild] in hashing mode"
  fi

  echo "[RabbyMobileBuild] checking env file: $env_file"

  local sysenv_krPwd=$RABBY_MOBILE_KR_PWD
  local krPwd_fromEnvFile=""
  local env_buildchannel=""

  if [ -f "$env_file" ]; then
    while IFS='=' read -r key value || [ -n "$key" ]; do
      key_cleaned=$(echo "$key" | sed 's/#.*//' | awk '{$1=$1};1')
      key_cleaned=$(echo "$key_cleaned" | sed 's/^export[[:space:]]\+//')
      if [ -z "$key_cleaned" ]; then continue; fi
      value_cleaned=$(echo "$value" | sed 's/#.*//' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
      if [ "$key_cleaned" == "RABBY_MOBILE_KR_PWD" ]; then
        krPwd_fromEnvFile="$value_cleaned"
      elif [ "$key_cleaned" == "RABBY_MOBILE_BUILD_CHANNEL" ]; then
        env_buildchannel="$value_cleaned"
      fi

      if [ "$key_cleaned" == "IOS_SKIP_METRO_BUNDLE_ON_DEBUG" ]; then
        export IOS_SKIP_METRO_BUNDLE_ON_DEBUG="$value_cleaned"
      fi
    done < <(grep -v '^[[:space:]]*#' "$env_file" | grep -v '^[[:space:]]*$')

    if [ -z "$krPwd_fromEnvFile" ]; then
      echo "[RabbyMobileBuild] no RABBY_MOBILE_KR_PWD in env file $env_file, abort bundle"
      exit 1
    elif [ "$CONFIGURATION" == "Release" ] && [ "$env_buildchannel" != "appstore" ]; then
      echo "[RabbyMobileBuild] RABBY_MOBILE_BUILD_CHANNEL from env file $env_file is invalid, abort bundle"
      exit 1
    else
      echo "[RabbyMobileBuild] found env file $env_file, use its vars"
    fi
  else
    if [ -z "$sysenv_krPwd" ]; then
      echo "[RabbyMobileBuild] no RABBY_MOBILE_KR_PWD in system env, abort bundle"
      exit 1
    fi
    echo "RABBY_MOBILE_KR_PWD=$sysenv_krPwd" >> $env_file
    if [ "$CONFIGURATION" == "Release" ]; then
      echo "RABBY_MOBILE_BUILD_CHANNEL=appstore" >> $env_file
    fi
    echo "[RabbyMobileBuild] no env file $env_file found, have written to it"
  fi
}

write_native_build_info() {
  local output_dir="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
  local output_file="$output_dir/rabby-build-info.json"
  local temporary_file="$output_file.tmp"

  mkdir -p "$output_dir"
  "$NODE_BINARY" "$project_dir/scripts/resolve-build-info.js" > "$temporary_file"
  mv "$temporary_file" "$output_file"
  echo "[RabbyMobileBuild] wrote native build info to $output_file"
}

log_bundle_env_diagnostics "$(resolve_bundle_env_file)"
check_env_file;
write_native_build_info;

if [ "$CONFIGURATION" == "Debug" ] && [ "$IOS_SKIP_METRO_BUNDLE_ON_DEBUG" == "true" ]; then
  echo "[RabbyMobileBuild] skip debug bundle while preserving Metro device setup"
  export SKIP_BUNDLING=1
fi

[ -f yarn ] && yarn install --immutable;
[ ! -z $DO_POD_INSTALL ] && bundle install && bundle exec pod install;
echo "[RabbyMobileBuild] customize build environment vars finished."

# Produce mode: write the bundle into RABBY_MOBILE_PREBUNDLE_OUT instead of the
# app, so the deploy script can build it concurrently with the compile.
prebundle_out="${RABBY_MOBILE_PREBUNDLE_OUT:-}"
if [ -n "$prebundle_out" ]; then
  echo "[RabbyMobileBuild] prebundle mode: $prebundle_out"
fi

# Consume mode: a prebuilt bundle was produced by the deploy script; wait for it
# (it overlaps the compile) and copy it in instead of bundling again.
prebundle_dir="${RABBY_MOBILE_PREBUILT_BUNDLE_DIR:-}"
if [ -n "$prebundle_dir" ] && [ -z "$prebundle_out" ]; then
  waited=0
  while [ ! -f "$prebundle_dir/.done" ] && [ "$waited" -lt 900 ]; do
    sleep 2
    waited=$((waited + 2))
  done
  if [ ! -f "$prebundle_dir/.done" ]; then
    echo "[RabbyMobileBuild] prebuilt bundle timed out after ${waited}s" >&2
    exit 1
  fi
  if [ "$(cat "$prebundle_dir/.status" 2>/dev/null)" != "0" ]; then
    echo "[RabbyMobileBuild] prebuilt bundle failed; see the deploy log" >&2
    exit 1
  fi
  bundle_dest="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH"
  mkdir -p "$bundle_dest"
  cp "$prebundle_dir/main.jsbundle" "$bundle_dest/main.jsbundle"
  if [ -d "$prebundle_dir/assets" ]; then
    cp -R "$prebundle_dir/assets/." "$bundle_dest/" 2>/dev/null || true
  fi
  echo "[RabbyMobileBuild] used the prebuilt JS bundle from $prebundle_dir (waited ${waited}s)"
  exit 0
fi

# sentry-cli loads the nearest .env (apps/mobile/.env) into its own process
# env by default, and the Metro bundle it starts inherits that env.
# react-native-dotenv ranks process env above every dotenv file, so .env
# would silently override .env.production in Release builds.
# Set SENTRY_LOAD_DOTENV=1 to opt back in.
export SENTRY_LOAD_DOTENV="${SENTRY_LOAD_DOTENV:-0}"
echo "[RabbyMobileBuild] SENTRY_LOAD_DOTENV is $SENTRY_LOAD_DOTENV"

if [ -n "$prebundle_out" ]; then
  prebundle_rc=0
  /bin/sh -c "$WITH_ENVIRONMENT $SENTRY_XCODE" || prebundle_rc=$?
  printf '%s' "$prebundle_rc" > "$prebundle_out/.status"
  : > "$prebundle_out/.done"
  echo "[RabbyMobileBuild] prebundle finished (status $prebundle_rc)"
  exit "$prebundle_rc"
fi

/bin/sh -c "$WITH_ENVIRONMENT $SENTRY_XCODE"

# react-native-xcode.sh writes ip.txt from the build machine's current
# en0..en8 IP. That IP is stale as soon as the developer changes networks.
# Prefer the explicit dev-server host from .env/.env.local; otherwise keep a
# stable mDNS host for Debug device builds.
if [[ "$CONFIGURATION" == *Debug* ]] && [[ "$PLATFORM_NAME" == *iphoneos* ]]; then
  load_env_var_from_candidate_files DEV_SERVER_HOSTNAME || true
  metro_host="${DEV_SERVER_HOSTNAME:-${RCT_PACKAGER_HOSTNAME:-}}"
  if [ -z "$metro_host" ]; then
    local_host_name="$(scutil --get LocalHostName 2>/dev/null || true)"
    if [ -n "$local_host_name" ]; then
      metro_host="${local_host_name}.local"
    fi
  fi
  if [ -n "$metro_host" ]; then
    metro_ip_file="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/ip.txt"
    mkdir -p "$(dirname "$metro_ip_file")"
    printf '%s\n' "$metro_host" > "$metro_ip_file"
    echo "[RabbyMobileBuild] wrote stable Metro host to $metro_ip_file: $metro_host"
  else
    echo "[RabbyMobileBuild] unable to resolve a stable Metro host; leaving ip.txt unchanged"
  fi
fi

echo "[RabbyMobileBuild] finish bundle with sentry build."
