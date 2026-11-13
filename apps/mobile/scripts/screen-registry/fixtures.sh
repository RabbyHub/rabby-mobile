#!/usr/bin/env bash
# Capture/replay route-param fixtures for screens whose real data is a large
# object (bridge records, transaction groups, quotes).
#
#   fixtures.sh list                       # list captured fixtures on the device
#   fixtures.sh pull <name> [dest]         # copy one fixture to the host
#   fixtures.sh push <local-file> [name]   # push a fixture into the app sandbox
#   fixtures.sh dir                        # print the on-device fixture dir
#
# Device selection: DEVICE=<adb serial|simulator udid>. Platform is inferred.
# Capture side is the in-app command:
#   rabbygo-debug://go.rabby.io/mobile-debug/?_cmd=debug-dump-route&name=<name>
# Replay side is:
#   ...&_cmd=debug-open-screen&screen=<Id>&paramsFile=<name>
set -euo pipefail
export PATH=$PATH:$HOME/Library/Android/sdk/platform-tools
PKG_ANDROID=${PKG_ANDROID:-com.debank.rabbymobile.debug}
PKG_IOS=${PKG_IOS:-com.debank.rabby-mobile-debug}
CMD=${1:-}
NAME=${2:-}
DEST=${3:-}
FIXTURE_SUBDIR=screen-registry-fixtures

detect_platform() {
  if [ -n "${DEVICE:-}" ] && adb devices | awk '$2=="device"{print $1}' | grep -qx "$DEVICE"; then
    echo android; return
  fi
  if [ -n "${DEVICE:-}" ] && xcrun simctl list devices 2>/dev/null | grep -q "$DEVICE"; then
    echo ios; return
  fi
  if adb devices | awk '$2=="device"' | grep -q .; then echo android; return; fi
  echo ios
}
PLATFORM=$(detect_platform)

ios_dir() {
  local udid container
  udid=${DEVICE:-$(xcrun simctl list devices booted | awk '/(Booted)/ { print $(NF-1) }' | tr -d '()' | head -1)}
  container=$(xcrun simctl get_app_container "$udid" "$PKG_IOS" data)
  printf '%s/Documents/%s' "$container" "$FIXTURE_SUBDIR"
}
android_rel() { printf 'files/%s' "$FIXTURE_SUBDIR"; }

case "$CMD" in
  dir)
    if [ "$PLATFORM" = ios ]; then ios_dir; else adb -s "${DEVICE:?set DEVICE=}" shell run-as "$PKG_ANDROID" sh -c "echo /data/user/0/$PKG_ANDROID/$(android_rel)"; fi
    ;;
  list)
    if [ "$PLATFORM" = ios ]; then ls -1 "$(ios_dir)" 2>/dev/null || true
    else adb -s "${DEVICE:?set DEVICE=}" shell run-as "$PKG_ANDROID" ls -1 "$(android_rel)" 2>/dev/null || true; fi
    ;;
  pull)
    [ -n "$NAME" ] || { echo 'usage: fixtures.sh pull <name> [dest]' >&2; exit 64; }
    out=${DEST:-./local/fixtures/$NAME.json}
    mkdir -p "$(dirname "$out")"
    if [ "$PLATFORM" = ios ]; then cp "$(ios_dir)/$NAME.json" "$out"
    else adb -s "${DEVICE:?set DEVICE=}" exec-out run-as "$PKG_ANDROID" cat "$(android_rel)/$NAME.json" > "$out"; fi
    echo "$out"
    ;;
  push)
    src=$NAME
    [ -n "$src" ] || { echo 'usage: fixtures.sh push <local-file> [name]' >&2; exit 64; }
    target=${DEST:-$(basename "$src" .json)}
    if [ "$PLATFORM" = ios ]; then
      mkdir -p "$(ios_dir)"; cp "$src" "$(ios_dir)/$target.json"
    else
      adb -s "${DEVICE:?set DEVICE=}" shell run-as "$PKG_ANDROID" mkdir -p "$(android_rel)"
      adb -s "${DEVICE:?set DEVICE=}" exec-in run-as "$PKG_ANDROID" sh -c "cat > $(android_rel)/$target.json" < "$src"
    fi
    echo "pushed $target"
    ;;
  *)
    sed -n '2,12p' "$0"; exit 64 ;;
esac
