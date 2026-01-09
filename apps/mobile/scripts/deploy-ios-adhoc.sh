#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

export buildchannel="selfhost-reg";
export BUILD_TARGET_PLATFORM="ios";
check_build_params;
check_s3_params;
checkout_s3_pub_deployment_params;

# make plist file
cd $project_dir;
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
cd $script_dir;

ouput_dir=$project_dir/ios/Package/adhoc
deployment_local_dir="$script_dir/deployments/ios-adhoc"

rm -rf $deployment_local_dir && mkdir -p $deployment_local_dir;

mkdir -p "$script_dir/deployments/tmp"

xcodebuild -project $project_dir/ios/RabbyMobile.xcodeproj -target "RabbyMobile" -showBuildSettings -json | plutil -convert xml1 - -o $script_dir/deployments/tmp/RabbyMobileAdHoc.plist

ios_version_name=$(/usr/libexec/PlistBuddy -c "Print:CFBundleShortVersionString" $project_dir/ios/RabbyMobile/Info.plist)
ios_version_code=$(/usr/libexec/PlistBuddy -c "Print:0:buildSettings:CURRENT_PROJECT_VERSION" $script_dir/deployments/tmp/RabbyMobileAdHoc.plist)
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
    echo "[deploy-ios-adhoc] found changelog: $changelog"
    cp $changelog $deployment_local_dir/$proj_version.md
    break
  fi
done
# ============ prepare changelogs :end ============== #

build_adhoc() {
  export RABBY_MOBILE_BUILD_ENV="regression";
  cd $project_dir;
  sh ./ios/patches/override-xcconfig-release.sh;
  [ -z "$CI" ] && yarn;
  yarn check-nodeengines && yarn ../mobile-local-pages bundle:all && yarn link-assets && yarn buildworker:prod:ios;
  yarn syncrnversion;
  cd $project_dir/ios;
  bundle install && bundle exec pod install --repo-update;
  cd $project_dir;
  bundle exec fastlane ios adhoc;
}

[ $GHA_MOCK_BUILD_FAILED == "true" ] && SKIP_BUILD=true

if [[ -z $SKIP_BUILD || ! -f $ouput_dir/RabbyMobile.ipa ]]; then
  echo "[deploy-ios-adhoc] start build..."
  build_adhoc;
  echo "[deploy-ios-adhoc] finish build."
fi

if [[ ! -f $ouput_dir/RabbyMobile.ipa || $GHA_MOCK_BUILD_FAILED == "true" ]]; then
  echo "[deploy-ios-adhoc] ⚠️ build failed! No $ouput_dir/RabbyMobile.ipa found";
  node $script_dir/notify-lark.js "FAILED" ios
  exit 1;
fi

file_date=$(date -r $ouput_dir/RabbyMobile.ipa '+%Y%m%d_%H%M%S')
version_bundle_name="${ios_version_name}.${ios_version_code}-$file_date"
deployment_s3_dir=$S3_IOS_PUB_DEPLOYMENT/ios-$version_bundle_name
deployment_cdn_baseurl=$cdn_deployment_urlbase/ios-$version_bundle_name
manifest_plist_url="itms-services://?action=download-manifest&url=$deployment_cdn_baseurl/manifest.plist"

cp $ouput_dir/RabbyMobile.ipa $deployment_local_dir/rabbymobile.ipa
cp $ouput_dir/manifest.plist $deployment_local_dir/manifest.plist

/usr/libexec/PlistBuddy -c "Set:items:0:metadata:title Rabby Wallet" $deployment_local_dir/manifest.plist
/usr/libexec/PlistBuddy -c "Set:items:0:assets:0:url $deployment_cdn_baseurl/rabbymobile.ipa" $deployment_local_dir/manifest.plist # appURL
/usr/libexec/PlistBuddy -c "Set:items:0:assets:1:url $deployment_cdn_baseurl/icon_57x57@57w.png" $deployment_local_dir/manifest.plist # displayImageURL
/usr/libexec/PlistBuddy -c "Set:items:0:assets:2:url $deployment_cdn_baseurl/icon_512x512@512w.png" $deployment_local_dir/manifest.plist # fullSizeImageURL

echo "[deploy-ios-adhoc] will upload to $deployment_s3_dir"
echo "[deploy-ios-adhoc] will be served at $deployment_cdn_baseurl"

echo ""

if [ "$REALLY_UPLOAD" == "true" ]; then
  [ "$DISABLE_AWS_CLI_HTTPS_VALIDATION" == "true" ] && NO_VERIFY_SSL_FLAG="--no-verify-ssl"
  echo "[deploy-ios-adhoc] start sync to $deployment_s3_dir..."
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.ipa" --acl public-read --content-type application/octet-stream --exact-timestamps
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.plist" --acl public-read --content-type application/x-plist --exact-timestamps
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.png" --acl public-read --content-type image/png --exact-timestamps
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.json" --acl public-read --content-type application/json --exact-timestamps
  aws s3 sync $NO_VERIFY_SSL_FLAG $deployment_local_dir $deployment_s3_dir/ --exclude '*' --include "*.md" --acl public-read --content-type text/plain --exact-timestamps

  node $script_dir/notify-lark.js "$manifest_plist_url" ios
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-ios-adhoc] force fresh CDN:"
  echo "[deploy-ios-adhoc] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/ios/*'\`"
  echo ""
fi

echo "[deploy-ios-adhoc] finish sync."

