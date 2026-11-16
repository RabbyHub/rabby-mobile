#!/usr/bin/env bash
set -euo pipefail

input_path="${1:?usage: sign-android.sh <unsigned.apk> <signed.apk>}"
output_path="${2:?usage: sign-android.sh <unsigned.apk> <signed.apk>}"

: "${RABBY_MOBILE_ANDROID_KEY_STORE:?RABBY_MOBILE_ANDROID_KEY_STORE is required}"
: "${RABBY_MOBILE_ANDROID_STORE_PASSWORD:?RABBY_MOBILE_ANDROID_STORE_PASSWORD is required}"
: "${RABBY_MOBILE_ANDROID_KEY_PASSWORD:?RABBY_MOBILE_ANDROID_KEY_PASSWORD is required}"
: "${RABBY_MOBILE_ANDROID_KEY_ALIAS:?RABBY_MOBILE_ANDROID_KEY_ALIAS is required}"

android_sdk="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-}}"
if [ -z "$android_sdk" ]; then
  for candidate in "$HOME/Library/Android/sdk" "$HOME/Android/Sdk"; do
    if [ -d "$candidate" ]; then
      android_sdk="$candidate"
      break
    fi
  done
fi
if [ -z "$android_sdk" ] || [ ! -d "$android_sdk/build-tools" ]; then
  echo "[sign-only] Android SDK/build-tools not found" >&2
  exit 1
fi

build_tools_version="${RABBY_MOBILE_ANDROID_BUILD_TOOLS_VERSION:-}"
if [ -z "$build_tools_version" ]; then
  build_tools_version="$(find "$android_sdk/build-tools" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; | sort -V | tail -n 1)"
fi
zipalign="$android_sdk/build-tools/$build_tools_version/zipalign"
apksigner="$android_sdk/build-tools/$build_tools_version/apksigner"
if [ ! -x "$zipalign" ] || [ ! -x "$apksigner" ]; then
  echo "[sign-only] zipalign/apksigner not found in build-tools/$build_tools_version" >&2
  exit 1
fi

tmp_dir="$(mktemp -d)"
cleanup() {
  rm -rf "$tmp_dir"
}
trap cleanup EXIT

printf '%s\n' "$RABBY_MOBILE_ANDROID_KEY_STORE" | base64 -d > "$tmp_dir/upload.jks"
chmod 600 "$tmp_dir/upload.jks"
echo "[sign-only] keystore bytes: $(wc -c < "$tmp_dir/upload.jks"), type: $(file -b "$tmp_dir/upload.jks" 2>/dev/null || echo unknown)"
if ! keytool -list -keystore "$tmp_dir/upload.jks" -storepass "$RABBY_MOBILE_ANDROID_STORE_PASSWORD" >/dev/null 2>"$tmp_dir/keytool.err"; then
  echo "[sign-only] keytool could not open the decoded keystore:" >&2
  sed -n '1,5p' "$tmp_dir/keytool.err" >&2
  exit 1
fi

"$zipalign" -f -p 4 "$input_path" "$tmp_dir/aligned.apk"
"$apksigner" sign \
  --ks "$tmp_dir/upload.jks" \
  --ks-pass env:RABBY_MOBILE_ANDROID_STORE_PASSWORD \
  --key-pass env:RABBY_MOBILE_ANDROID_KEY_PASSWORD \
  --ks-key-alias "$RABBY_MOBILE_ANDROID_KEY_ALIAS" \
  --v2-signing-enabled true \
  --v3-signing-enabled true \
  --v4-signing-enabled true \
  --out "$output_path" \
  "$tmp_dir/aligned.apk"

"$apksigner" verify --verbose --print-certs "$output_path"
echo "[sign-only] signed Android APK: $output_path"
