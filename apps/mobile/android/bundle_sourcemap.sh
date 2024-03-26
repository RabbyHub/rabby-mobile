#!/bin/sh

set -e

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
android_dir=$script_dir
project_dir=$(dirname $script_dir)

. $project_dir/scripts/fns.sentry.sh --source-only

# https://docs.sentry.io/platforms/react-native/manual-setup/hermes/
# script would be also executed on ../fastlane/

sentryfn_setup;
if [[ ! -f $HERMES_BIN ]]; then
  echo "[bundle_sourcemap] Hermes compiler not found. Make sure you have hermesc installed correctly."
  exit 1
fi

if [[ $SENTRY_BUNDLE_STAGE == "bundle" ]]; then
  echo "[bundle_sourcemap::bundle] Start to bundle."

  sentryfn_build_sourcemap;
elif [[ $SENTRY_BUNDLE_STAGE == "postbundle" ]]; then
  echo "[bundle_sourcemap::postbundle] Start to output & compose sourcemap."

  sentryfn_build_sourcemap;
  sentryfn_build_hbc;
  sentryfn_compose_sourcemap;
else
  echo "[bundle_sourcemap] Unknown SENTRY_BUNDLE_STAGE: $SENTRY_BUNDLE_STAGE"
  exit 1
fi

echo "[bundle_sourcemap] Done."
