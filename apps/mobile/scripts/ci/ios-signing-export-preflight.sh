#!/usr/bin/env bash

set -euo pipefail

log() {
  printf '[ios-signing-preflight] %s\n' "$*"
}

fail() {
  printf '[ios-signing-preflight] %s\n' "$*" >&2
  exit 1
}

require_env() {
  local name="$1"
  local value="${!name:-}"
  if [ -z "$value" ]; then
    fail "missing required env: $name"
  fi
}

plist_read() {
  local plist_path="$1"
  local key_path="$2"
  /usr/libexec/PlistBuddy -c "Print $key_path" "$plist_path" 2>/dev/null || true
}

assert_equal() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$actual" != "$expected" ]; then
    fail "$label mismatch: expected '$expected', got '$actual'"
  fi
}

normalize_sha256() {
  printf '%s' "$1" | awk '{print tolower($1)}'
}

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
project_dir="$(cd "$script_dir/../.." && pwd -P)"
mobile_scripts_dir="$project_dir/scripts"

if [ "$(uname -s)" != "Darwin" ]; then
  fail "iOS signing export preflight must run on macOS"
fi

require_env "MATCH_PASSWORD"
require_env "RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_ARCHIVE_S3_URI"
require_env "RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_ARCHIVE_SHA256"

fixture_s3_uri="$RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_ARCHIVE_S3_URI"
case "$fixture_s3_uri" in
  s3://*) ;;
  *) fail "RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_ARCHIVE_S3_URI must be an s3:// URI" ;;
esac

expected_sha256="$(normalize_sha256 "$RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_ARCHIVE_SHA256")"
if [[ ! "$expected_sha256" =~ ^[0-9a-f]{64}$ ]]; then
  fail "RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_ARCHIVE_SHA256 must contain a 64-character sha256"
fi

signing_type="${RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_TYPE:-appstore}"
case "$signing_type" in
  appstore) ;;
  *) fail "unsupported RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_TYPE: $signing_type" ;;
esac

expected_bundle_id="${RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_BUNDLE_ID:-com.debank.rabby-mobile}"
expected_team_id="${RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_TEAM_ID:-ZPNP2SF27Q}"
expected_profile_name="${RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_PROFILE_NAME:-RabbyMobileAppStoreOpcode}"
export_method="${RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_EXPORT_METHOD:-app-store-connect}"
work_dir="${RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_WORK_DIR:-$project_dir/ios/Package/signing-preflight}"
archive_zip="$work_dir/RabbyMobileSigningPreflight.xcarchive.zip"
unpack_dir="$work_dir/unpacked"
export_dir="$work_dir/export"
export_options="$work_dir/ExportOptions.plist"
inspect_dir="$work_dir/ipa-inspect"

case "$export_method" in
  app-store|app-store-connect) ;;
  *) fail "unsupported RABBY_MOBILE_IOS_SIGNING_PREFLIGHT_EXPORT_METHOD: $export_method" ;;
esac

rm -rf "$work_dir"
mkdir -p "$work_dir"

log "download fixture archive from configured S3 URI"
if [ "${DISABLE_AWS_CLI_HTTPS_VALIDATION:-false}" = "true" ]; then
  aws --no-verify-ssl s3 cp "$fixture_s3_uri" "$archive_zip" --only-show-errors
else
  aws s3 cp "$fixture_s3_uri" "$archive_zip" --only-show-errors
fi

actual_sha256="$(shasum -a 256 "$archive_zip" | awk '{print tolower($1)}')"
assert_equal "fixture sha256" "$expected_sha256" "$actual_sha256"
log "fixture sha256 verified: $actual_sha256"

mkdir -p "$unpack_dir"
ditto -x -k "$archive_zip" "$unpack_dir"

archive_count="$(find "$unpack_dir" -maxdepth 1 -type d -name '*.xcarchive' | wc -l | tr -d ' ')"
if [ "$archive_count" != "1" ]; then
  find "$unpack_dir" -maxdepth 2 -print
  fail "expected exactly one .xcarchive in fixture zip, got $archive_count"
fi

archive_path="$(find "$unpack_dir" -maxdepth 1 -type d -name '*.xcarchive' | head -n 1)"
app_path="$archive_path/Products/Applications/RabbyMobile.app"
if [ ! -d "$app_path" ]; then
  fail "fixture archive does not contain RabbyMobile.app"
fi

archive_bundle_id="$(plist_read "$archive_path/Info.plist" ":ApplicationProperties:CFBundleIdentifier")"
archive_team_id="$(plist_read "$archive_path/Info.plist" ":ApplicationProperties:Team")"
app_bundle_id="$(plist_read "$app_path/Info.plist" ":CFBundleIdentifier")"

assert_equal "archive bundle id" "$expected_bundle_id" "$archive_bundle_id"
assert_equal "app bundle id" "$expected_bundle_id" "$app_bundle_id"
assert_equal "archive team id" "$expected_team_id" "$archive_team_id"
log "fixture archive metadata verified: bundle=$archive_bundle_id team=$archive_team_id"

log "prepare fastlane match signing assets"
cd "$project_dir"
unset MATCH_GIT_BASIC_AUTHORIZATION
# shellcheck source=/dev/null
. "$mobile_scripts_dir/fns.sh" --source-only
# shellcheck source=/dev/null
. "$mobile_scripts_dir/turbo-build/_fns.sh" --source-only
turbo_prepare_ruby_bundle
export CONFIGURATION=release
export TYPE="$signing_type"
unset TARGET
turbo_bundle_exec exec fastlane ios appstore_signing_preflight

log "write export options"
/usr/libexec/PlistBuddy -c "Clear dict" "$export_options"
/usr/libexec/PlistBuddy -c "Add :method string $export_method" "$export_options"
/usr/libexec/PlistBuddy -c "Add :signingStyle string manual" "$export_options"
/usr/libexec/PlistBuddy -c "Add :teamID string $expected_team_id" "$export_options"
/usr/libexec/PlistBuddy -c "Add :provisioningProfiles dict" "$export_options"
/usr/libexec/PlistBuddy -c "Add :provisioningProfiles:$expected_bundle_id string $expected_profile_name" "$export_options"
/usr/libexec/PlistBuddy -c "Add :stripSwiftSymbols bool true" "$export_options"

log "export archive"
mkdir -p "$export_dir"
xcodebuild \
  -exportArchive \
  -archivePath "$archive_path" \
  -exportPath "$export_dir" \
  -exportOptionsPlist "$export_options"

ipa_path="$(find "$export_dir" -maxdepth 1 -type f -name '*.ipa' | head -n 1)"
if [ -z "$ipa_path" ] || [ ! -f "$ipa_path" ]; then
  fail "export succeeded but no IPA was produced"
fi

rm -rf "$inspect_dir"
mkdir -p "$inspect_dir"
unzip -q "$ipa_path" -d "$inspect_dir"
exported_app_path="$inspect_dir/Payload/RabbyMobile.app"
if [ ! -d "$exported_app_path" ]; then
  fail "exported IPA does not contain RabbyMobile.app"
fi

exported_bundle_id="$(plist_read "$exported_app_path/Info.plist" ":CFBundleIdentifier")"
assert_equal "exported app bundle id" "$expected_bundle_id" "$exported_bundle_id"

exported_profile_plist="$work_dir/exported-profile.plist"
security cms -D -i "$exported_app_path/embedded.mobileprovision" > "$exported_profile_plist"
exported_profile_name="$(plist_read "$exported_profile_plist" ":Name")"
exported_application_id="$(plist_read "$exported_profile_plist" ":Entitlements:application-identifier")"
exported_has_devices="false"
if /usr/libexec/PlistBuddy -c "Print :ProvisionedDevices:0" "$exported_profile_plist" >/dev/null 2>&1; then
  exported_has_devices="true"
fi

assert_equal "exported profile name" "$expected_profile_name" "$exported_profile_name"
assert_equal "exported application identifier" "$expected_team_id.$expected_bundle_id" "$exported_application_id"
assert_equal "exported profile provisioned devices" "false" "$exported_has_devices"

ipa_sha256="$(shasum -a 256 "$ipa_path" | awk '{print tolower($1)}')"
log "export succeeded: ipa=$(basename "$ipa_path") sha256=$ipa_sha256"
