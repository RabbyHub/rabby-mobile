#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"
archive_path="${1:-$project_dir/.sign-only/RabbyMobile.xcarchive}"
output_zip="${2:-${archive_path}.zip}"

mkdir -p "$(dirname "$archive_path")"
cd "$project_dir"

# A stale Pods project (Manifest.lock older than Podfile.lock) makes Xcode
# reject the archive with "IPHONEOS_DEPLOYMENT_TARGET ... is set to 12.4, but
# the range of supported deployment target versions is 15.0 to 27.1.x", so
# bring Pods in sync before building. No signing material is involved.
ensure_ios_pods() {
  local ios_dir="$project_dir/ios"

  if [ -d "$ios_dir/Pods" ] && [ -f "$ios_dir/Pods/Manifest.lock" ] &&
    [ -f "$ios_dir/Podfile.lock" ] && cmp -s "$ios_dir/Pods/Manifest.lock" "$ios_dir/Podfile.lock"; then
    return 0
  fi

  if [ -d "$ios_dir/Pods" ]; then
    echo "[sign-only] ios/Pods is out of date with Podfile.lock; running pod install..."
    # CocoaPods does not always rewrite an existing Manifest.lock, so drop the
    # generated copy and let the install recreate it from Podfile.lock.
    find "$ios_dir/Pods" -maxdepth 1 -name Manifest.lock -delete
  else
    echo "[sign-only] ios/Pods is missing; running pod install..."
  fi

  (
    cd "$ios_dir"
    if [ -f "Gemfile" ]; then
      bundle install
      bundle exec pod install
    else
      pod install
    fi
  )
}

ensure_ios_pods

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
