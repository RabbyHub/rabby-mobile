#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

check_s3_params;
checkout_s3_pub_deployment_params;

# prepare variables
cd $project_dir;
# TODO: read from gradle
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
android_version_code=$(grep -m1 "versionCode" ./android/app/build.gradle | xargs | cut -c 13-)
android_version_name=$(grep -m1 "versionName" $project_dir/android/app/build.gradle | cut -d'"' -f2)
cd $script_dir;

BUILD_DATE=`date '+%Y%m%d_%H%M%S'`

version_bundle_name="${android_version_name}.${android_version_code}-$BUILD_DATE"
version_bundle_suffix=""
public_release_name=""

if [ ! -z $BUILD_APP_STORE ]; then
  version_bundle_suffix=".aab"
  [ ! -z $REALLY_BUILD ] && sh $project_dir/android/build.sh buildAppStore
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/bundle/release/app-release.aab"
else
  version_bundle_suffix=".apk"
  public_release_name="rabby-mobile.apk"
  [ ! -z $REALLY_BUILD ] && sh $project_dir/android/build.sh buildApk
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/apk/release/app-release.apk"
fi

echo "version_bundle_name is $version_bundle_name"

if [ ! -f $android_export_target ]; then
  echo "'$android_export_target' is not exist, maybe you need to run build.sh first?"
  exit 1
else
  file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
  version_bundle_name="${android_version_name}.${android_version_code}-$file_date$version_bundle_suffix"
fi

# WIP: backup
echo ""
echo "[deploy-android] start sync..."

if [ ! -z $REALLY_UPLOAD ]; then
  echo "[deploy-android] backup as $version_bundle_name..."
  aws s3 cp $android_export_target $RABBY_MOBILE_PROD_BAK_DEPLOYMENT/android/$version_bundle_name --acl authenticated-read --profile debankbuild

  if [ ! -z $public_release_name ]; then
    echo "[deploy-android] publish as $public_release_name..."
    aws s3 cp $android_export_target $RABBY_MOBILE_PROD_PUB_DEPLOYMENT/android/$public_release_name --acl public-read --profile debankbuild
  fi
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-android] force fresh CDN:"
  echo "[deploy-android] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/android/*'\` --profile debankbuild"
  echo ""
fi

echo "[deploy-android] finish sync."

# WIP: upload version.json

# WIP: .well-known
