#!/bin/bash

set -e

# . ./patches/patch-env.sh --source-only

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $(dirname $script_dir))

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
  [ -z $RABBY_MOBILE_BUILD_ENV ] && export RABBY_MOBILE_BUILD_ENV="production"
  [ -z $buildchannel ] && export buildchannel="appstore"
  if [ -z $RABBY_MOBILE_CODE ]; then
    echo "[RabbyMobileBuild] no RABBY_MOBILE_CODE set, abort bundle"
    exit 1;
  fi
fi
echo "[RabbyMobileBuild] buildchannel is $buildchannel"

check_env_file() {
  env_file="$project_dir/.env.production"
  if [ "$CONFIGURATION" != "Release" ]; then
    env_file="$project_dir/.env.local"
  fi

  if [ -z $RABBY_MOBILE_SAFE_API_KEY ] && [ ! -z $MOBILE_SAFE_API_KEY ]; then
    export RABBY_MOBILE_SAFE_API_KEY=$MOBILE_SAFE_API_KEY
  fi

  local sysenv_apiKey=$RABBY_MOBILE_SAFE_API_KEY
  local env_apiKey=""
  local sysenv_krPwd=$RABBY_MOBILE_KR_PWD
  local env_krPwd=""

  if [ -f "$env_file" ]; then
    while IFS='=' read -r key value || [ -n "$key" ]; do
      key_cleaned=$(echo "$key" | sed 's/#.*//' | awk '{$1=$1};1')
      if [ -z "$key_cleaned" ]; then continue; fi
      value_cleaned=$(echo "$value" | sed 's/#.*//' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e "s/^'//" -e "s/'$//" -e 's/^"//' -e 's/"$//')
      if [ "$key_cleaned" == "RABBY_MOBILE_SAFE_API_KEY" ]; then
        env_apiKey="$value_cleaned"
      elif [ "$key_cleaned" == "RABBY_MOBILE_KR_PWD" ]; then
        env_krPwd="$value_cleaned"
      fi
    done < <(grep -v '^[[:space:]]*#' "$env_file" | grep -v '^[[:space:]]*$')

    if [ -z "$env_apiKey" ]; then
      echo "[RabbyMobileBuild] no RABBY_MOBILE_SAFE_API_KEY in env file $env_file, abort bundle"
      exit 1
    elif [ -z "$env_krPwd" ]; then
      echo "[RabbyMobileBuild] no RABBY_MOBILE_KR_PWD in env file $env_file, abort bundle"
      exit 1
    fi
  else
    if [ -z "$sysenv_apiKey" ]; then
      echo "[RabbyMobileBuild] no RABBY_MOBILE_SAFE_API_KEY in system env, abort bundle"
      exit 1
    fi
    if [ -z "$sysenv_krPwd" ]; then
      echo "[RabbyMobileBuild] no RABBY_MOBILE_KR_PWD in system env, abort bundle"
      exit 1
    fi
    echo "RABBY_MOBILE_SAFE_API_KEY=$sysenv_apiKey" >> $env_file
    echo "RABBY_MOBILE_KR_PWD=$sysenv_krPwd" >> $env_file
    echo "[RabbyMobileBuild] no env file $env_file found, have written to it"
  fi
}

check_env_file;

[ -f yarn ] && yarn install;
[ ! -z $DO_POD_INSTALL ] && bundle install && bundle exec pod install;
echo "[RabbyMobileBuild] customize build environment vars finished."

/bin/sh -c "$WITH_ENVIRONMENT \"$BUNDLE_REACT_NATIVE\""

echo "[RabbyMobileBuild] finish bundle with sentry build."
