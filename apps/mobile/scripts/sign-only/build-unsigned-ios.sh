#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
archive_path="${1:-$project_dir/.sign-only/RabbyMobile.xcarchive}"
output_zip="${2:-${archive_path}.zip}"

mkdir -p "$(dirname "$archive_path")"
cd "$project_dir"

if [ ! -d "$project_dir/ios/Pods" ]; then
  echo "[sign-only] ios/Pods is missing; run 'yarn ios:installpod' first" >&2
  exit 1
fi

rm -rf "$archive_path" "$output_zip"
echo "[sign-only] building unsigned iOS archive..."
xcodebuild \
  -workspace "$project_dir/ios/RabbyMobile.xcworkspace" \
  -scheme RabbyMobileRegression \
  -configuration Regression \
  -destination 'generic/platform=iOS' \
  -archivePath "$archive_path" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  archive

echo "[sign-only] packaging unsigned xcarchive..."
archive_dir="$(dirname "$archive_path")"
archive_name="$(basename "$archive_path")"
(cd "$archive_dir" && ditto -c -k --sequesterRsrc --keepParent "$archive_name" "$output_zip")
echo "[sign-only] unsigned iOS archive: $output_zip"
shasum -a 256 "$output_zip"
