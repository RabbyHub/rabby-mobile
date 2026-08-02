#!/bin/bash

# release targets:
# - https://download.rabby.io/downloads/wallet-mobile/android/version.json
# - https://download.rabby.io/downloads/wallet-mobile/android/rabby-mobile.apk

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only
. $script_dir/fast-build/_fns.sh --source-only
. $script_dir/turbo-build/_fns.sh --source-only

export RABBY_MOBILE_ANDROID_FAST_BUILD="${RABBY_MOBILE_ANDROID_FAST_BUILD:-false}"
FAST_BUILD_ENABLED=$(fast_build_enabled_value)
UPLOAD_TEMPLATE_APK=${RABBY_MOBILE_UPLOAD_TEMPLATE_APK:-${FAST_BUILD_ENABLED}}
export BUILD_TARGET_PLATFORM="android";
export RABBY_MOBILE_BUILD_ENV="regression";
check_build_params;

cd $project_dir;

refresh_android_version_metadata() {
  proj_version=$(node --eval="process.stdout.write(require('./package.json').version)")
  app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)")
  android_version_name=$(resolve_google_play_android_version_name)
  android_version_code=$(resolve_google_play_android_version_code)

  BUILD_DATE=$(date '+%Y%m%d_%H%M%S')
  version_bundle_name="$BUILD_DATE-${android_version_name}.${android_version_code}"
}

refresh_android_version_metadata

version_bundle_suffix=""
apk_name="rabby-mobile.apk"
deployment_local_dir="$script_dir/deployments/android"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;


prepare_android_build_artifacts() {
  turbo_prepare_js_dependencies || return $?

  if turbo_build_enabled; then
    android_build_artifacts_key=$(turbo_compute_android_build_artifacts_key)

    if turbo_android_build_artifacts_ready "$android_build_artifacts_key"; then
      turbo_log "android build artifacts already up to date"
      return 0
    fi
  fi

  ensure_inpage_bridge_assets || return $?

  yarn check-nodeengines &&
    yarn ../mobile-local-pages make-theme &&
    yarn ../mobile-local-pages build --mode android &&
    yarn react-native-asset &&
    sh ./scripts/fns.sh reset_builtin_assets &&
    yarn buildworker:prod:android
  prepare_status=$?

  if [ $prepare_status -eq 0 ] && turbo_build_enabled; then
    turbo_mark_android_build_artifacts_ready "$android_build_artifacts_key"
  fi

  return $prepare_status
}

build_selfhost() {
  export RABBY_MOBILE_BUILD_ENV="regression";
  prepare_android_build_artifacts || return $?
  if [ "$FAST_BUILD_ENABLED" = "true" ]; then
    echo "[deploy-android] try to fast-build from template.apk."
    echo "[deploy-android] fast build scope: ${RABBY_MOBILE_FAST_BUILD_SCOPE:-bundle-only}"
    CI="$CI" SKIP_YARN=true bash $script_dir/fast-build/android.sh resign
    if [ $? -eq 0 ]; then
      echo "[deploy-android] APK fast-build succeeded."
      android_export_target="$script_dir/.fast-build-work/app-resigned.apk"
      return ;
    fi
    echo "Failed to fast-build APK. Will build it again."
    FAST_BUILD_ENABLED="false"
  fi
  echo "[deploy-android] build directly with gradle."
  if [ $buildchannel == "selfhost" ]; then
    bash $project_dir/android/build.sh buildApk
  else
    bash $project_dir/android/build.sh buildRegApk
  fi
}

# ============ prepare version.json :start ============== #
unix_replace_variables $script_dir/tpl/android/version.json $deployment_local_dir/version.json \
  --var-APP_VER_CODE=$android_version_code \
  --var-APP_VER="$android_version_name"
# ============ prepare version.json :end ============== #

# ============ prepare changelogs :start ============== #
possible_changelogs=(
  "$project_dir/src/changeLogs/$android_version_name.android.md"
  "$project_dir/src/changeLogs/$android_version_name.md"
)

for changelog in "${possible_changelogs[@]}"; do
  if [ -f $changelog ]; then
    echo "[deploy-android] found changelog: $changelog"
    cp $changelog $deployment_local_dir/$android_version_name.md
    break
  fi
done
# ============ prepare changelogs :end ============== #

echo "[deploy-android] start build..."
version_bundle_suffix=".apk"
staging_dir_suffix=""
if [ $buildchannel == "selfhost-reg" ]; then
  [ "$GHA_MOCK_BUILD_FAILED" == "true" ] && SKIP_BUILD=true

  android_export_target="$project_dir/android/app/build/outputs/apk/regression/app-regression.apk"

  [[ -z $SKIP_BUILD || ! -f $android_export_target ]] && build_selfhost;

  if [ ! -f $android_export_target ]; then
    echo "'$android_export_target' is not exist, maybe you need to run build.sh first?"
    exit 1
  fi
else
  android_export_target="$project_dir/android/app/build/outputs/apk/release/$android_version_code.apk"

  [[ -z $SKIP_BUILD || ! -f $android_export_target ]] && build_selfhost;

  if [ ! -f $android_export_target ]; then
    echo "'$android_export_target' is not exist, maybe you need to run build.sh first?"
    exit 1
  fi
fi

# # leave here for debug
# echo "android_export_target: $android_export_target"

echo "[deploy-android] finish build."

if [[ ! -f $android_export_target || $GHA_MOCK_BUILD_FAILED == "true" ]]; then
  echo "[deploy-ios-adhoc] ⚠️ build failed! No $android_export_target found";
  node $script_dir/notify-lark.js "FAILED" android
  exit 1;
fi

file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
version_bundle_name="$file_date-${android_version_name}.${android_version_code}"
if [ "$FAST_BUILD_ENABLED" = "true" ]; then
  version_bundle_name="${version_bundle_name}-resigned"
  apk_name="rabby-mobile-resigned.apk"
fi
version_bundle_filename="${version_bundle_name}${version_bundle_suffix}"

cp $android_export_target $deployment_local_dir/$apk_name

android_16kb_check_mode="${RABBY_MOBILE_ANDROID_16KB_CHECK:-warn}"
android_16kb_report_json="$deployment_local_dir/android-16kb-page-size.json"
android_16kb_report_text="$deployment_local_dir/android-16kb-page-size.txt"
if [[ "$version_bundle_suffix" =~ .*\.apk ]] && [ "$android_16kb_check_mode" != "off" ]; then
  echo "[deploy-android] check APK 16KB page-size support..."
  if ! node $script_dir/check-android-apk-16kb.js \
    --apk "$android_export_target" \
    --json "$android_16kb_report_json" \
    --text "$android_16kb_report_text" \
    --mode "$android_16kb_check_mode"; then
    echo "[deploy-android] APK 16KB page-size check failed in $android_16kb_check_mode mode."
    exit 1
  fi
fi

print_manual_upload_sentry_sourcemap() {
  if [ ! -z $SENTRY_DISABLE_AUTO_UPLOAD ]; then
    echo "[deploy-android] manual upload sourcemap to sentry:"
    echo "[deploy-android]
      ./node_modules/@sentry/cli/bin/sentry-cli react-native gradle \
      --bundle "app/build/generated/assets/createBundleReleaseJsAndAssets/index.android.bundle" \
      --sourcemap "app/build/generated/sourcemaps/react/release/index.android.bundle.map" \
      --release com.debank.rabbymobile@${android_version_name}+${android_version_code} --dist ${android_version_code} --org <org_name> --project <proj_name>
    "
  else
    echo "[deploy-android] will auto upload sourcemap to sentry."
  fi
}

echo ""
echo "[deploy-android] APK ready at: $deployment_local_dir/$apk_name"
echo "[deploy-android] no remote upload is performed (AWS/S3 upload has been disabled for this build)."

if [ -z $CI ]; then
  print_manual_upload_sentry_sourcemap;
fi

echo "[deploy-android] finished."
# WIP: .well-known
