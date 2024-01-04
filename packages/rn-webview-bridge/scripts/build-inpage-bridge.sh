#!/bin/sh

set -eo pipefail

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)
repo_dir=$(dirname $(dirname $project_dir))

[[ -z "${webpack_mode}" ]] && webpack_mode="production";

rm -f $repo_dir/apps/mobile/android/app/src/main/assets/InpageBridgeWeb3.js
mkdir -p $script_dir/inpage-bridge/dist && rm -rf $script_dir/inpage-bridge/dist/*
cd $script_dir/inpage-bridge/inpage
$repo_dir/node_modules/.bin/webpack --config webpack.config.js --mode $webpack_mode

cd $script_dir/inpage-bridge/
node $script_dir/inpage-bridge/content-script/build.js
cat dist/inpage-bundle.js content-script/index.js > dist/index-raw.js
$repo_dir/node_modules/.bin/webpack --config webpack.config.js --mode $webpack_mode

# cp $script_dir/inpage-bridge/dist/index.js $repo_dir/apps/mobile/src/core/bridges/InpageBridgeWeb3.js
cp $script_dir/inpage-bridge/dist/index.js $repo_dir/apps/mobile/android/app/src/main/assets/InpageBridgeWeb3.js
