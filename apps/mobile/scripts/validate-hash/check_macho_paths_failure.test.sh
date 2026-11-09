#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CHECK="$SCRIPT_DIR/check_macho_paths.js"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

run_guard() {
  local app_dir="$1"
  local report_file="$2"

  (
    while IFS= read -r -d '' macho_path; do
      if file "$macho_path" | grep -q 'Mach-O'; then
        node "$CHECK" "$macho_path" || exit 1
      fi
    done < <(find "$app_dir" -type f -print0)
    printf 'hash\n' >"$report_file"
  )
}

BAD_APP="$TMP/BadApp"
mkdir -p "$BAD_APP/Frameworks/Bad.framework"
cp /usr/bin/true "$BAD_APP/Frameworks/Bad.framework/Bad"
printf '/Applications/Xcode-27.1.0.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk' >>"$BAD_APP/Frameworks/Bad.framework/Bad"

set +e
run_guard "$BAD_APP" "$TMP/bad-report.txt"
bad_status=$?
set -e
if [ "$bad_status" -eq 0 ]; then
  echo 'expected non-canonical framework path to fail'
  exit 1
fi
if [ -f "$TMP/bad-report.txt" ]; then
  echo 'hash report must not be produced for a rejected framework'
  exit 1
fi

GOOD_APP="$TMP/GoodApp"
mkdir -p "$GOOD_APP/Frameworks/Good.framework"
cp /usr/bin/true "$GOOD_APP/Frameworks/Good.framework/Good"
printf '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/SDKs/iPhoneOS27.1.sdk' >>"$GOOD_APP/Frameworks/Good.framework/Good"

set +e
run_guard "$GOOD_APP" "$TMP/good-report.txt"
good_status=$?
set -e
if [ "$good_status" -ne 0 ]; then
  echo 'canonical framework path should pass'
  exit 1
fi
if [ ! -f "$TMP/good-report.txt" ]; then
  echo 'hash report should be produced for a canonical framework'
  exit 1
fi

echo 'PASS: framework path guard blocks rejected binaries and allows canonical paths'
