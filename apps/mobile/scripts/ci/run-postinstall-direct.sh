#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
mobile_dir="$(cd "$script_dir/../.." && pwd)"
repo_dir="$(cd "$mobile_dir/../.." && pwd)"
local_pages_dir="$repo_dir/apps/mobile-local-pages"

resolve_node_bin() {
  local package_dir="$1"
  local package_name="$2"
  local bin_rel_path="$3"
  local package_bin="$package_dir/node_modules/$package_name/$bin_rel_path"

  if [ -f "$package_bin" ]; then
    printf '%s\n' "$package_bin"
    return 0
  fi

  printf '%s\n' "$repo_dir/node_modules/$package_name/$bin_rel_path"
}

reuse_hashcheck_native_tools() {
  local source_repo="${RABBY_MOBILE_HASHCHECK_SOURCE_REPO:-}"

  if [ -z "$source_repo" ] || [ ! -d "$source_repo/node_modules" ]; then
    return 0
  fi

  source_repo="$(cd "$source_repo" && pwd -P)"
  if [ "$source_repo" = "$repo_dir" ]; then
    return 0
  fi

  while IFS= read -r -d '' source_path; do
    local rel_path="${source_path#"$source_repo"/}"
    local target_path="$repo_dir/$rel_path"

    if [ ! -f "$target_path" ]; then
      continue
    fi

    rm -f "$target_path"
    ln "$source_path" "$target_path" 2>/dev/null || cp -p "$source_path" "$target_path"
  done < <(
    find \
      "$source_repo/node_modules" \
      "$source_repo/apps/mobile/node_modules" \
      "$source_repo/apps/mobile-local-pages/node_modules" \
      -type f \( -name '*.node' -o -path '*/@esbuild/*/bin/esbuild' -o -name hermesc \) \
      -print0 2>/dev/null
  )
}

echo "Mobile postinstall:"

reuse_hashcheck_native_tools

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

if [ "${RABBY_MOBILE_DISABLE_OPTIONAL_NATIVE_WATCHERS:-${HASH_CHECK:-false}}" = "true" ]; then
  rm -rf "$repo_dir/node_modules/fsevents" "$local_pages_dir/node_modules/fsevents"
fi

cd "$local_pages_dir"
node ./scripts/make-theme.cjs
node "$(resolve_node_bin "$local_pages_dir" typescript bin/tsc)" -b
node "$(resolve_node_bin "$local_pages_dir" vite bin/vite.js)" build --mode android
node "$(resolve_node_bin "$local_pages_dir" vite bin/vite.js)" build --mode ios

cd "$mobile_dir"
node "$mobile_dir/node_modules/react-native-asset/lib/cli.js"
bash ./scripts/fns.sh reset_builtin_assets
bash ./scripts/fns.sh build_worker_if_not_exist
