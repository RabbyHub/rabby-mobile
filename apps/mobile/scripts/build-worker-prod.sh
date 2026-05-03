#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

resolve_node_bin() {
  if [[ -n "${RABBY_MOBILE_NODE_BINARY:-}" && -x "$RABBY_MOBILE_NODE_BINARY" ]]; then
    printf '%s\n' "$RABBY_MOBILE_NODE_BINARY"
    return 0
  fi

  if [[ -n "${npm_node_execpath:-}" && -f "$npm_node_execpath" ]]; then
    local parsed_node
    parsed_node="$(sed -n 's/^exec "\([^"]*\)".*/\1/p' "$npm_node_execpath" | head -n 1)"
    if [[ -n "$parsed_node" && -x "$parsed_node" ]]; then
      printf '%s\n' "$parsed_node"
      return 0
    fi
  fi

  local path_node
  path_node="$(command -v node || true)"
  if [[ -n "$path_node" && -x "$path_node" ]]; then
    printf '%s\n' "$path_node"
    return 0
  fi

  echo "Unable to find a usable node binary" >&2
  return 1
}

case "$platform" in
  android)
    assets_dest="./android/app/src/main/res/"
    bundle_output="./android/app/src/main/assets/threads/worker.thread.bundle"
    ;;
  ios)
    assets_dest="./ios"
    bundle_output="./assets/ios/threads/worker.thread.jsbundle"
    ;;
  *)
    echo "Usage: $0 <android|ios>" >&2
    exit 1
    ;;
esac

cd "$project_dir"
mkdir -p "$(dirname "$bundle_output")"

node_bin="$(resolve_node_bin)"
"$node_bin" ./node_modules/react-native/cli.js bundle \
  --dev false \
  --assets-dest "$assets_dest" \
  --entry-file worker-src/worker.thread.ts \
  --platform "$platform" \
  --bundle-output "$bundle_output"
