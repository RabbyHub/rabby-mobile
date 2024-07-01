#!/bin/sh

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $(dirname $script_dir))

if [[ "$CONFIGURATION" == "Release" ]]; then
  if [ -z $RABBY_MOBILE_CODE ]; then
    echo "[RabbyMobileBuild] no RABBY_MOBILE_CODE set, abort bundle"
    exit 1;
  fi
fi

echo "[RabbyMobileBuild] process project_dir: $project_dir"

# replace AppConfig from env
AppConfigPath="$project_dir/ios/RabbyMobile/AppConfig.xcconfig"

echo "[RabbyMobileBuild] process AppConfigPath: $AppConfigPath"
# replace __PLACE_HOLDER__ or RABBY_MOBILE_CODE_DEV in AppConfigPath with ${RABBY_MOBILE_CODE}
sed -i '' "s/= RABBY_MOBILE_CODE_DEV/= ${RABBY_MOBILE_CODE}/g" $AppConfigPath
sed -i '' "s/= __PLACE_HOLDER__/= ${RABBY_MOBILE_CODE}/g" $AppConfigPath
