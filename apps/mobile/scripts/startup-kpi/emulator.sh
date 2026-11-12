#!/bin/bash
# Cold-start KPI emulator helper.
#
# The startup KPI needs a device that is always available and identical between
# runs. A hung/plugged phone is not that; an AVD is. This script owns the
# emulator lifecycle for the KPI workflows:
#
#   emulator.sh ensure   # install the system image + create the AVD if missing
#   emulator.sh boot     # start it headless in the background
#   emulator.sh wait     # block until sys.boot_completed=1
#   emulator.sh kill     # stop it
#   emulator.sh status   # one-line state
#
# Defaults are the pinned measurement case: Pixel 7 / API 35 google_apis arm64.
# Change the pixel profile or level only together with the recorded baselines,
# otherwise the numbers are no longer comparable.
set -u

API=${API:-35}
DEVICE_PROFILE=${DEVICE_PROFILE:-pixel_7}
AVD_NAME=${AVD_NAME:-rabby-startup-pixel7-api35}
IMAGE_PKG=${IMAGE_PKG:-system-images;android-$API;google_apis;arm64-v8a}
PORT=${PORT:-5554}
SERIAL="emulator-$PORT"
BOOT_TIMEOUT_S=${BOOT_TIMEOUT_S:-240}
# WIPE=1 boots a factory-clean userdata. CI uses it so every comparison starts
# from the same state; a locally kept wallet is then re-seeded by the workflow.
WIPE=${WIPE:-0}

sdk_root() {
  if [ -n "${ANDROID_SDK_ROOT:-}" ] && [ -d "$ANDROID_SDK_ROOT/emulator" ]; then
    printf '%s' "$ANDROID_SDK_ROOT"
    return
  fi
  if [ -n "${ANDROID_HOME:-}" ] && [ -d "$ANDROID_HOME/emulator" ]; then
    printf '%s' "$ANDROID_HOME"
    return
  fi
  for candidate in "$HOME/Library/Android/sdk" "/Users/Shared/Library/Android/sdk"; do
    [ -d "$candidate/emulator" ] && { printf '%s' "$candidate"; return; }
  done
  echo "no Android SDK with an emulator found" >&2
  return 1
}

SDK=$(sdk_root) || exit 3
EMULATOR="$SDK/emulator/emulator"
ADB=$(command -v adb || printf '%s/platform-tools/adb' "$SDK")
AVDMANAGER="$SDK/cmdline-tools/latest/bin/avdmanager"
SDKMANAGER="$SDK/cmdline-tools/latest/bin/sdkmanager"

log() { printf '[startup-kpi/emulator] %s\n' "$*"; }

cmd_ensure() {
  local avd_home="${ANDROID_AVD_HOME:-$HOME/.android/avd}"
  if [ -d "$avd_home/$AVD_NAME.avd" ]; then
    log "avd $AVD_NAME present"
    return 0
  fi
  if [ ! -d "$SDK/system-images/android-$API/google_apis/arm64-v8a" ]; then
    log "installing $IMAGE_PKG (one-off, ~2GB)"
    yes | "$SDKMANAGER" --sdk_root="$SDK" --licenses >/dev/null 2>&1 || true
    "$SDKMANAGER" --sdk_root="$SDK" --install "$IMAGE_PKG" || return 1
  fi
  log "creating avd $AVD_NAME ($DEVICE_PROFILE / api $API)"
  echo no | "$AVDMANAGER" create avd \
    -n "$AVD_NAME" -k "$IMAGE_PKG" -d "$DEVICE_PROFILE" || return 1
}

cmd_boot() {
  local state
  state=$("$ADB" -s "$SERIAL" get-state 2>/dev/null || true)
  if [ "$state" = "device" ]; then
    log "$SERIAL already running"
    return 0
  fi
  log "booting $AVD_NAME on port $PORT (headless)"
  # -no-snapshot: every measurement must start from a cold boot, a restored
  # snapshot would quietly change what we measure.
  #
  # Detach into its own session when `setsid` exists so a process-group kill of
  # the calling step cannot take the emulator down mid-measurement. Where it
  # does not exist (macOS) plain nohup is enough for the CI runner.
  local launcher=() wipe=()
  command -v setsid >/dev/null 2>&1 && launcher=(setsid)
  [ "$WIPE" = "1" ] && wipe=(-wipe-data)
  nohup ${launcher[@]+"${launcher[@]}"} "$EMULATOR" -avd "$AVD_NAME" -port "$PORT" \
    -no-window -no-audio -no-boot-anim -no-snapshot \
    ${wipe[@]+"${wipe[@]}"} \
    -gpu host -camera-back none -camera-front none \
    >"${EMULATOR_LOG:-/tmp/rabby-startup-kpi-emulator.log}" 2>&1 &
  log "pid $!"
}

cmd_wait() {
  local deadline=$((SECONDS + BOOT_TIMEOUT_S))
  while [ $SECONDS -lt $deadline ]; do
    if [ "$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; then
      # Let the launcher settle before the first cold start.
      sleep 5
      log "$SERIAL booted"
      return 0
    fi
    sleep 3
  done
  log "timeout waiting for $SERIAL to boot"
  return 1
}

cmd_kill() {
  "$ADB" -s "$SERIAL" emu kill >/dev/null 2>&1 || true
  log "kill requested for $SERIAL"
}

cmd_status() {
  local booted
  booted=$("$ADB" -s "$SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')
  printf '%s boot_completed=%s\n' "$SERIAL" "${booted:-0}"
}

case "${1:-}" in
  ensure) cmd_ensure ;;
  boot) cmd_boot ;;
  wait) cmd_wait ;;
  kill) cmd_kill ;;
  status) cmd_status ;;
  *)
    echo "usage: $0 {ensure|boot|wait|kill|status}" >&2
    exit 64
    ;;
esac
