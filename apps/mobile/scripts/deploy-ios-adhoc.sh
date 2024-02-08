#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

export buildchannel="selfhost-reg";
export targetplatform="ios";
check_s3_params;
checkout_s3_pub_deployment_params;

# make plist file
cd $project_dir;
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
app_display_name=$(node --eval="process.stdout.write(require('./app.json').displayName)");
cd $script_dir;

unix_replace_variables $script_dir/tpl/ios/manifest.plist $script_dir/deployments/ios/manifest.plist \
  --var-IPA_DOWNLOAD_URL="$cdn_deployment_urlbase/ios/rabbymobile.ipa" \
  --var-URL_DISPLAY_IMAGE="$cdn_deployment_urlbase/ios/icon_57x57@57w.png" \
  --var-URL_FULL_SIZE_IMAGE="$cdn_deployment_urlbase/ios/icon_512x512@512w.png" \
  --var-APP_VERSION="$proj_version" \
  --var-APP_DISPLAY_NAME="$app_display_name"

unix_replace_variables $script_dir/tpl/ios/version.json $script_dir/deployments/ios/version.json \
  --var-DOWNLOAD_URL=$cdn_deployment_urlbase/ios/ \
  --var-APP_VER_CODE=100 \
  --var-APP_VER="$proj_version"

if [ ! -z $REALLY_BUILD ]; then
  BUILD_DATE=`date '+%Y%m%d_%H%M%S'`
  export build_export_path="$script_dir/deployments/ios"

  sh $project_dir/ios/build.sh ad-hoc

  rm -rf $export_path
fi

echo ""
if [ ! -z $REALLY_UPLOAD ]; then
  if [ ! -z $ipa_name ]; then
    echo "[deploy-ios-adhoc] backup..."
    aws s3 cp $export_ipa_path/$ipa_name.ipa $IOS_BAK_DEPLOYMENT/$ipa_name.ipa --acl public-read --profile debankbuild
  fi

  echo "[deploy-ios-adhoc] start sync..."
  aws s3 sync $script_dir/deployments/ios $IOS_PUB_DEPLOYMENT/ios/ --exclude '*' --include "*.plist" --acl public-read --profile debankbuild --content-type application/x-plist
  aws s3 sync $script_dir/deployments/ios $IOS_PUB_DEPLOYMENT/ios/ --exclude '*' --include "*.png" --acl public-read --profile debankbuild --content-type image/png
  aws s3 sync $script_dir/deployments/ios $IOS_PUB_DEPLOYMENT/ios/ --exclude '*' --include "*.json" --acl public-read --profile debankbuild --content-type application/json
  aws s3 sync $script_dir/deployments/ios $IOS_PUB_DEPLOYMENT/ios/ --exclude '*' --include "*.ipa" --acl public-read --profile debankbuild --content-type application/octet-stream
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-ios-adhoc] force fresh CDN:"
  echo "[deploy-ios-adhoc] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/ios/*'\` --profile debankbuild"
  echo ""
fi

echo "[deploy-ios-adhoc] finish sync."

