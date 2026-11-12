#!/bin/bash
# Reads the build metadata an APK carries so a measurement can say which
# commit it actually ran.
#
# The Android build writes `assets/rabby-build-info.json` with the git hash,
# the hash timestamp, the build time and the committer. That is the only
# trustworthy source: the file name of a package proves nothing.
#
# usage: apk-info.sh --apk <file.apk> [--json <out.json>]
# prints JSON on stdout:
#   {"apk":"...","commit":"cbe7765f","commitTime":"...","buildTime":"...","committer":"...","readable":true}
set -u

APK=""
JSON_OUT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --apk) APK="$2"; shift 2 ;;
    --json) JSON_OUT="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

[ -n "$APK" ] || { echo "--apk is required" >&2; exit 64; }
[ -f "$APK" ] || { echo "apk not found: $APK" >&2; exit 66; }

RAW=$(unzip -p "$APK" assets/rabby-build-info.json 2>/dev/null || true)

if [ -z "$RAW" ]; then
  RESULT=$(APK_PATH="$APK" node -e '
    console.log(JSON.stringify({ apk: process.env.APK_PATH, readable: false }));
  ')
else
  RESULT=$(APK_PATH="$APK" APK_INFO="$RAW" node -e '
    let info = {};
    try {
      info = JSON.parse(process.env.APK_INFO);
    } catch {
      info = {};
    }
    console.log(JSON.stringify({
      apk: process.env.APK_PATH,
      readable: Boolean(info.BUILD_GIT_HASH),
      commit: info.BUILD_GIT_HASH || null,
      commitTime: info.BUILD_GIT_HASH_TIME || null,
      buildTime: info.BUILD_TIME || null,
      committer: info.BUILD_GIT_COMMITOR || null,
    }));
  ')
fi

[ -n "$JSON_OUT" ] && printf '%s\n' "$RESULT" > "$JSON_OUT"
printf '%s\n' "$RESULT"
