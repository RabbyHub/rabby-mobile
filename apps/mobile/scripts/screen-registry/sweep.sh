#!/usr/bin/env bash
# Opens a list of screens one by one and reports whether each one rendered
# without a JS error.
#
# A screen that throws during render unmounts the app shell, so every iteration
# restarts the app before sending the deeplink - otherwise the following screens
# would silently stop being handled.
#
#   IDS=<file with one screen id per line> DEVICE=<adb serial> sweep.sh
#
# Generate a candidate list with:
#   node scripts/gen-screen-registry.mjs && node -e "..."  # see README
set -u
export PATH=$PATH:$HOME/Library/Android/sdk/platform-tools
DEV=${DEVICE:-$(adb devices | awk '$2=="device"{print $1; exit}')}
PKG=${PKG:-com.debank.rabbymobile.debug}
ACT=$PKG/com.debank.rabbymobile.MainActivity
OUT=${OUT:-/tmp/screen-registry-sweep.txt}
# Screenshots + per-screen logs for anything that is not OK, so a failure can be
# inspected later instead of only being reported as an id.
SHOT_DIR=${SHOT_DIR:-$(dirname "$OUT")/screen-registry-sweep-shots}
mkdir -p "$SHOT_DIR"
: > "$OUT"
IDS=${IDS:?set IDS=<file with screen ids>}
while read -r id; do
  [ -n "$id" ] || continue
  adb -s $DEV shell am force-stop $PKG </dev/null
  sleep 1
  adb -s $DEV logcat -c </dev/null
  adb -s $DEV shell am start -n $ACT </dev/null >/dev/null 2>&1
  # wait for JS
  for _ in $(seq 1 15); do
    sleep 1
    adb -s $DEV logcat -d </dev/null | grep -q 'Running "RabbyMobile"' && break
  done
  sleep 2
  adb -s $DEV shell </dev/null "am start -a android.intent.action.VIEW -d 'rabbygo-debug://go.rabby.io/mobile-debug/?_cmd=debug-open-screen&screen=$id' -n $ACT" >/dev/null 2>&1
  sleep 4
  log=$(adb -s $DEV logcat -d </dev/null)
  line=$(printf '%s\n' "$log" | grep -o "\[debug-open-screen\] screen=$id opened=[a-z]*" | tail -1)
  err=$(printf '%s\n' "$log" | grep -E "ReactNativeJS.*(TypeError|Cannot read|is not a function)" | tail -1 | cut -c1-110)
  status=""
  if [ -z "$line" ]; then
    status="NOLOG"
  elif echo "$line" | grep -q 'opened=true'; then
    if [ -n "$err" ]; then status="OPEN_ERR"; else status="OK"; fi
  else
    status="REFUSED"
  fi

  if [ "$status" = "OK" ]; then
    echo "OK      $id" >> "$OUT"
  else
    {
      echo "$status $id"
      [ -n "${err:-}" ] && echo "  error: $err"
      echo "  error: ${err:-none}"
    } >> "$OUT"
    adb -s $DEV exec-out screencap -p </dev/null >"$SHOT_DIR/$id.png" 2>/dev/null || true
    printf '%s\n' "$log" >"$SHOT_DIR/$id.log" 2>/dev/null || true
  fi
done < "$IDS"
awk '{print $1}' "$OUT" | sort | uniq -c
echo "--- non-OK:"
grep -vE "^OK" "$OUT" | head -25
