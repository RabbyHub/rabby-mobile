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
android_version_code=$(grep -m1 "versionCode" ./android/app/build.gradle | xargs | cut -c 13-)
android_version_name=$(grep -m1 "versionName" $project_dir/android/app/build.gradle | cut -d'"' -f2)

cd $project_dir;

BUILD_DATE=`date '+%Y%m%d_%H%M%S'`

version_bundle_name="$BUILD_DATE-${android_version_name}.${android_version_code}"
version_bundle_suffix=""
apk_name="rabby-mobile.apk"
deployment_local_dir="$script_dir/deployments"

rm -rf $deployment_local_dir/android && mkdir -p $deployment_local_dir/android;

build_alpha() {
  if [ $RABBY_HOST_OS != "Windows" ]; then
    bundle exec fastlane android alpha
  else
    echo "[deploy-android] run build.sh script directly."
    sh $project_dir/android/build.sh buildApk
  fi
}

build_appstore() {
  if [ $RABBY_HOST_OS != "Windows" ]; then
    bundle exec fastlane android release
  else
    echo "[deploy-android] run build.sh script directly."
    sh $project_dir/android/build.sh buildAppStore
  fi
}

# ============ prepare version.json :start ============== #
unix_replace_variables $script_dir/tpl/android/version.json $deployment_local_dir/android/version.json \
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
    cp $changelog $deployment_local_dir/android/
    break
  fi
done
# ============ prepare changelogs :end ============== #

echo "[deploy-android] start build..."
if [ $buildchannel == "appstore" ]; then
  version_bundle_suffix=".aab"
  REALLY_UPLOAD="";
  unset REALLY_UPLOAD;
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/bundle/release/app-release.aab"
  [[ -z $SKIP_BUILD || ! -f $android_export_target ]] && build_appstore
else
  version_bundle_suffix=".apk"
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/apk/release/app-release.apk"
  [[ -z $SKIP_BUILD || ! -f $android_export_target ]] && build_alpha

  cp $android_export_target $deployment_local_dir/android/$apk_name
fi

# # leave here for debug
# echo "android_export_target: $android_export_target"

echo "[deploy-android] finish build."

if [ ! -f $android_export_target ]; then
  echo "'$android_export_target' is not exist, maybe you need to run build.sh first?"
  exit 1
else
  file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
  version_bundle_name="$file_date-${android_version_name}.${android_version_code}"
  version_bundle_filename="${version_bundle_name}${version_bundle_suffix}"
fi

staging_s3_dir=$S3_ANDROID_PUB_DEPLOYMENT/android-$version_bundle_name
staging_cdn_baseurl=$cdn_deployment_urlbase/android-$version_bundle_name
release_s3_dir=$S3_ANDROID_PUB_DEPLOYMENT/android
release_cdn_baseurl=$cdn_deployment_urlbase/android
staging_acl="authenticated-read"
[ $buildchannel == "selfhost-reg" ] && staging_acl="public-read"

backup_name=$S3_ANDROID_BAK_DEPLOYMENT/android/$version_bundle_filename

if [[ "$version_bundle_suffix" =~ .*\.apk ]]; then
  apk_url="$staging_cdn_baseurl/$apk_name"
else
  apk_url=""
fi

echo "[deploy-android] will upload to $staging_s3_dir"
if [ $staging_acl == "public-read" ]; then
  echo "[deploy-android] will be public at $staging_cdn_baseurl"
else
  echo "[deploy-android] will be stored at $staging_cdn_baseurl (not public)"
fi

echo ""
echo "[deploy-android] start sync..."

if [ ! -z $REALLY_UPLOAD ]; then
  echo "[deploy-android] backup as $staging_s3_dir/$apk_name..."
  aws s3 sync $deployment_local_dir/android $staging_s3_dir/ --exclude '*' --include "*.json" --acl $staging_acl --content-type application/json
  aws s3 sync $deployment_local_dir/android $staging_s3_dir/ --exclude '*' --include "*.md" --acl $staging_acl --content-type text/plain
  aws s3 sync $deployment_local_dir/android $staging_s3_dir/ --exclude '*' --include "*.apk" --acl $staging_acl --content-type application/vnd.android.package-archive
  aws s3 sync $deployment_local_dir/android $staging_s3_dir/ --exclude '*' --include "*.aab" --acl $staging_acl --content-type application/x-authorware-bin

  if [ ! -z $apk_url ]; then
    echo "[deploy-android] publish as $apk_name, with version.json"

    echo "";
    if [ $buildchannel != "appstore" ]; then
      echo "[deploy-android] to refresh the release($buildchannel), you could execute:"
      echo "[deploy-android] aws s3 sync $staging_s3_dir/ $release_s3_dir/ --acl public-read"
    else
      echo "[deploy-android] open directory and upload to google play store "
    fi

    node $script_dir/notify-lark.js "$apk_url" android
  fi
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-android] force fresh CDN:"
  echo "[deploy-android] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/android*'\`"
  echo ""
fi

echo "[deploy-android] finish sync."

# WIP: .well-known
