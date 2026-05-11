#!/usr/bin/env bash

if [ "$(uname -s)" != "Linux" ]; then
  set -euo pipefail
fi

script_dir="$( cd "$( dirname "$0"  )" && pwd  )"
project_dir=$(dirname "$script_dir")
# repo_dir=$project_dir
repo_dir=$(dirname $(dirname "$project_dir"))
lock_dir="$project_dir/.build-inpage.lock"
lock_pid_file="$lock_dir/pid"
acquired_lock=0

cleanup_lock() {
  if [ "${acquired_lock:-0}" = "1" ] && [ -d "$lock_dir" ]; then
    rm -f "$lock_pid_file"
    rmdir "$lock_dir" 2>/dev/null || rm -rf "$lock_dir"
  fi
}

acquire_lock() {
  waited_seconds=0

  while ! mkdir "$lock_dir" 2>/dev/null; do
    if [ -f "$lock_pid_file" ]; then
      lock_holder_pid=$(cat "$lock_pid_file" 2>/dev/null || true)
      if [ -n "$lock_holder_pid" ] && ! kill -0 "$lock_holder_pid" 2>/dev/null; then
        rm -rf "$lock_dir"
        continue
      fi
    fi

    if [ "$waited_seconds" -eq 0 ]; then
      echo "Another build-inpage task is running, waiting for lock..."
    fi

    waited_seconds=$((waited_seconds + 1))
    if [ "$waited_seconds" -ge 600 ]; then
      echo "Timed out waiting for build-inpage lock: $lock_dir" >&2
      exit 1
    fi

    sleep 1
  done

  acquired_lock=1
  echo "$$" > "$lock_pid_file"
}

trap cleanup_lock EXIT INT TERM

. $script_dir/fns.sh --source-only

echo "PostInstall script:"

acquire_lock

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
