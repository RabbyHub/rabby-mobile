#!/bin/bash

fbscript_dir="$( cd "$( dirname "$0"  )" && pwd  )"

fast_build_enabled() {
  case "${RABBY_MOBILE_ANDROID_FAST_BUILD:-}" in
    true|1|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

fast_build_enabled_value() {
  if fast_build_enabled; then
    printf '%s\n' "true"
  else
    printf '%s\n' "false"
  fi
}

ios_fast_build_enabled() {
  case "${RABBY_MOBILE_IOS_FAST_BUILD:-}" in
    true|1|yes|on)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ios_fast_build_enabled_value() {
  if ios_fast_build_enabled; then
    printf '%s\n' "true"
  else
    printf '%s\n' "false"
  fi
}

project_ruby_version() {
  if [ -f "$project_dir/.ruby-version" ]; then
    tr -d '\r\n' <"$project_dir/.ruby-version"
  fi
}

project_ruby_gemset() {
  if [ -f "$project_dir/.ruby-gemset" ]; then
    tr -d '\r\n' <"$project_dir/.ruby-gemset"
  fi
}

project_ruby_target() {
  ruby_version=$(project_ruby_version)
  ruby_gemset=$(project_ruby_gemset)

  if [ -z "$ruby_version" ]; then
    return 1
  fi

  if [ -n "$ruby_gemset" ]; then
    printf '%s@%s\n' "$ruby_version" "$ruby_gemset"
  else
    printf '%s\n' "$ruby_version"
  fi
}

project_bundle_with_ruby() {
  pb_work_dir="$1"
  shift
  pb_ruby_target=$(project_ruby_target) || return 1

  bash -lc '
    set -e
    work_dir="$1"
    ruby_target="$2"
    shift 2

    cd "$work_dir"
    . "$HOME/.rvm/scripts/rvm"
    rvm use "$ruby_target" >/dev/null

    bundle "$@"
  ' bash "$pb_work_dir" "$pb_ruby_target" "$@"
}

project_bundle_exec() {
  pb_work_dir=$(pwd -P)

  if [ -f "$project_dir/.ruby-version" ] && [ -s "$HOME/.rvm/scripts/rvm" ]; then
    project_bundle_with_ruby "$pb_work_dir" "$@"
    return $?
  fi

  bundle "$@"
}

normalize_fast_build_scope() {
  case "${RABBY_MOBILE_FAST_BUILD_SCOPE:-bundle-only}" in
    bundle-only|bundle)
      printf '%s\n' "bundle-only"
      ;;
    assets-payload|assets)
      printf '%s\n' "assets-payload"
      ;;
    full-payload|full)
      printf '%s\n' "full-payload"
      ;;
    *)
      printf '%s\n' "bundle-only"
      ;;
  esac
}

find_build_tools_version() {
  local latest_line=$(sdkmanager --list_installed | grep "build-tools" | LC_COLLATE=C sort -rV | head -1)
  # pick first line
  local latest_version=$(echo $latest_line | sed -E 's/.*build-tools;([0-9]+\.[0-9]+\.[0-9]+).*/\1/')
  echo $latest_version
}

# list all files consist native part for android app
# sort them, calculate their checksums, join them with spaces, then calculate the final checksum
collect_android_native_entries() {
  if [ -z $script_dir ]; then
    echo "script_dir is not set, please set it before running this script."
    exit 1
  fi
  # filterout output
  node $script_dir/fast-build/collect_android_native_hashes.js calculate_hash >> /dev/null

  # local node_output=$(node $script_dir/fast-build/collect_android_native_hashes.js calculate_hash)
  # # extract hash from sample `export TEMPLATE_FINGERPRINT="d9ba9047670a00f559c60769559b4f4fa0cb697674b34df761b7edee2f78bd67"`
  # local native_part_hash=$(echo "$node_output" | grep '^export TEMPLATE_FINGERPRINT=' | cut -d'=' -f2- | tr -d '"')
  # # echo "TEMPLATE_FINGERPRINT=$native_part_hash"
  # echo $native_part_hash;

  echo $(cat $script_dir/fast-build/android_native_files_sha256.txt)
}

collect_ios_template_entries() {
  if [ -z $script_dir ]; then
    echo "script_dir is not set, please set it before running this script."
    exit 1
  fi

  node $script_dir/fast-build/collect_ios_template_hashes.js calculate_hash >> /dev/null

  echo $(cat $script_dir/fast-build/ios_template_shell_sha256.txt)
}

download_template_apk_by_hash() {
  if [ -z $script_dir ]; then
    echo "script_dir is not set, please set it before running this script."
    exit 1
  fi

  local template_hash="$1"
  local template_apk_url="https://download.rabby.io/downloads/wallet-mobile-reg/.templates/android/${template_hash}.apk"

  # check if template_apk_url is valid
  if ! curl --output /dev/null --silent --head --fail "$template_apk_url"; then
    echo "Template APK not found at $template_apk_url"
    exit 1
  fi

  echo "[debug] Downloading template APK from $template_apk_url"
  curl -L -o "$script_dir/.fast-build-work/template.apk" "$template_apk_url"
  if [ $? -ne 0 ]; then
    echo "Failed to download template APK."
    exit 1
  fi
}
