#!/bin/bash
# Cold-start KPI collector for iOS Simulator builds.
#
# Mirrors collect.sh (Android): the metric is native process start -> first
# user-visible content frame, emitted by the StartupKpi native module through
# os_log on the `com.debank.rabby.startupkpi` subsystem.
#
# usage: collect-ios.sh --app a.app [--label name]
#                       [--app b.app [--label name]] --device <udid>
#                       [--bundle <id>] [--runs 5] [--wait 10] [--json out.json]
set -u

PACKAGE=${PACKAGE:-com.debank.rabbymobile.regression}
RUNS=${RUNS:-5}
WAIT_S=${WAIT_S:-10}
SUBSYSTEM=${SUBSYSTEM:-com.debank.rabby.startupkpi}
apps=()
app_labels=()
device=""
json_out=""

while [ $# -gt 0 ]; do
  case "$1" in
    --app) apps+=("$2"); app_labels+=(""); shift 2 ;;
    --label) app_labels[$((${#app_labels[@]} - 1))]="$2"; shift 2 ;;
    --device) device="$2"; shift 2 ;;
    --bundle) PACKAGE="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    --wait) WAIT_S="$2"; shift 2 ;;
    --json) json_out="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

[ ${#apps[@]} -gt 0 ] || { echo "--app is required" >&2; exit 64; }
[ -n "$device" ] || { echo "--device is required" >&2; exit 64; }

median() { printf '%s\n' "$@" | sort -n | awk '{a[NR]=$1} END {if(NR%2) print a[(NR+1)/2]; else print int((a[NR/2]+a[NR/2+1])/2)}'; }
minof() { printf '%s\n' "$@" | sort -n | head -1; }
maxof() { printf '%s\n' "$@" | sort -n | tail -1; }

json_packages=""
overall_status=0

for idx in "${!apps[@]}"; do
  app="${apps[$idx]}"
  label="${app_labels[$idx]:-$(basename "$app" .app)}"
  echo "=== $label ==="

  if ! xcrun simctl install "$device" "$app" >/dev/null 2>&1; then
    echo "  install failed for $app" >&2
    overall_status=1
    continue
  fi

  frames=(); routes=(); invalid=0

  for i in $(seq 1 "$RUNS"); do
    xcrun simctl terminate "$device" "$PACKAGE" >/dev/null 2>&1 || true
    sleep 3
    logfile=$(mktemp -t rabby-startup-kpi-ios)
    # Start the stream before launching so the first line cannot be missed.
    xcrun simctl spawn "$device" log stream --style compact \
      --predicate "subsystem == \"$SUBSYSTEM\"" > "$logfile" 2>/dev/null &
    stream_pid=$!
    sleep 2
    xcrun simctl launch "$device" "$PACKAGE" >/dev/null 2>&1
    sleep "$WAIT_S"
    kill "$stream_pid" >/dev/null 2>&1 || true
    wait "$stream_pid" 2>/dev/null || true

    line=$(grep -o 'first_content_frame native_ms=[0-9-]* route=[a-z]*' "$logfile" | head -1)
    if [ -z "$line" ]; then
      echo "  run$i INVALID (no first_content_frame marker; app never reached unlock/home)"
      invalid=$((invalid + 1))
      continue
    fi
    ms=$(printf '%s' "$line" | sed -E 's/.*native_ms=(-?[0-9]+).*/\1/')
    rt=$(printf '%s' "$line" | sed -E 's/.*route=([a-z]+).*/\1/')
    frames+=("$ms"); routes+=("$rt")
    echo "  run$i content=${ms}ms(native) route=$rt"
  done

  if [ ${#frames[@]} -eq 0 ]; then
    echo "  RESULT: INVALID - no valid runs for $label" >&2
    overall_status=2
    json_packages="$json_packages${json_packages:+,}{\"label\":\"$label\",\"app\":\"$app\",\"valid\":0,\"invalid\":$invalid,\"result\":\"INVALID\"}"
    continue
  fi

  routes_json=$(printf '%s\n' "${routes[@]}" | sort | uniq -c | awk '{printf "%s\"%s\":%d", (NR>1?",":""), $2, $1}')
  c_med=$(median "${frames[@]}"); c_min=$(minof "${frames[@]}"); c_max=$(maxof "${frames[@]}")
  echo "  ---- $label: content median=${c_med}ms (${c_min}-${c_max}) valid=${#frames[@]}/${RUNS} invalid=$invalid routes=$(printf '%s\n' "${routes[@]}" | sort | uniq -c | tr '\n' ' ')"
  json_packages="$json_packages${json_packages:+,}{\"label\":\"$label\",\"app\":\"$app\",\"valid\":${#frames[@]},\"invalid\":$invalid,\"result\":\"OK\",\"contentMedianMs\":${c_med},\"contentMinMs\":${c_min},\"contentMaxMs\":${c_max},\"routes\":{${routes_json}}}"
done

if [ -n "$json_out" ]; then
  cat > "$json_out" <<JSON
{"schemaVersion":1,"platform":"ios-simulator","device":"$device","pkg":"$PACKAGE","runs":$RUNS,"packages":[${json_packages}]}
JSON
  echo "json=$json_out"
fi

exit $overall_status
