#!/usr/bin/env bash
# Opens any navigator-registered screen through the debug deeplink.
#
#   open-screen.sh list                     # print the registered screens
#   open-screen.sh open <ScreenId> [params-json] [store-json]
#
# Device selection: DEVICE=<adb serial|simulator udid>. Defaults to the only
# connected Android device, or the booted simulator.
#
# The screen must exist in src/devtools/screenRegistry/screens.gen.ts
# (generate with: node scripts/gen-screen-registry.mjs).
set -euo pipefail

PKG_ANDROID=${PKG_ANDROID:-com.debank.rabbymobile.debug}
PKG_IOS=${PKG_IOS:-com.debank.rabby-mobile-debug}
ACTION=${1:-}
SCREEN=${2:-}
PARAMS=${3:-}
STORE=${4:-}

detect_device() {
  if [ -n "${DEVICE:-}" ]; then
    printf '%s' "$DEVICE"
    return
  fi
  local serial
  serial=$(adb devices | awk '$2 == "device" { print $1; exit }')
  [ -n "$serial" ] || {
    echo 'no Android device connected (set DEVICE=<serial>)' >&2
    exit 1
  }
  printf '%s' "$serial"
}

encode() {
  node -e 'process.stdout.write(encodeURIComponent(process.argv[1] ?? ""))' "$1"
}

build_url() {
  local url="rabbygo-debug://go.rabby.io/mobile-debug/debug-open-screen?_cmd=debug-open-screen"
  if [ -n "$SCREEN" ]; then
    url="$url&screen=$(encode "$SCREEN")"
  fi
  if [ -n "$PARAMS" ]; then
    url="$url&params=$(encode "$PARAMS")"
  fi
  if [ -n "$STORE" ]; then
    url="$url&store=$(encode "$STORE")"
  fi
  if [ "$ACTION" = "list" ]; then
    url="$url&list=1"
  fi
  printf '%s' "$url"
}

open_on_android() {
  local device url
  device=$(detect_device)
  url=$(build_url)
  adb -s "$device" logcat -c
  adb -s "$device" shell \
    "am start -a android.intent.action.VIEW -d '$url' -n $PKG_ANDROID/com.debank.rabbymobile.MainActivity" \
    >/dev/null
  sleep 3
  adb -s "$device" logcat -d | grep -E '\[debug-open-screen\]' | tail -3
}

open_on_ios() {
  local udid url container probe before line i
  udid=${DEVICE:-$(xcrun simctl list devices booted | awk '/(Booted)/ { print $(NF-1); exit }' | tr -d '()')}
  [ -n "$udid" ] || {
    echo 'no booted simulator (set DEVICE=<udid>)' >&2
    exit 1
  }
  container=$(xcrun simctl get_app_container "$udid" "$PKG_IOS" data 2>/dev/null || true)
  probe="$container/Documents/screen-registry-probe.log"
  before=0
  [ -f "$probe" ] && before=$(wc -l < "$probe" | tr -d ' ')
  url=$(build_url)
  xcrun simctl terminate "$udid" "$PKG_IOS" >/dev/null 2>&1 || true
  sleep 1
  xcrun simctl launch "$udid" "$PKG_IOS" -rabby-deeplink "$url" >/dev/null
  # iOS JS console output only reaches Metro; the app appends each outcome to a
  # sandbox file that the host reads here.
  line=''
  for i in $(seq 1 30); do
    sleep 2
    [ -f "$probe" ] || continue
    line=$(tail -n +$((before + 1)) "$probe" | tail -1)
    [ -n "$line" ] && break
  done
  [ -n "$line" ] && echo "probe: $line"
}

list_screens() {
  local gen
  gen="$(cd "$(dirname "$0")/../.." && pwd)/src/devtools/screenRegistry/screens.gen.ts"
  grep -E '^  [A-Za-z0-9_]+: \{' "$gen" | sed -E 's/^  ([A-Za-z0-9_]+): \{/\1/'
}

run() {
  if [ -n "${DEVICE:-}" ] && xcrun simctl list devices 2>/dev/null | grep -q "$DEVICE"; then
    open_on_ios
  elif command -v adb >/dev/null 2>&1 && adb devices | awk '$2=="device"' | grep -q .; then
    open_on_android
  else
    open_on_ios
  fi
}

case "$ACTION" in
  # The registry is generated at build time, so listing does not need a device.
  list) list_screens ;;
  open)
    [ -n "$SCREEN" ] || {
      echo 'usage: open-screen.sh open <ScreenId> [params-json] [store-json]' >&2
      exit 64
    }
    run
    ;;
  *)
    sed -n '2,12p' "$0"
    exit 64
    ;;
esac
