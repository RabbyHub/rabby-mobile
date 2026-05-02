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
if [ "$HASH_CHECK" != "true" ]; then
  check_s3_params;
  checkout_s3_pub_deployment_params;
fi

cd $project_dir;

refresh_android_version_metadata() {
  proj_version=$(node --eval="process.stdout.write(require('./package.json').version)")
  app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)")
  android_version_name=$(resolve_google_play_android_version_name)
  android_version_code=$(resolve_google_play_android_version_code)

  BUILD_DATE=$(date '+%Y%m%d_%H%M%S')
  version_bundle_name="$BUILD_DATE-${android_version_name}.${android_version_code}"
}

prepare_appstore_android_version_code() {
  local package_name latest_version_code target_version_code

  if ! resolve_google_play_service_account_json >/dev/null 2>&1; then
    echo "[deploy-android] skip Google Play versionCode auto-bump because no service account credentials are available."
    return 0
  fi

  package_name=$(resolve_google_play_package_name "") || {
    echo "[deploy-android] skip Google Play versionCode auto-bump because package name could not be resolved."
    return 0
  }

  latest_version_code=$(resolve_google_play_latest_version_code "$package_name" 2>/dev/null || true)
  if [ -z "$latest_version_code" ]; then
    echo "[deploy-android] skip Google Play versionCode auto-bump because latest Google Play versionCode could not be determined."
    return 0
  fi

  if [ "$android_version_code" -gt "$latest_version_code" ]; then
    echo "[deploy-android] Google Play versionCode preflight passed before build: local=$android_version_code latest=$latest_version_code"
    return 0
  fi

  target_version_code=$((latest_version_code + 1))
  echo "[deploy-android] local Android versionCode $android_version_code is not ahead of Google Play latest $latest_version_code; bumping local build number to at least $target_version_code before appstore build."

  ./node_modules/.bin/react-native-version \
    --never-amend \
    --target android \
    --set-build "$target_version_code" || return 1
  refresh_android_version_metadata

  echo "[deploy-android] Android versionCode prepared for appstore build: $android_version_code"
}

refresh_android_version_metadata

version_bundle_suffix=""
apk_name="rabby-mobile.apk"
deployment_local_dir="$script_dir/deployments/android"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;

if [ "$buildchannel" == "appstore" ] && [ "$HASH_CHECK" != "true" ]; then
  prepare_appstore_android_version_code || exit $?
fi

prepare_android_build_artifacts() {
  turbo_prepare_js_dependencies || return $?
  turbo_prepare_ruby_bundle || return $?

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
  if [ $RABBY_HOST_OS != "Windows" ]; then
    if [ "$FAST_BUILD_ENABLED" = "true" ]; then
      echo "[deploy-android] try to fast-build from template.apk."
      echo "[deploy-android] fast build scope: ${RABBY_MOBILE_FAST_BUILD_SCOPE:-bundle-only}"
      CI="$CI" SKIP_YARN=true sh $script_dir/fast-build/android.sh resign
      if [ $? -eq 0 ]; then
        echo "[deploy-android] APK fast-build succeeded."
        android_export_target="$script_dir/.fast-build-work/app-resigned.apk"
        return ;
      fi
      echo "Failed to fast-build APK. Will build it again."
      FAST_BUILD_ENABLED="false"
    fi
    echo "[deploy-android] build with fastlane."
    turbo_restore_gradle_state
    turbo_bundle_exec exec fastlane android selfhost
    fastlane_status=$?
    [ $fastlane_status -eq 0 ] && turbo_save_gradle_state
    return $fastlane_status
  else
    echo "[deploy-android] run build.sh script directly."
    if [ $buildchannel == "selfhost" ]; then
      sh $project_dir/android/build.sh buildApk
    else
      sh $project_dir/android/build.sh buildRegApk
    fi
  fi
}

build_appstore() {
  export RABBY_MOBILE_BUILD_ENV="production";
  if turbo_build_enabled; then
    prepare_android_build_artifacts || return $?
  else
    ensure_inpage_bridge_assets || return $?
    yarn &&
      yarn check-nodeengines &&
      yarn ../mobile-local-pages bundle:all &&
      yarn link-assets &&
      yarn buildworker:prod:android
  fi

  turbo_prepare_ruby_bundle || return $?

  if [ $RABBY_HOST_OS != "Windows" ]; then
    echo "[deploy-android] build with fastlane."
    turbo_restore_gradle_state
    turbo_bundle_exec exec fastlane android playstore
    fastlane_status=$?
    [ $fastlane_status -eq 0 ] && turbo_save_gradle_state
    return $fastlane_status
  else
    echo "[deploy-android] run build.sh script directly."
    sh $project_dir/android/build.sh buildAppStore
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
if [ $buildchannel == "appstore" ]; then
  google_play_warn_if_version_code_not_ahead "$android_version_code" "" "Android appstore build preflight"
  version_bundle_suffix=".aab"
  staging_dir_suffix="-appstore"
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/bundle/release/app-release.aab"
  [[ -z $SKIP_BUILD || ! -f $android_export_target ]] && build_appstore;

  if [ ! -f $android_export_target ]; then
    echo "'$android_export_target' is not exist, maybe you need to run build.sh first?"
    exit 1
  fi
else
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

    if [ ! -f $android_export_target ]; then
      echo "'$android_export_target' is not exist, maybe you need to download it from https://play.google.com/console/u/1/developers/bundle-explorer-selector to $android_export_target MANUALLY"
      exit 1
    fi
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

if [ "$HASH_CHECK" == "true" ]; then
  echo "[deploy-android] HASH_CHECK=true, skip S3/Google Play deployment steps."
  exit 0
fi

file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
version_bundle_name="$file_date-${android_version_name}.${android_version_code}"
if [ "$FAST_BUILD_ENABLED" = "true" ]; then
  version_bundle_name="${version_bundle_name}-resigned"
  apk_name="rabby-mobile-resigned.apk"
fi
version_bundle_filename="${version_bundle_name}${version_bundle_suffix}"

staging_dirname=android-$version_bundle_name$staging_dir_suffix
backup_s3_dir=$S3_ANDROID_BAK_DEPLOYMENT/$staging_dirname
staging_s3_dir=$S3_ANDROID_PUB_DEPLOYMENT/$staging_dirname
staging_cdn_baseurl=$cdn_deployment_urlbase/$staging_dirname

release_s3_dir=$S3_ANDROID_PUB_DEPLOYMENT/android
release_cdn_baseurl=$cdn_deployment_urlbase/android
staging_acl="authenticated-read"

backup_name=$S3_ANDROID_BAK_DEPLOYMENT/android/$version_bundle_filename

if [[ "$version_bundle_suffix" =~ .*\.apk ]]; then
  apk_url="$staging_cdn_baseurl/$apk_name"
else
  apk_url=""
fi

cp $android_export_target $deployment_local_dir/$apk_name

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

# only upload apk as template when it is not fast-built from a template
if [ "$UPLOAD_TEMPLATE_APK" = "true" ] && [ "$FAST_BUILD_ENABLED" != "true" ] && [ $buildchannel = "selfhost-reg" ] && [ ! -z $RABBY_MOBILE_REG_PUB_DEPLOYMENT ]; then
  template_apk_s3_dir=$RABBY_MOBILE_REG_PUB_DEPLOYMENT/.templates/android;
  native_part_hash=$(collect_android_native_entries)
  echo "[deploy-android] will set apk $android_export_target to $template_apk_s3_dir/$native_part_hash.apk"
  aws s3 cp $android_export_target $template_apk_s3_dir/$native_part_hash.apk --acl public-read --content-type application/vnd.android.package-archive
  echo "[deploy-android] finished setting apk, public url is: $cdn_deployment_urlbase/.templates/android/$native_part_hash.apk"
fi

echo ""
echo "[deploy-android] start sync..."

if [ "$REALLY_UPLOAD" == "true" ]; then
  echo "[deploy-android] will be backup at $backup_s3_dir (not public)"
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.json" --acl authenticated-read --content-type application/json --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.md" --acl authenticated-read --content-type text/plain --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.apk" --acl authenticated-read --content-type application/vnd.android.package-archive --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.aab" --acl authenticated-read --content-type application/x-authorware-bin --exact-timestamps

  if [ "$buildchannel" == 'selfhost-reg' ]; then
    echo "[deploy-android] will public at $staging_s3_dir, served as $staging_cdn_baseurl"
    [ -z "$CI" ] && echo "[deploy-android] open $apk_url to download"
    aws s3 sync $backup_s3_dir/ $staging_s3_dir/ --acl $staging_acl --exact-timestamps
  else
    echo "[deploy-android] will public as $apk_url"
    aws s3 sync $backup_s3_dir/ $release_s3_dir/ --exclude '*' --include "*.md" --acl public-read --content-type text/plain --exact-timestamps
  fi

  echo "";
  if [ $buildchannel != "appstore" ]; then
    echo "[deploy-android] to refresh the release($buildchannel), you could execute:"
    echo "[deploy-android] aws s3 sync $backup_s3_dir/ $release_s3_dir/ --acl public-read"
  else
    echo "[deploy-android] open directory and upload to google play store "
    echo "[deploy-android] you can find the .aab from $backup_s3_dir";
  fi

  if [ ! -z $apk_url ]; then
    echo "[deploy-android] publish as $apk_name, with version.json"

    [ ! -z "$CI" ] && [ "$SKIP_NOTIFY_LARK" != "true" ] && node $script_dir/notify-lark.js "$apk_url" android "$FAST_BUILD_ENABLED"
  fi
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "";
  echo "[deploy-android] force fresh CDN:"
  echo "[deploy-android] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/android*'\`"
  echo ""

  print_manual_upload_sentry_sourcemap;
fi

echo "[deploy-android] finish sync."

# WIP: .well-known
