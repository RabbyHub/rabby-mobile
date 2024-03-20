#!/bin/sh

set -e

# . ./patches/patch-env.sh --source-only

WITH_ENVIRONMENT="../node_modules/react-native/scripts/xcode/with-environment.sh"
REACT_NATIVE_XCODE="../node_modules/react-native/scripts/react-native-xcode.sh"
SENTRY_XCODE="../node_modules/@sentry/react-native/scripts/sentry-xcode.sh"
BUNDLE_REACT_NATIVE="/bin/sh $SENTRY_XCODE $REACT_NATIVE_XCODE"

# you can also run `sudo ln -s $(which node) /usr/local/bin/node` on macOS
export NODE_BINARY=$(command -v node);
echo "[RabbyMobileBuild] NODE_BINARY is $NODE_BINARY"

# if [ -z $SENTRY_AUTH_TOKEN ]; then
#    echo "[RabbyMobileBuild] no SENTRY_AUTH_TOKEN set, abort bundle"
#    exit 1;
# fi

echo "[RabbyMobileBuild] customize build environment vars"
echo "[RabbyMobileBuild] CONFIGURATION is $CONFIGURATION"
if [[ "$CONFIGURATION" == "Release" ]]; then
    [ -z $BUILD_ENV ] && export BUILD_ENV="production"
    [ -z $buildchannel ] && export buildchannel="appstore"
fi
echo "[RabbyMobileBuild] buildchannel is $buildchannel"

[ -f yarn ] && yarn install;
[ ! -z $DO_POD_INSTALL ] && bundle install && bundle exec pod install;
echo "[RabbyMobileBuild] customize build environment vars finished."

/bin/sh -c "$WITH_ENVIRONMENT \"$BUNDLE_REACT_NATIVE\""

echo "[RabbyMobileBuild] finish bundle with sentry build."
