#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

export buildchannel="appstore";
export BUILD_TARGET_PLATFORM="ios";
check_build_params;
check_s3_params;
checkout_s3_pub_deployment_params;

# make plist file
cd $project_dir;
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
cd $script_dir;

ouput_dir=$project_dir/ios/Package/appstore
deployment_local_dir="$script_dir/deployments/ios-appstore"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;

mkdir -p "$script_dir/deployments/tmp"

xcodebuild -project $project_dir/ios/RabbyMobile.xcodeproj -target "RabbyMobile" -showBuildSettings -json | plutil -convert xml1 - -o "$script_dir/deployments/tmp/RabbyMobileAppStore.plist"

ios_version_name=$(/usr/libexec/PlistBuddy -c "Print:CFBundleShortVersionString" $project_dir/ios/RabbyMobile/Info.plist)
ios_version_code=$(/usr/libexec/PlistBuddy -c "Print:0:buildSettings:CURRENT_PROJECT_VERSION" $script_dir/deployments/tmp/RabbyMobileAppStore.plist)
cd $project_dir/ios;

unix_replace_variables $script_dir/tpl/ios/version.json $deployment_local_dir/version.json \
  --var-DOWNLOAD_URL=$cdn_deployment_urlbase/ios/ \
  --var-APP_VER_CODE=$ios_version_code \
  --var-APP_VER="$proj_version"

# ============ prepare changelogs :start ============== #
possible_changelogs=(
  "$project_dir/src/changeLogs/$proj_version.ios.md"
  "$project_dir/src/changeLogs/$proj_version.md"
)

for changelog in "${possible_changelogs[@]}"; do
  if [ -f $changelog ]; then
    echo "[deploy-ios-appstore] found changelog: $changelog"
    cp $changelog $deployment_local_dir/$proj_version.md
    break
  fi
done
# ============ prepare changelogs :end ============== #

build_appstore() {
  export RABBY_MOBILE_BUILD_ENV="production";
  cd $project_dir;
  sh ./ios/patches/override-xcconfig-release.sh;
  yarn;
  yarn check-nodeengines && yarn ../mobile-local-pages bundle:all && yarn link-assets && yarn buildworker:prod:ios;
  yarn syncrnversion;
  cd $project_dir/ios;
  bundle install;
  [ ! -z $CI ] && bundle exec pod cache clean --all;
  bundle exec pod install --repo-update;
  cd $project_dir;
  bundle exec fastlane ios appstore;
}

if [[ -z $SKIP_BUILD || ! -f $ouput_dir/RabbyMobile.ipa ]]; then
  echo "[deploy-ios-appstore] start build..."
  build_appstore;
  echo "[deploy-ios-appstore] finish build."
fi

file_date=$(date -r $ouput_dir/RabbyMobile.ipa '+%Y%m%d_%H%M%S')
version_bundle_name="${ios_version_name}.${ios_version_code}-$file_date"
deployment_s3_dir=$S3_IOS_PUB_DEPLOYMENT/ios-$version_bundle_name
deployment_cdn_baseurl=$cdn_deployment_urlbase/ios-$version_bundle_name
manifest_plist_url="itms-services://?action=download-manifest&url=$deployment_cdn_baseurl/manifest.plist"

staging_dirname=ios-$version_bundle_name$staging_dir_suffix
backup_s3_dir=$S3_IOS_BAK_DEPLOYMENT/$staging_dirname

release_s3_dir=$S3_IOS_PUB_DEPLOYMENT/ios
release_cdn_baseurl=$cdn_deployment_urlbase/ios

echo ""

if [ "$REALLY_UPLOAD" == "true" ]; then
  echo "[deploy-ios-appstore] will be backup at $backup_s3_dir (not public)"
  # aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.json" --acl authenticated-read --content-type application/json --exact-timestamps
  aws s3 sync $deployment_local_dir $backup_s3_dir/ --exclude '*' --include "*.md" --acl authenticated-read --content-type text/plain --exact-timestamps
  aws s3 sync $backup_s3_dir/ $release_s3_dir/ --exclude '*' --include "*.md" --acl public-read --content-type text/plain --exact-timestamps

  # echo ""
  # echo "[deploy-ios-appstore] to refresh changelog, you could execute:"
  # echo "[deploy-ios-appstore] aws s3 sync $backup_s3_dir/ $release_s3_dir/ --exclude '*' --include \"*.md\" --acl public-read"
  echo ""
  echo "[deploy-ios-appstore] after sync, will public at $release_s3_dir, served as $release_cdn_baseurl"
  echo ""
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-ios-appstore] force fresh CDN:"
  echo "[deploy-ios-appstore] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/ios/*'\`"
  echo ""
fi

echo "[deploy-ios-appstore] finish sync."
