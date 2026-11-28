#!/usr/bin/env bash
# Re-send the Lark release notification for an artifact.
#
# The notification is a standalone, repeatable action (the same package may be
# announced twice, e.g. after a failed first attempt), so it is decoupled from
# the publish step.
#
#   scripts/release/notify.sh --platform android --url <download-url> \
#     [--drive-file <local artifact>] [--name <filename>] [--drive-url <url>] \
#     [--fast-build] [--android-16kb-report <text>]
#
# Requires RABBY_MOBILE_LARK_CHAT_URL / RABBY_MOBILE_LARK_CHAT_SECRET (bot).
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
mobile_scripts="$(cd "$script_dir/.." && pwd)"

platform=""
url=""
drive_file=""
drive_url=""
name=""
fast_build=""
report=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --platform) platform="$2"; shift 2 ;;
    --url) url="$2"; shift 2 ;;
    --drive-file) drive_file="$2"; shift 2 ;;
    --drive-url) drive_url="$2"; shift 2 ;;
    --name) name="$2"; shift 2 ;;
    --fast-build) fast_build="true"; shift ;;
    --android-16kb-report) report="$2"; shift 2 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

case "$platform" in
  android|ios) ;;
  *) echo "usage: $0 --platform android|ios --url <download-url>" >&2; exit 2 ;;
esac
[ -n "$url" ] || { echo "--url is required" >&2; exit 2; }

if [ -n "$drive_file" ]; then
  [ -f "$drive_file" ] || { echo "artifact not found: $drive_file" >&2; exit 2; }
  [ -n "$name" ] || name="$(basename "$drive_file")"
  drive_url="$(node "$mobile_scripts/ci/upload-package-to-lark-drive.js" "$drive_file" "$name")"
fi

export RABBY_MOBILE_LARK_DRIVE_URL="${drive_url}"
[ -n "$report" ] && export RABBY_MOBILE_ANDROID_16KB_REPORT_TEXT="$report"

node "$mobile_scripts/notify-lark.js" "$url" "$platform" "$fast_build"
