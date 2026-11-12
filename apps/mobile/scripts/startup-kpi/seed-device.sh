#!/bin/bash
# Seeds the device state the cold-start KPI measures against.
#
# A wiped device boots into onboarding, which is neither unlock nor Home, so
# the KPI marker never fires. Two non-production deeplinks build the same state
# a user would have:
#
#   seed-device.sh ensure-address  --device <serial> --pkg <id>
#   seed-device.sh create-address  --device <serial> --pkg <id>
#   seed-device.sh import-accounts --device <serial> --pkg <id> --file <host file>
#                                  [--settle 35]
#
# The account list is pushed to the app's own external files dir (no storage
# permission needed, removed right after the import) and never appears in the
# deeplink or in logcat.
set -u

PACKAGE=${PACKAGE:-com.debank.rabbymobile.regression}
DEVICE=""
ACCOUNTS_FILE=""
SETTLE_S=${SETTLE_S:-35}
WAIT_S=${WAIT_S:-120}

usage() {
  echo "usage: $0 {ensure-address|create-address|import-accounts} --device <serial> [--pkg <id>] [--file <path>] [--settle <s>]" >&2
  exit 64
}

CMD=${1:-}
[ -n "$CMD" ] || usage
shift

while [ $# -gt 0 ]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --pkg) PACKAGE="$2"; shift 2 ;;
    --file) ACCOUNTS_FILE="$2"; shift 2 ;;
    --settle) SETTLE_S="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$DEVICE" ] || usage

adb_shell() { adb -s "$DEVICE" shell "$@"; }

start_app() {
  # Clear first: the JS-ready check below must see this launch, not the
  # previous session's line still sitting in the log buffer.
  adb -s "$DEVICE" shell am force-stop "$PACKAGE"
  adb -s "$DEVICE" logcat -c
  adb -s "$DEVICE" shell am start -n "$PACKAGE/com.debank.rabbymobile.MainActivity" >/dev/null 2>&1
}

wait_for_js() {
  local i
  for i in $(seq 1 45); do
    adb -s "$DEVICE" logcat -d | grep -q 'Running "RabbyMobile"' && return 0
    sleep 2
  done
  return 1
}

send_link() {
  # Always drive the command through `_cmd`: the path prefix differs per build
  # type (/mobile-debug/, /mobile-regression/, /mobile/), the command does not.
  adb -s "$DEVICE" shell \
    "am start -a android.intent.action.VIEW -d '$1' -n $PACKAGE/com.debank.rabbymobile.MainActivity" \
    >/dev/null 2>&1
}

# run_with_retry <logcat marker> <url> [attempts]
run_with_retry() {
  local marker="$1" url="$2" attempts="${3:-3}" a i
  for a in $(seq 1 "$attempts"); do
    adb -s "$DEVICE" logcat -c
    send_link "$url"
    for i in $(seq 1 30); do
      sleep 2
      if adb -s "$DEVICE" logcat -d | grep -q "$marker"; then
        return 0
      fi
    done
  done
  return 1
}

# 0 = onboarding is on screen, 1 = some other screen, 2 = could not tell.
onboarding_state() {
  adb_shell rm -f /sdcard/startup-kpi-onboarding.xml >/dev/null 2>&1 || true
  adb_shell uiautomator dump /sdcard/startup-kpi-onboarding.xml >/dev/null 2>&1 || true
  local dump
  dump=$(adb_shell cat /sdcard/startup-kpi-onboarding.xml 2>/dev/null)
  case "$dump" in
    *"<hierarchy"*) ;;
    *) return 2 ;;
  esac
  case "$dump" in
    *"Welcome to"*) return 0 ;;
    *) return 1 ;;
  esac
}

create_address() {
  start_app
  wait_for_js || { echo "app JS never started" >&2; return 1; }
  # Give the universal-link handler a moment to mount before the intent lands.
  sleep 4
  if run_with_retry '\[debug-create-address\] done' \
    'rabbygo://go.rabby.io/mobile/debug-create-address?_cmd=debug-create-address'; then
    echo "create-address done"
    return 0
  fi
  echo "create-address did not report completion" >&2
  return 1
}

case "$CMD" in
  ensure-address)
    # A wiped device boots into onboarding; a device that already has a wallet
    # must not get a second one. The app has to be running to tell them apart.
    start_app
    wait_for_js || { echo "app JS never started" >&2; exit 1; }
    sleep 3

    state=2
    for _ in $(seq 1 10); do
      onboarding_state
      state=$?
      [ "$state" != "2" ] && break
      sleep 2
    done

    case "$state" in
      0) create_address ;;
      1)
        echo "wallet already present, skipping create-address"
        ;;
      *)
        echo "could not read the UI to decide whether the device is seeded" >&2
        exit 1
        ;;
    esac
    ;;

  create-address)
    create_address
    ;;

  import-accounts)
    [ -n "$ACCOUNTS_FILE" ] && [ -f "$ACCOUNTS_FILE" ] || {
      echo "--file is required" >&2
      exit 64
    }
    device_dir="/sdcard/Android/data/$PACKAGE/files"
    device_path="$device_dir/kpi-test-accounts.txt"

    adb_shell mkdir -p "$device_dir" >/dev/null 2>&1 || true
    if ! adb -s "$DEVICE" push "$ACCOUNTS_FILE" "$device_path" >/dev/null 2>&1; then
      echo "could not push the account list to $device_path" >&2
      exit 1
    fi

    start_app
    wait_for_js || { echo "app JS never started" >&2; exit 1; }
    sleep 3

    done_line=""
    if run_with_retry '\[debug-import-test-accounts\] done' \
      "rabbygo://go.rabby.io/mobile/debug-import-test-accounts?_cmd=debug-import-test-accounts&path=$device_path"; then
      done_line=$(adb -s "$DEVICE" logcat -d | grep -o '\[debug-import-test-accounts\] done.*' | tail -1)
    fi

    # Always drop the pushed copy; the app also deletes it after reading.
    adb_shell rm -f "$device_path" >/dev/null 2>&1 || true

    if [ -z "$done_line" ]; then
      echo "import did not report completion" >&2
      exit 1
    fi
    echo "$done_line"
    echo "settling for ${SETTLE_S}s so the imported accounts can fetch and persist"
    sleep "$SETTLE_S"
    ;;

  *)
    usage
    ;;
esac
