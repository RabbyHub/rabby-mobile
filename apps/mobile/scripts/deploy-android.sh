#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

export targetplatform="android";
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
android_deployments_dir="$script_dir/deployments/android"

rm -rf $android_deployments_dir && mkdir -p $android_deployments_dir;

# preapre version.json
replace_variables $script_dir/tpl/android/version.json $android_deployments_dir/version.json \
  --var-APP_VER_CODE=$android_version_code \
  --var-APP_VER="$android_version_name"

echo "[deploy-android] start build..."
if [ $buildchannel == "appstore" ]; then
  version_bundle_suffix=".aab"
  [ ! -z $REALLY_BUILD ] && sh $project_dir/android/build.sh buildAppStore
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/bundle/release/app-release.aab"
else
  version_bundle_suffix=".apk"
  public_release_name="rabby-mobile.apk"
  [ ! -z $REALLY_BUILD ] && sh $project_dir/android/build.sh buildApk
  [ -z $android_export_target ] && android_export_target="$project_dir/android/app/build/outputs/apk/release/app-release.apk"
fi

cp $android_export_target $android_deployments_dir/$public_release_name
echo "[deploy-android] finish build."

possible_changelogs=(
  "$project_dir/src/changeLogs/$android_version_name.md"
  "$project_dir/src/changeLogs/$android_version_name.$android_version_code.md"
)

for changelog in "${possible_changelogs[@]}"; do
  if [ -f $changelog ]; then
    echo "[deploy-android] found changelog: $changelog"
    cp $changelog $android_deployments_dir/
    break
  fi
done

if [ ! -f $android_export_target ]; then
  echo "'$android_export_target' is not exist, maybe you need to run build.sh first?"
  exit 1
else
  file_date=$(date -r $android_export_target '+%Y%m%d_%H%M%S')
  version_bundle_name="${android_version_name}.${android_version_code}-$file_date$version_bundle_suffix"
fi

echo ""
echo "[deploy-android] start sync..."

if [ ! -z $REALLY_UPLOAD ]; then
  echo "[deploy-android] backup as $version_bundle_name..."
  aws s3 cp $android_export_target $ANDROID_BAK_DEPLOYMENT/android/$version_bundle_name --acl authenticated-read --profile debankbuild

  # targets:
  # - https://download.rabby.io/downloads/wallet-mobile/android/version.json
  # - https://download.rabby.io/downloads/wallet-mobile/android/rabby-mobile.apk
  if [ ! -z $public_release_name ]; then
    echo "[deploy-android] publish as $public_release_name, with version.json"
    aws s3 sync $android_deployments_dir $ANDROID_PUB_DEPLOYMENT/android/ --exclude '*' --include "*.json" --acl public-read --profile debankbuild --content-type application/json
    aws s3 sync $android_deployments_dir $ANDROID_PUB_DEPLOYMENT/android/ --exclude '*' --include "*.md" --acl public-read --profile debankbuild --content-type text/plain
    aws s3 sync $android_deployments_dir $ANDROID_PUB_DEPLOYMENT/android/ --exclude '*' --include "*.apk" --acl public-read --profile debankbuild --content-type application/vnd.android.package-archive
  fi
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-android] force fresh CDN:"
  echo "[deploy-android] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/android/*'\` --profile debankbuild"
  echo ""
fi

echo "[deploy-android] finish sync."

# WIP: .well-known
