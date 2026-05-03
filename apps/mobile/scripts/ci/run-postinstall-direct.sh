#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
mobile_dir="$(cd "$script_dir/../.." && pwd)"
repo_dir="$(cd "$mobile_dir/../.." && pwd)"
local_pages_dir="$repo_dir/apps/mobile-local-pages"

echo "Mobile postinstall:"

if [ "${RABBY_MOBILE_SKIP_BUILD_DEPS:-0}" != "1" ]; then
  echo "0. Build workspace deps..."
  cd "$repo_dir"
  node "$repo_dir/node_modules/typescript/bin/tsc" --build tsconfig.build.json --verbose
else
  echo "0. Skip workspace deps build (already built by caller)"
fi

if [ "${RABBY_MOBILE_BUILD_DEVTOOLS_PANEL:-0}" = "1" ]; then
  echo "0.5 Build Rozenite devtools panel..."
  cd "$repo_dir"
  yarn workspace @rabby-wallet/rozenite-resource-flow-plugin build
else
  echo "0.5 Skip Rozenite devtools panel build"
fi

echo "1. Build inpage bridge and bundle built-in pages..."
bash "$repo_dir/packages/rn-webview-bridge/scripts/build-inpage-bridge.sh"

cd "$local_pages_dir"
node ./scripts/make-theme.cjs
node "$repo_dir/node_modules/typescript/bin/tsc" -b
node "$repo_dir/node_modules/vite/bin/vite.js" build --mode android
node "$repo_dir/node_modules/vite/bin/vite.js" build --mode ios

cd "$mobile_dir"
node "$mobile_dir/node_modules/react-native-asset/lib/cli.js"
bash ./scripts/fns.sh reset_builtin_assets
bash ./scripts/fns.sh build_worker_if_not_exist
