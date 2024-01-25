#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)

. $script_dir/fns.sh --source-only

check_s3_params;
checkout_s3_pub_deployment_params;

# make plist file
cd $project_dir;
proj_version=$(node --eval="process.stdout.write(require('./package.json').version)");
cd $script_dir;

replace_variables $script_dir/tpl/ios/manifest.plist $script_dir/deployments/ios/manifest.plist \
  --var-IPA_DOWNLOAD_URL="$cdn_deployment_urlbase/ios/rabbymobile.ipa" \
  --var-URL_DISPLAY_IMAGE="$cdn_deployment_urlbase/ios/icon_57x57@57w.png" \
  --var-URL_FULL_SIZE_IMAGE="$cdn_deployment_urlbase/ios/icon_512x512@512w.png" \
  --var-APP_VERSION="$proj_version"

replace_variables $script_dir/tpl/ios/version.json $script_dir/deployments/ios/version.json \
  --var-DOWNLOAD_URL=$cdn_deployment_urlbase/ios/ \
  --var-APP_VER_CDOE=100 \
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
    echo "[deploy-ios-reg] backup..."
    aws s3 cp $export_ipa_path/$ipa_name.ipa $RABBY_MOBILE_BAK_DEPLOYMENT/$ipa_name.ipa --acl public-read --profile debankbuild
  fi

  echo "[deploy-ios-reg] start sync..."
  aws s3 sync $script_dir/deployments/ios $RABBY_MOBILE_PUB_DEPLOYMENT/ios --acl public-read --profile debankbuild
fi

[ -z $RABBY_MOBILE_CDN_FRONTEND_ID ] && RABBY_MOBILE_CDN_FRONTEND_ID="<DIST_ID>"

if [ -z $CI ]; then
  echo "[deploy-ios-reg] force fresh CDN:"
  echo "[deploy-ios-reg] \`aws cloudfront create-invalidation --distribution-id $RABBY_MOBILE_CDN_FRONTEND_ID --paths '/$s3_upload_prefix/ios/*'\` --profile debankbuild"
  echo ""
fi

echo "[deploy-ios-reg] finish sync."

