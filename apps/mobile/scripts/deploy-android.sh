#!/bin/sh

# release targets:
# - https://download.rabby.io/downloads/wallet-mobile/android/version.json
# - https://download.rabby.io/downloads/wallet-mobile/android/rabby-mobile.apk

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

export BUILD_TARGET_PLATFORM="android";
check_build_params;
check_s3_params;
checkout_s3_pub_deployment_params;

# prepare variables
# TODO: read from gradle
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
android_version_name=$(grep -m1 "versionName" $project_dir/android/app/build.gradle | cut -d'"' -f2)
android_version_code=$(grep -m1 "versionCode" ./android/app/build.gradle | xargs | cut -c 13-)

cd $project_dir;

BUILD_DATE=`date '+%Y%m%d_%H%M%S'`

version_bundle_name="$BUILD_DATE-${android_version_name}.${android_version_code}"
version_bundle_suffix=""
apk_name="rabby-mobile.apk"
deployment_local_dir="$script_dir/deployments/android"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;

build_selfhost() {
  yarn;
  if [ $RABBY_HOST_OS != "Windows" ]; then
    bundle exec fastlane android alpha
  else
    echo "[deploy-android] run build.sh script directly."
    sh $project_dir/android/build.sh buildApk
  fi
}

build_appstore() {
  yarn;
  if [ $RABBY_HOST_OS != "Windows" ]; then
    bundle exec fastlane android appstore
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
  "$project_dir/src/changeLogs/$android_version_name.md"
  "$project_dir/src/changeLogs/$android_version_name.$android_version_code.md"
)

for changelog in "${possible_changelogs[@]}"; do
  if [ -f $changelog ]; then
    echo "[deploy-android] found changelog: $changelog"
    cp $changelog $deployment_local_dir/
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
    android_export_target="$project_dir/android/app/build/outputs/apk/release/app-release.apk"
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

cp $android_export_target $deployment_local_dir/$apk_name

file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
version_bundle_name="$file_date-${android_version_name}.${android_version_code}"
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


echo ""
echo "[deploy-android] start sync..."

if [ "$REALLY_UPLOAD" == "true" ]; then
  echo "[deploy-android] will be backup at $backup_s3_dir (not public)"
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.json" --acl authenticated-read --content-type application/json --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.md" --acl authenticated-read --content-type text/plain --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.apk" --acl authenticated-read --content-type application/vnd.android.package-archive --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.aab" --acl authenticated-read --content-type application/x-authorware-bin --exact-timestamps

  if [ $buildchannel == 'selfhost-reg' ]; then
    echo "[deploy-android] will public at $staging_s3_dir, served as $staging_cdn_baseurl"
    aws s3 sync $backup_s3_dir/ $staging_s3_dir/ --acl $staging_acl --exact-timestamps
  else
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

    [ ! -z $CI ] && node $script_dir/notify-lark.js "$apk_url" android
  fi
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "";
  echo "[deploy-android] force fresh CDN:"
  echo "[deploy-android] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/android*'\`"
  echo ""
fi

echo "[deploy-android] finish sync."

# WIP: .well-known
