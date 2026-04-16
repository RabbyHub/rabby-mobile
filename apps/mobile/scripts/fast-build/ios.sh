#!/bin/bash

fscript_dir="$( cd "$( dirname "$0"  )" && pwd  )"
script_dir=$(dirname "$fscript_dir")
project_dir=$(dirname "$script_dir")

. "$fscript_dir/_fns.sh" --source-only

work_dir="$script_dir/.fast-build-work"

template_app_path() {
  printf '%s\n' "$template_archive/Products/Applications/RabbyMobile.app"
}

patched_app_path() {
  printf '%s\n' "$patched_archive/Products/Applications/RabbyMobile.app"
}

prepare_ios_payload_inputs() {
  cd "$project_dir" || return 1

  if [ -z "$SKIP_YARN" ]; then
    echo "Installing dependencies..."
    yarn install --immutable || return 1
  else
    echo "Skipping yarn install as per SKIP_YARN flag."
  fi

  echo "Preparing iOS payload inputs..."
  yarn check-nodeengines &&
    yarn ../mobile-local-pages make-theme &&
    yarn ../mobile-local-pages build --mode ios &&
    yarn react-native-asset &&
    sh ./scripts/fns.sh reset_builtin_assets &&
    yarn buildworker:prod:ios &&
    yarn syncrnversion
}

build_official_ios_payload() {
  prepare_ios_payload_inputs || {
    echo "Failed to prepare iOS payload inputs."
    return 1
  }

  rm -rf "$payload_build_dir"
  mkdir -p "$payload_app_dir"

  local_build_target_platform="ios"
  local_build_env="${RABBY_MOBILE_BUILD_ENV:-regression}"
  local_buildchannel="${buildchannel:-selfhost-reg}"
  local_configuration="Regression"
  local_project_dir="$project_dir/ios"
  local_project_root="$project_dir"
  local_configuration_build_dir="$payload_build_dir"
  local_resources_folder_path="RabbyMobile.app"
  local_platform_name="iphoneos"
  local_pods_root="$project_dir/ios/Pods"
  local_node_binary="${NODE_BINARY:-$(command -v node)}"
  local_react_native_path="$project_dir/node_modules/react-native"
  local_bundle_config="$project_dir/metro.config.js"
  local_entry_file="index.js"
  local_bundle_name="main"
  local_use_hermes="${USE_HERMES:-true}"
  initialize_ios_sentry_auto_upload_default
  local_sentry_disable_auto_upload="${SENTRY_DISABLE_AUTO_UPLOAD:-true}"

  if [ ! -x "$local_react_native_path/scripts/react-native-xcode.sh" ]; then
    echo "react-native-xcode.sh not found at $local_react_native_path/scripts/react-native-xcode.sh"
    return 1
  fi

  cd "$project_dir" || return 1
  env \
    BUILD_TARGET_PLATFORM="$local_build_target_platform" \
    RABBY_MOBILE_BUILD_ENV="$local_build_env" \
    buildchannel="$local_buildchannel" \
    CONFIGURATION="$local_configuration" \
    PROJECT_DIR="$local_project_dir" \
    PROJECT_ROOT="$local_project_root" \
    CONFIGURATION_BUILD_DIR="$local_configuration_build_dir" \
    UNLOCALIZED_RESOURCES_FOLDER_PATH="$local_resources_folder_path" \
    PLATFORM_NAME="$local_platform_name" \
    PODS_ROOT="$local_pods_root" \
    NODE_BINARY="$local_node_binary" \
    REACT_NATIVE_PATH="$local_react_native_path" \
    BUNDLE_CONFIG="$local_bundle_config" \
    ENTRY_FILE="$local_entry_file" \
    BUNDLE_NAME="$local_bundle_name" \
    USE_HERMES="$local_use_hermes" \
    SENTRY_DISABLE_AUTO_UPLOAD="$local_sentry_disable_auto_upload" \
    bash "$local_react_native_path/scripts/react-native-xcode.sh" || return 1

  if [ ! -f "$payload_app_dir/main.jsbundle" ]; then
    echo "Expected generated iOS bundle not found at $payload_app_dir/main.jsbundle"
    return 1
  fi
}

prepare() {
  mkdir -p "$work_dir"

  export fast_build_scope="bundle-only"
  export payload_build_dir="$work_dir/ios-payload"
  export payload_app_dir="$payload_build_dir/RabbyMobile.app"

  export template_archive="$work_dir/template.xcarchive"
  export template_hash_file="$work_dir/template-ios.template-shell-hash"
  export patched_archive="$work_dir/template-patched.xcarchive"
  export revision_hash="$(collect_ios_template_entries)"

  if [ -d "$template_archive" ]; then
    cached_template_hash=""
    if [ -f "$template_hash_file" ]; then
      cached_template_hash=$(tr -d '\r\n' <"$template_hash_file")
    fi

    if [ -z "$cached_template_hash" ] || [ "$cached_template_hash" != "$revision_hash" ]; then
      echo "[ios-fast-build] Local template archive is stale for current template shell hash, removing cached template."
      rm -rf "$template_archive"
      rm -f "$template_hash_file"
    fi
  fi

  if [ ! -d "$template_archive" ]; then
    echo "[ios-fast-build] No local template archive found for current template shell hash."
    return 2
  fi
}

prepare_for_save_template() {
  mkdir -p "$work_dir"

  export fast_build_scope="bundle-only"
  export payload_build_dir="$work_dir/ios-payload"
  export payload_app_dir="$payload_build_dir/RabbyMobile.app"

  export template_archive="$work_dir/template.xcarchive"
  export template_hash_file="$work_dir/template-ios.template-shell-hash"
  export patched_archive="$work_dir/template-patched.xcarchive"
}

patch_template_archive() {
  rm -rf "$patched_archive"
  cp -R "$template_archive" "$patched_archive"

  archive_app="$(patched_app_path)"
  if [ ! -d "$archive_app" ]; then
    echo "[ios-fast-build] Expected app bundle not found at $archive_app"
    return 1
  fi

  echo "[ios-fast-build] Replacing main.jsbundle in template archive..."
  cp "$payload_app_dir/main.jsbundle" "$archive_app/main.jsbundle"
}

extract_template_signing_identity() {
  codesign -dvv "$(template_app_path)" 2>&1 |
    sed -n 's/^Authority=//p' |
    head -n 1
}

extract_template_entitlements() {
  entitlements_file="$work_dir/template-ios.entitlements.plist"
  codesign -d --entitlements :- "$(template_app_path)" >"$entitlements_file" 2>/dev/null || return 1
  printf '%s\n' "$entitlements_file"
}

resign_patched_archive() {
  archive_app="$(patched_app_path)"
  signing_identity="$(extract_template_signing_identity)"

  if [ -z "$signing_identity" ]; then
    echo "[ios-fast-build] Failed to resolve signing identity from template archive."
    return 1
  fi

  entitlements_file="$(extract_template_entitlements)" || {
    echo "[ios-fast-build] Failed to extract entitlements from template archive."
    return 1
  }

  echo "[ios-fast-build] Re-signing patched app with template identity..."
  codesign \
    --force \
    --sign "$signing_identity" \
    --entitlements "$entitlements_file" \
    --preserve-metadata=identifier,flags,requirements,runtime \
    "$archive_app" || return 1

  echo "[ios-fast-build] Verifying patched app signature..."
  codesign --verify --deep --strict --verbose=2 "$archive_app" || return 1
}

export_patched_archive() {
  cd "$project_dir" || return 1
  export RABBY_MOBILE_IOS_SKIP_BUILD_ARCHIVE=true
  export RABBY_MOBILE_IOS_ARCHIVE_PATH="$patched_archive"
  project_bundle_exec exec fastlane ios adhoc
}

save_template_from_archive() {
  source_archive="$1"

  if [ -z "$source_archive" ] || [ ! -d "$source_archive" ]; then
    echo "[ios-fast-build] template source archive not found: $source_archive"
    return 1
  fi

  revision_hash="$(collect_ios_template_entries)"

  rm -rf "$template_archive"
  mkdir -p "$work_dir"
  cp -R "$source_archive" "$template_archive"
  printf '%s\n' "$revision_hash" >"$template_hash_file"

  echo "[ios-fast-build] saved template archive for shell hash $revision_hash"
}

run_export_from_template() {
  prepare || return $?
  build_official_ios_payload || return 1
  patch_template_archive || return 1
  resign_patched_archive || return 1
  export_patched_archive
}

command="$1"
shift || true

case "$command" in
  export)
    run_export_from_template "$@"
    ;;
  template-available)
    prepare
    ;;
  save-template)
    prepare_for_save_template
    save_template_from_archive "$@"
    ;;
  *)
    echo "Usage: $0 {export|template-available|save-template <archive_path>}"
    exit 1
    ;;
esac
