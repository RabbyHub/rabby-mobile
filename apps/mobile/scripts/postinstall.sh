#!/usr/bin/env sh


OS_TYPE=$(uname -s);
# not set on Linx
if [ "$OS_TYPE" != "Linux" ]; then
  set -euo pipefail
fi


script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")
# repo_dir=$project_dir
repo_dir=$(dirname $(dirname "$project_dir"))

echo "PostInstall script:"

echo "1. Build Inpage Bridge..."
cd $repo_dir/packages/rn-webview-bridge
./scripts/build-inpage-bridge.sh

cd $repo_dir/apps/mobile;
echo "2. Patch npm packages"
yarn patch-package
