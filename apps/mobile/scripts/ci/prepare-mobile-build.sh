#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
repo_root="$(cd "$project_dir/../.." && pwd)"

google_signin_architecture=""
google_signin_source_paths=()

resolve_google_signin_sources() {
  google_signin_architecture="$(node "$project_dir/scripts/react-native-architecture.cjs")"
  case "$google_signin_architecture" in
    legacy)
      google_signin_source_paths=(
        "android/src/oldArch/java/com.reactnativegooglesignin/NativeGoogleSigninSpec.java"
        "android/src/oldArch/java/com.reactnativegooglesignin/RNGoogleSigninButtonManagerDelegate.java"
        "android/src/oldArch/java/com.reactnativegooglesignin/RNGoogleSigninButtonManagerInterface.java"
        "android/src/oldArch/java/com.reactnativegooglesignin/RNGoogleSigninButtonManagerInterfaceCopy.java"
      )
      ;;
    new)
      # These are shipped sources, not generated Java. Codegen can only rebuild
      # NativeGoogleSigninSpec when its input specs survive the runner cache.
      google_signin_source_paths=(
        "android/src/newArch/java/com/reactnativegooglesignin/RNGoogleSigninButtonManagerDelegate.java"
        "android/src/newArch/java/com/reactnativegooglesignin/RNGoogleSigninButtonManagerInterface.java"
        "src/spec/NativeGoogleSignin.ts"
        "src/spec/SignInButtonNativeComponent.ts"
      )
      ;;
    *)
      echo "[prepare-mobile-build] unsupported React Native architecture: $google_signin_architecture" >&2
      return 1
      ;;
  esac
  echo "[prepare-mobile-build] React Native architecture: $google_signin_architecture"
}

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

repair_cached_google_signin_sources() {
  local package_dir source_path

  if [ ! -d "$project_dir/node_modules" ]; then
    return 0
  fi

  package_dir="$project_dir/node_modules/@react-native-google-signin/google-signin"
  for source_path in "${google_signin_source_paths[@]}"; do
    if [ ! -f "$package_dir/$source_path" ]; then
      echo "[prepare-mobile-build] cached Google Sign-In $google_signin_architecture source is missing: $source_path; refresh only this package and its Yarn install state"
      rm -rf "$package_dir"
      rm -f "$repo_root/.yarn/install-state.gz"
      return 0
    fi
  done
}

verify_google_signin_sources() {
  local package_dir source_path

  package_dir="$project_dir/node_modules/@react-native-google-signin/google-signin"
  for source_path in "${google_signin_source_paths[@]}"; do
    if [ ! -f "$package_dir/$source_path" ]; then
      echo "[prepare-mobile-build] Google Sign-In $google_signin_architecture source is unavailable after yarn install: $source_path" >&2
      return 1
    fi
  done
  echo "[prepare-mobile-build] Google Sign-In $google_signin_architecture sources verified"
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
  resolve_google_signin_sources
  repair_cached_google_signin_sources
  yarn install --immutable
  verify_google_signin_sources

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
