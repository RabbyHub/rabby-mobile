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

deep_link() {
  # $1 = device path (optional)
  local path="$1" url
  # Always drive the command through `_cmd`: the path prefix differs per build
  # type (/mobile-debug/, /mobile-regression/, /mobile/), the command does not.
  if [ -n "$path" ]; then
    url="rabbygo://go.rabby.io/mobile/debug-import-test-accounts?_cmd=debug-import-test-accounts&path=$path"
  else
    url="rabbygo://go.rabby.io/mobile/debug-create-address?_cmd=debug-create-address"
  fi
  # Quote for the device shell, or everything after '&' would be dropped.
  adb -s "$DEVICE" shell \
    "am start -a android.intent.action.VIEW -d '$url' -n $PACKAGE/com.debank.rabbymobile.MainActivity" \
    >/dev/null 2>&1
}

wait_for_js() {
  local i
  for i in $(seq 1 30); do
    adb -s "$DEVICE" logcat -d | grep -q 'Running "RabbyMobile"' && return 0
    sleep 2
  done
  return 1
}

onboarding_visible() {
  adb -s "$DEVICE" shell uiautomator dump /sdcard/startup-kpi-onboarding.xml >/dev/null 2>&1 || true
  adb -s "$DEVICE" shell cat /sdcard/startup-kpi-onboarding.xml 2>/dev/null | grep -q 'Welcome to'
}

case "$CMD" in
  ensure-address)
    # A wiped device boots into onboarding; a physical device that already has
    # a wallet must not get a second one.
    if ! onboarding_visible; then
      echo "wallet already present, skipping create-address"
      exit 0
    fi
    exec "$0" create-address --device "$DEVICE" --pkg "$PACKAGE"
    ;;

  create-address)
    # The workflow installs the package before seeding.
    adb -s "$DEVICE" shell am force-stop "$PACKAGE"
    adb -s "$DEVICE" shell am start -n "$PACKAGE/com.debank.rabbymobile.MainActivity" >/dev/null 2>&1
    wait_for_js || { echo "app JS never started" >&2; exit 1; }
    adb -s "$DEVICE" logcat -c
    deep_link ""
    for _ in $(seq 1 60); do
      sleep 2
      if adb -s "$DEVICE" logcat -d | grep -q '\[debug-create-address\] done'; then
        echo "create-address done"
        exit 0
      fi
    done
    echo "create-address did not report completion" >&2
    exit 1
    ;;

  import-accounts)
    [ -n "$ACCOUNTS_FILE" ] && [ -f "$ACCOUNTS_FILE" ] || {
      echo "--file is required" >&2
      exit 64
    }
    device_dir="/sdcard/Android/data/$PACKAGE/files"
    device_path="$device_dir/kpi-test-accounts.txt"

    adb -s "$DEVICE" shell mkdir -p "$device_dir" >/dev/null 2>&1 || true
    if ! adb -s "$DEVICE" push "$ACCOUNTS_FILE" "$device_path" >/dev/null 2>&1; then
      echo "could not push the account list to $device_path" >&2
      exit 1
    fi

    adb -s "$DEVICE" shell am force-stop "$PACKAGE"
    adb -s "$DEVICE" shell am start -n "$PACKAGE/com.debank.rabbymobile.MainActivity" >/dev/null 2>&1
    wait_for_js || { echo "app JS never started" >&2; exit 1; }
    adb -s "$DEVICE" logcat -c
    deep_link "$device_path"

    deadline=$((SECONDS + WAIT_S))
    done_line=""
    while [ $SECONDS -lt $deadline ]; do
      done_line=$(adb -s "$DEVICE" logcat -d | grep -o '\[debug-import-test-accounts\] done.*' | tail -1)
      [ -n "$done_line" ] && break
      sleep 3
    done
    # Always drop the pushed copy; the app also deletes it after reading.
    adb -s "$DEVICE" shell rm -f "$device_path" >/dev/null 2>&1 || true

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
