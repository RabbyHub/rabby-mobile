#!/usr/bin/env bash
# Opens a list of screens one by one and reports whether each one rendered
# without a JS error.
#
# A screen that throws during render unmounts the app shell, so every iteration
# restarts the app before sending the deeplink - otherwise the following screens
# would silently stop being handled.
#
#   IDS=<file with one screen id per line> DEVICE=<adb serial|simulator udid> sweep.sh
#
# Platform is inferred from DEVICE (an adb serial vs a simulator UDID); override
# with PLATFORM=android|ios.
#
# Android status comes from the `[debug-open-screen] ... opened=` log line.
# iOS JS console output only reaches Metro, so the app appends each outcome to
# `Documents/screen-registry-probe.log` inside its sandbox and this script reads
# the new lines from the app container after each launch.
set -u
export PATH=$PATH:$HOME/Library/Android/sdk/platform-tools
PKG_ANDROID=${PKG_ANDROID:-com.debank.rabbymobile.debug}
PKG_IOS=${PKG_IOS:-com.debank.rabby-mobile-debug}
# PKG overrides the platform default below.
[ -n "${PKG:-}" ] && PKG_ANDROID=$PKG && PKG_IOS=$PKG
OUT=${OUT:-/tmp/screen-registry-sweep.txt}
# Screenshots + per-screen logs for anything that is not OK, so a failure can be
# inspected later instead of only being reported as an id.
SHOT_DIR=${SHOT_DIR:-$(dirname "$OUT")/screen-registry-sweep-shots}
mkdir -p "$SHOT_DIR"
: > "$OUT"
IDS=${IDS:?set IDS=<file with screen ids>}
URL_BASE='rabbygo-debug://go.rabby.io/mobile-debug/?_cmd=debug-open-screen&screen='

# Sets PLATFORM (and DEVICE when it can be discovered) in the current shell.
# Running this through `$(...)` would keep DEVICE inside the subshell.
detect_platform() {
  if [ -n "${PLATFORM:-}" ]; then
    return
  fi
  if [ -n "${DEVICE:-}" ] && adb devices | awk '$2=="device"{print $1}' | grep -qx "$DEVICE"; then
    PLATFORM=android
    return
  fi
  if [ -n "${DEVICE:-}" ] && xcrun simctl list devices | grep -q "$DEVICE"; then
    PLATFORM=ios
    return
  fi
  local devices count
  devices=$(adb devices | awk '$2=="device"{print $1}')
  count=$(printf '%s\n' "$devices" | grep -c . || true)
  if [ "$count" -gt 1 ]; then
    echo "multiple Android devices attached; set DEVICE=<serial> (one of: $(printf '%s ' $devices))" >&2
    exit 64
  fi
  if [ "$count" -eq 1 ]; then
    DEVICE=$(printf '%s' "$devices" | head -1)
    PLATFORM=android
    return
  fi
  DEVICE=$(xcrun simctl list devices booted | awk '/(Booted)/ { print $(NF-1) }' | tr -d '()' | head -1)
  [ -n "$DEVICE" ] || { echo 'no device (set DEVICE=)' >&2; exit 64; }
  PLATFORM=ios
}

ios_probe_file() {
  local container
  container=$(xcrun simctl get_app_container "$DEVICE" "$PKG_IOS" data 2>/dev/null) || return 1
  printf '%s/Documents/screen-registry-probe.log' "$container"
}

ios_probe_lines() {
  local file
  file=$(ios_probe_file) || { echo 0; return; }
  if [ -f "$file" ]; then wc -l < "$file" | tr -d ' '; else echo 0; fi
}

sweep_android() {
  local id line err status
  while read -r id; do
    [ -n "$id" ] || continue
    adb -s "$DEVICE" shell am force-stop "$PKG_ANDROID" </dev/null
    sleep 1
    adb -s "$DEVICE" logcat -c </dev/null
    adb -s "$DEVICE" shell am start -n "$PKG_ANDROID/com.debank.rabbymobile.MainActivity" </dev/null >/dev/null 2>&1
    for _ in $(seq 1 15); do
      sleep 1
      adb -s "$DEVICE" logcat -d </dev/null | grep -q 'Running "RabbyMobile"' && break
    done
    sleep 2
    adb -s "$DEVICE" shell </dev/null "am start -a android.intent.action.VIEW -d '${URL_BASE}$id' -n $PKG_ANDROID/com.debank.rabbymobile.MainActivity" >/dev/null 2>&1
    sleep 4
    local log
    log=$(adb -s "$DEVICE" logcat -d </dev/null)
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
    record_result "$id" "$status" "$err" "$log"
  done < "$IDS"
}

sweep_ios() {
  local id before file line i status probe_out attempt
  while read -r id; do
    [ -n "$id" ] || continue
    line=""
    # A launch can lose the Metro connection when the packager is busy and show
    # the red "No script URL provided" screen; one retry covers that.
    for attempt in 1 2; do
      before=$(ios_probe_lines)
      xcrun simctl terminate "$DEVICE" "$PKG_IOS" >/dev/null 2>&1
      sleep 1
      xcrun simctl launch "$DEVICE" "$PKG_IOS" -rabby-deeplink "${URL_BASE}$id" >/dev/null 2>&1
      for i in $(seq 1 30); do
        sleep 2
        file=$(ios_probe_file) || continue
        [ -f "$file" ] || continue
        line=$(tail -n +$((before + 1)) "$file" | grep "screen=$id opened=" | tail -1)
        [ -n "$line" ] && break
      done
      [ -n "$line" ] && break
    done
    if [ -z "$line" ]; then
      status="NOLOG"
      xcrun simctl io "$DEVICE" screenshot "$SHOT_DIR/$id.png" >/dev/null 2>&1 || true
    elif echo "$line" | grep -q 'opened=true'; then
      # A screen can mount and still throw while rendering; the error boundary
      # reports that separately because the JS console is not readable here.
      sleep 2
      file=$(ios_probe_file) || true
      if [ -n "${file:-}" ] && [ -f "$file" ] &&
        tail -n +$((before + 1)) "$file" | grep -q "render-failed route=$id"; then
        status="OPEN_ERR"
        xcrun simctl io "$DEVICE" screenshot "$SHOT_DIR/$id.png" >/dev/null 2>&1 || true
      else
        status="OK"
      fi
    else
      status="REFUSED"
      xcrun simctl io "$DEVICE" screenshot "$SHOT_DIR/$id.png" >/dev/null 2>&1 || true
    fi
    probe_out=$(printf 'probe: %s\n' "${line:-<none>}")
    record_result "$id" "$status" "" "$probe_out"
  done < "$IDS"
}

record_result() {
  local id=$1 status=$2 err=$3 log=$4
  if [ "$status" = "OK" ]; then
    echo "OK      $id" >> "$OUT"
    return
  fi
  {
    echo "$status $id"
    [ -n "${err:-}" ] && echo "  $err"
  } >> "$OUT"
  if [ -n "${log:-}" ]; then
    {
      echo "=== $id ($status) ==="
      printf '%s\n' "$log"
    } >> "$SHOT_DIR/$id.log" 2>/dev/null || true
  fi
}

detect_platform
echo "platform=$PLATFORM device=$DEVICE"
if [ "$PLATFORM" = "ios" ]; then
  sweep_ios
else
  sweep_android
fi

grep -oE '^(OK|NOLOG|REFUSED|OPEN_ERR)' "$OUT" | sort | uniq -c
echo "--- non-OK:"
grep -vE "^OK" "$OUT" | head -40
