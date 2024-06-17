#!/bin/bash

if [ "$(uname -s)" != "Linux" ]; then
  set -euo pipefail
fi

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname $script_dir)
repo_dir=$(dirname $(dirname $project_dir))

[[ -z "${webpack_mode-}" ]] && webpack_mode="production";

inpage_files_targets=(
  # for iOS
  "$repo_dir/apps/mobile/src/core/bridges"
  # for Android
  "$repo_dir/apps/mobile/android/app/src/main/assets/custom"
)
# remove all inpage_files_targets
for dir in "${inpage_files_targets[@]}"
do
  rm -f $dir/InpageBridgeWeb3.js
  rm -f $dir/vconsole.min.js
done

mkdir -p $script_dir/inpage-bridge/dist && rm -rf $script_dir/inpage-bridge/dist/*
cd $script_dir/inpage-bridge/inpage
$repo_dir/node_modules/.bin/webpack --config webpack.config.js --mode $webpack_mode

cd $script_dir/inpage-bridge/
node $script_dir/inpage-bridge/content-script/build.js
cat dist/inpage-bundle.js content-script/index.js > dist/index-raw.js
$repo_dir/node_modules/.bin/webpack --config webpack.config.js --mode $webpack_mode

# copy dist to targets
cp $script_dir/inpage-bridge/dist/index.js $repo_dir/apps/mobile/assets/custom/InpageBridgeWeb3.js

for dir in "${inpage_files_targets[@]}"
do
  mkdir -p $dir
  cp $script_dir/inpage-bridge/dist/index.js $dir/InpageBridgeWeb3.js
  cp $repo_dir/apps/mobile/assets/custom/vconsole.min.js $dir/vconsole.min.js
done
