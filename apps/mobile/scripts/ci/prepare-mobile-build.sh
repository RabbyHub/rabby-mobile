#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"

ensure_node_runtime() {
  local requested_node_version="${RABBY_MOBILE_NODE_VERSION:-}"

  if command -v nvm >/dev/null 2>&1; then
    if [ -n "$requested_node_version" ]; then
      nvm use "$requested_node_version" || nvm install "$requested_node_version"
      nvm use "$requested_node_version"
    else
      nvm use
    fi
    return 0
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    if [ -n "$requested_node_version" ]; then
      nvm use "$requested_node_version" || nvm install "$requested_node_version"
      nvm use "$requested_node_version"
    else
      nvm use
    fi
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
    if [ -n "$requested_node_version" ]; then
      local current_node_version
      current_node_version="$(node -v | sed 's/^v//')"
      if [ "$current_node_version" != "$requested_node_version" ]; then
        echo "[prepare-mobile-build] requested node $requested_node_version but current node is $current_node_version and nvm is unavailable" >&2
        return 1
      fi
    fi
    echo "[prepare-mobile-build] nvm not found, keep current node $(node -v)"
    return 0
  fi

  echo "[prepare-mobile-build] node runtime is unavailable" >&2
  return 1
}

read_ios_short_version() {
  python3 - <<'PY'
import plistlib
from pathlib import Path

with open(Path("ios/RabbyMobile/Info.plist"), "rb") as f:
    plist = plistlib.load(f)

print(plist["CFBundleShortVersionString"])
PY
}

apply_requested_version() {
  local requested_version="$1"

  echo "[prepare-mobile-build] apply requested app version: $requested_version"
  node --eval '
    const fs = require("fs");
    const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
    pkg.version = process.env.REQUESTED_VERSION;
    fs.writeFileSync("package.json", `${JSON.stringify(pkg, null, 2)}\n`);
  '

  yarn syncrnversion

  local package_version
  package_version="$(node --eval 'process.stdout.write(require("./package.json").version)')"
  local ios_short_version
  ios_short_version="$(read_ios_short_version)"

  echo "[prepare-mobile-build] package.json version: $package_version"
  echo "[prepare-mobile-build] ios short version: $ios_short_version"

  if [ "$ios_short_version" != "$package_version" ]; then
    echo "[prepare-mobile-build] version sync failed: package.json=$package_version ios=$ios_short_version" >&2
    return 1
  fi
}

main() {
  cd "$project_dir"
  ensure_node_runtime

  echo "[prepare-mobile-build] node: $(node -v)"
  echo "[prepare-mobile-build] yarn: $(yarn --version)"
  yarn install --immutable

  local requested_version="${INPUT_NEW_VERSION_NAME:-}"
  if [ -n "$requested_version" ]; then
    REQUESTED_VERSION="$requested_version" apply_requested_version "$requested_version"
  fi

  if [ "${RABBY_MOBILE_RUN_POSTINSTALL:-false}" = "true" ]; then
    echo "[prepare-mobile-build] run explicit postinstall"
    yarn postinstall
  fi
}

main "$@"
