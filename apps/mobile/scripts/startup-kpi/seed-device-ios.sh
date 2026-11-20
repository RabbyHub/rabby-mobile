#!/bin/bash
# Seeds an iOS Simulator install for the cold-start KPI.
#
# The simulator cannot open our URL scheme without the iOS "Open in ...?"
# prompt, so the debug deeplinks are delivered as launch arguments instead (the
# app only consumes them in non-production builds):
#
#   seed-device-ios.sh create-address   --device <udid> [--bundle <id>]
#   seed-device-ios.sh import-accounts  --device <udid> --file <host file>
#                                       [--bundle <id>] [--settle 35]
#
# create-address assumes a fresh (never seeded) simulator: it always creates the
# first wallet, so do not run it twice on the same device.
set -u

BUNDLE=${BUNDLE:-com.debank.rabby-mobile-regression}
SCHEME=${SCHEME:-rabbygo-regression}
DEVICE=""
ACCOUNTS_FILE=""
SETTLE_S=${SETTLE_S:-35}
WAIT_S=${WAIT_S:-180}

usage() {
  echo "usage: $0 {create-address|import-accounts} --device <udid> [--bundle <id>] [--file <path>] [--settle <s>]" >&2
  exit 64
}

CMD=${1:-}
[ -n "$CMD" ] || usage
shift

while [ $# -gt 0 ]; do
  case "$1" in
    --device) DEVICE="$2"; shift 2 ;;
    --bundle) BUNDLE="$2"; shift 2 ;;
    --file) ACCOUNTS_FILE="$2"; shift 2 ;;
    --settle) SETTLE_S="$2"; shift 2 ;;
    *) usage ;;
  esac
done

[ -n "$DEVICE" ] || usage

start_with_deeplink() {
  # $1 = deeplink url
  xcrun simctl terminate "$DEVICE" "$BUNDLE" >/dev/null 2>&1 || true
  sleep 1
  started_at=$(date "+%Y-%m-%d %H:%M:%S")
  xcrun simctl launch "$DEVICE" "$BUNDLE" -rabby-deeplink "$1" >/dev/null 2>&1
}

wait_for_log() {
  # $1 = grep pattern, $2 = timeout seconds
  local pattern="$1" timeout=${2:-$WAIT_S}
  local deadline=$((SECONDS + timeout))
  while [ $SECONDS -lt $deadline ]; do
    if xcrun simctl spawn "$DEVICE" log show --start "$started_at" \
      --style compact --predicate "process == \"RabbyMobile\"" 2>/dev/null \
      | grep -qE "$pattern"; then
      return 0
    fi
    sleep 3
  done
  return 1
}

case "$CMD" in
  create-address)
    start_with_deeplink "$SCHEME://go.rabby.io/mobile/debug-create-address?_cmd=debug-create-address"
    # Release-like iOS builds drop console.log, so the app mirrors the same
    # completion into the unified log as an automation marker.
    if wait_for_log 'automation_marker name=debug-create-address.done'; then
      echo "create-address done"
      exit 0
    fi
    echo "create-address did not report completion" >&2
    echo "  hint: the app must be a non-production build from a branch carrying the debug-create-address deeplink" >&2
    exit 1
    ;;

  import-accounts)
    [ -n "$ACCOUNTS_FILE" ] && [ -f "$ACCOUNTS_FILE" ] || {
      echo "--file is required" >&2
      exit 64
    }
    container=$(xcrun simctl get_app_container "$DEVICE" "$BUNDLE" data 2>/dev/null || true)
    if [ -z "$container" ] || [ ! -d "$container" ]; then
      echo "could not resolve the app data container for $BUNDLE" >&2
      exit 1
    fi
    device_path="$container/Documents/kpi-test-accounts.txt"
    mkdir -p "$container/Documents"
    if ! cp "$ACCOUNTS_FILE" "$device_path"; then
      echo "could not copy the account list into $device_path" >&2
      exit 1
    fi

    start_with_deeplink "$SCHEME://go.rabby.io/mobile/debug-import-test-accounts?_cmd=debug-import-test-accounts&path=$device_path"
    done_line=""
    if wait_for_log 'automation_marker name=debug-import-test-accounts.done'; then
      done_line=$(xcrun simctl spawn "$DEVICE" log show --start "$started_at" \
        --style compact --predicate "process == \"RabbyMobile\"" 2>/dev/null \
        | grep -o 'automation_marker name=debug-import-test-accounts.done.*' | tail -1)
    fi
    rm -f "$device_path" 2>/dev/null || true
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
