#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
output_path="${1:-$project_dir/.sign-only/app-signonly-unsigned.apk}"

mkdir -p "$(dirname "$output_path")"
cd "$project_dir"

export RABBY_MOBILE_BUILD_ENV="${RABBY_MOBILE_BUILD_ENV:-regression}"
echo "[sign-only] building unsigned Android APK (assembleSignonly)..."
./android/gradlew -p ./android assembleSignonly --no-daemon -Porg.gradle.parallel=true

apk_path="$(find "$project_dir/android/app/build/outputs/apk/signonly" -type f -name '*.apk' | head -n 1)"
if [ -z "$apk_path" ] || [ ! -f "$apk_path" ]; then
  echo "[sign-only] unsigned APK not found under android/app/build/outputs/apk/signonly" >&2
  exit 1
fi

cp "$apk_path" "$output_path"
echo "[sign-only] unsigned Android APK: $output_path"
shasum -a 256 "$output_path"
