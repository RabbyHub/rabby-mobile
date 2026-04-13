#!/usr/bin/env bash

if [ "$(uname -s)" != "Linux" ]; then
  set -euo pipefail
fi

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")

echo "Mobile postinstall:"

if [ "${RABBY_MOBILE_SKIP_BUILD_DEPS:-0}" != "1" ]; then
  echo "0. Build workspace deps..."
  cd "$project_dir"
  yarn build:deps
else
  echo "0. Skip workspace deps build (already built by caller)"
fi

echo "1. Build inpage bridge and bundle built-in pages..."
cd "$project_dir"
yarn build-inpage
