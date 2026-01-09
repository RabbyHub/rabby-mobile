#!/bin/bash

# release targets:
# - https://download.rabby.io/downloads/wallet-mobile/android/version.json
# - https://download.rabby.io/downloads/wallet-mobile/android/rabby-mobile.apk

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only
. $script_dir/fast-build/_fns.sh --source-only

USE_RESIGN_APK=${USE_RESIGN_APK:-"false"}
export BUILD_TARGET_PLATFORM="android";
check_build_params;
check_s3_params;
checkout_s3_pub_deployment_params;

cd $project_dir;

# prepare variables
# TODO: read from gradle
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
android_version_name=$(grep -m1 "versionName" ./android/app/build.gradle | cut -d'"' -f2)
android_version_code=$(grep -m1 "versionCode" ./android/app/build.gradle | xargs | cut -c 13-)

BUILD_DATE=`date '+%Y%m%d_%H%M%S'`

version_bundle_name="$BUILD_DATE-${android_version_name}.${android_version_code}"
version_bundle_suffix=""
apk_name="rabby-mobile.apk"
deployment_local_dir="$script_dir/deployments/android"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;

build_selfhost() {
  export RABBY_MOBILE_BUILD_ENV="regression";
  [ -z "$CI" ] && yarn;
  yarn check-nodeengines && yarn ../mobile-local-pages bundle:all && yarn link-assets && yarn buildworker:prod:android;
  if [ $RABBY_HOST_OS != "Windows" ]; then
    if [ "$USE_RESIGN_APK" == "true" ]; then
      echo "[deploy-android] try to resign template.apk to get the new one."
      CI="$CI" SKIP_YARN=true sh $script_dir/fast-build/android.sh resign
      if [ $? -eq 0 ]; then
        echo "[deploy-android] APK resigned successfully."
        android_export_target="$script_dir/.fast-build-work/app-resigned.apk"
        return ;
      fi
      echo "Failed to resign APK. Will Build it again."
      USE_RESIGN_APK="false"
    fi
    echo "[deploy-android] build with fastlane."
    bundle exec fastlane android selfhost
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
  yarn && yarn check-nodeengines && yarn ../mobile-local-pages bundle:all && yarn link-assets && yarn buildworker:prod:android;
  if [ $RABBY_HOST_OS != "Windows" ]; then
    echo "[deploy-android] build with fastlane."
    bundle exec fastlane android playstore
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

file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
version_bundle_name="$file_date-${android_version_name}.${android_version_code}"
if [ "$USE_RESIGN_APK" == "true" ]; then
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

# only upload apk as template when it is not resigned
if [ "$USE_RESIGN_APK" != "true" ] && [ $buildchannel = "selfhost-reg" ] && [ ! -z $RABBY_MOBILE_REG_PUB_DEPLOYMENT ]; then
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
    echo "[deploy-android] you can find the .aar from $backup_s3_dir";
  fi

  if [ ! -z $apk_url ]; then
    echo "[deploy-android] publish as $apk_name, with version.json"

    [ ! -z "$CI" ] && [ "$SKIP_NOTIFY_LARK" != "true" ] && node $script_dir/notify-lark.js "$apk_url" android "$USE_RESIGN_APK"
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
