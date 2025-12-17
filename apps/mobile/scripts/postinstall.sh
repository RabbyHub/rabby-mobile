#!/usr/bin/env bash

if [ "$(uname -s)" != "Linux" ]; then
  set -euo pipefail
fi

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")
# repo_dir=$project_dir
repo_dir=$(dirname $(dirname "$project_dir"))

. $script_dir/fns.sh --source-only

echo "PostInstall script:"

echo "1. Build Inpage Bridge..."
cd $repo_dir/packages/rn-webview-bridge
./scripts/build-inpage-bridge.sh

echo "2. Link & Copy Assets..."
cd $repo_dir/apps/mobile;
yarn ../mobile-local-pages bundle:all && yarn link-assets;

# cd $repo_dir/apps/mobile;
# echo "3. Patch npm packages"
# if [ -z "${CI:-}" ]; then
#   yarn apply-patch
# else
#   # allow failed
#   yarn apply-patch || true
# fi

