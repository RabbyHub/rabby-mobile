#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"

. "$project_dir/scripts/libs/cn-build.sh"

ensure_node_runtime() {
  if command -v nvm >/dev/null 2>&1; then
    nvm use
    return 0
  fi

  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [ -s "$nvm_dir/nvm.sh" ]; then
    # shellcheck source=/dev/null
    . "$nvm_dir/nvm.sh"
    nvm use
    return 0
  fi

  if command -v node >/dev/null 2>&1; then
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
  cn_build_prepare_node_env

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
