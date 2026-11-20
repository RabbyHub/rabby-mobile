#!/bin/bash
# Cold-start KPI collector for Rabby Mobile Android packages.
#
# Measures, per cold start:
#   - am start -W TotalTime (first Android frame / splash; the old, blind metric)
#   - RabbyStartupKpi native_ms (native process start -> first content frame)
#   - [StartupKpi] js_ms (JS-side fallback for builds without the native module)
#   - "Fully drawn ..." when the app calls reportFullyDrawn()
#
# TotalTime only covers the splash window, so it cannot see work that happens
# between the first frame and the unlock/home surface. The native marker is the
# KPI we actually compare (it includes native start + bundle load + render).
#
# A run with no first_content_frame marker is INVALID: the app never reached a
# user-visible surface, so the number would not mean anything. The script fails
# instead of reporting a misleading "no difference".
#
# usage: collect.sh --apk a.apk [--label name] [--apk b.apk [--label name]]
#                   [--device <serial>|auto] [--pkg <applicationId>]
#                   [--runs 5] [--wait 8] [--json out.json]
set -u

export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
PKG=${PKG:-com.debank.rabbymobile.regression}
RUNS=${RUNS:-5}
WAIT_S=${WAIT_S:-8}
apks=()
apk_labels=()
device=""
json_out=""

while [ $# -gt 0 ]; do
  case "$1" in
    --apk) apks+=("$2"); apk_labels+=(""); shift 2 ;;
    # Names the package just given by --apk (default: the file name).
    --label) apk_labels[$((${#apk_labels[@]} - 1))]="$2"; shift 2 ;;
    --device) device="$2"; shift 2 ;;
    --pkg) PKG="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    --wait) WAIT_S="$2"; shift 2 ;;
    --json) json_out="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

[ ${#apks[@]} -gt 0 ] || { echo "--apk is required" >&2; exit 64; }

if [ -z "$device" ] || [ "$device" = "auto" ]; then
  device=$(adb devices | awk '$2 == "device" { print $1; exit }')
  [ -n "$device" ] || { echo "no connected android device" >&2; exit 3; }
fi
echo "device=$device pkg=$PKG runs=$RUNS"

median() { printf '%s\n' "$@" | sort -n | awk '{a[NR]=$1} END {if(NR%2) print a[(NR+1)/2]; else print int((a[NR/2]+a[NR/2+1])/2)}'; }
minof() { printf '%s\n' "$@" | sort -n | head -1; }
maxof() { printf '%s\n' "$@" | sort -n | tail -1; }

json_packages=""
overall_status=0

for idx in "${!apks[@]}"; do
  apk="${apks[$idx]}"
  label="${apk_labels[$idx]:-$(basename "$apk" .apk)}"
  echo "=== $label ==="
  if ! adb -s "$device" install -r "$apk" >/dev/null 2>&1; then
    echo "  install failed for $apk" >&2
    overall_status=1
    continue
  fi
  totals=(); frames=(); routes=(); drawn=(); invalid=0

  for i in $(seq 1 "$RUNS"); do
    adb -s "$device" shell am force-stop "$PKG"
    sleep 4
    adb -s "$device" logcat -c
    t=$(adb -s "$device" shell "am start -W -n '$PKG/com.debank.rabbymobile.MainActivity'" 2>/dev/null | tr -d '\r' | awk '/TotalTime/{print $2}')
    sleep "$WAIT_S"
    log=$(adb -s "$device" logcat -d 2>/dev/null)
    # Native marker is authoritative: it is emitted from the native module and
    # measures from Process.getStartElapsedRealtime(), so bundle load is
    # included. The JS marker is kept as a fallback for builds without it.
    f=$(printf '%s\n' "$log" | grep -oE 'RabbyStartupKpi: first_content_frame native_ms=[0-9]+ route=[a-z]+' | head -1)
    src=native
    if [ -z "$f" ]; then
      f=$(printf '%s\n' "$log" | grep -oE '\[StartupKpi\] first_content_frame js_ms=[0-9]+ route=[a-z]+' | head -1)
      src=js
    fi
    # logcat renders this as "+798ms" or "+1s401ms"; normalise to milliseconds.
    d=$(printf '%s\n' "$log" | sed -nE 's/.*Fully drawn [^:]*: \+(([0-9]+)s)?([0-9]+)ms.*/\2 \3/p' | head -1 | awk '{ if (NF == 2) print ($1 == "" ? 0 : $1 * 1000) + $2 }')
    if [ -z "$f" ]; then
      echo "  run$i INVALID (no first_content_frame marker; app never reached unlock/home)"
      invalid=$((invalid+1)); continue
    fi
    ms=$(printf '%s' "$f" | sed -E 's/.*(native_ms|js_ms)=([0-9]+).*/\2/')
    rt=$(printf '%s' "$f" | sed -E 's/.*route=([a-z]+).*/\1/')
    totals+=("${t:-0}"); frames+=("$ms"); routes+=("$rt"); [ -n "${d:-}" ] && drawn+=("$d")
    echo "  run$i total=${t}ms content=${ms}ms(${src}) route=$rt${d:+ fully_drawn=${d}ms}"
  done

  if [ ${#frames[@]} -eq 0 ]; then
    echo "  RESULT: INVALID - no valid runs for $label" >&2
    overall_status=2
    json_packages="$json_packages${json_packages:+,}{\"label\":\"$label\",\"apk\":\"$apk\",\"valid\":0,\"invalid\":$invalid,\"result\":\"INVALID\"}"
    continue
  fi

  routes_json=$(printf '%s\n' "${routes[@]}" | sort | uniq -c | awk '{printf "%s\"%s\":%d", (NR>1?",":""), $2, $1}')
  c_med=$(median "${frames[@]}"); c_min=$(minof "${frames[@]}"); c_max=$(maxof "${frames[@]}")
  t_med=$(median "${totals[@]}"); t_min=$(minof "${totals[@]}"); t_max=$(maxof "${totals[@]}")
  drawn_json="null"
  if [ ${#drawn[@]} -gt 0 ]; then
    drawn_json=$(median "${drawn[@]}")
  fi

  echo "  ---- $label: content median=${c_med}ms (${c_min}-${c_max}) total median=${t_med}ms (${t_min}-${t_max}) valid=${#frames[@]}/${RUNS} invalid=$invalid routes=$(printf '%s\n' "${routes[@]}" | sort | uniq -c | tr '\n' ' ')"

  json_packages="$json_packages${json_packages:+,}{\"label\":\"$label\",\"apk\":\"$apk\",\"valid\":${#frames[@]},\"invalid\":$invalid,\"result\":\"OK\",\"contentMedianMs\":${c_med},\"contentMinMs\":${c_min},\"contentMaxMs\":${c_max},\"totalMedianMs\":${t_med},\"totalMinMs\":${t_min},\"totalMaxMs\":${t_max},\"fullyDrawnMedianMs\":${drawn_json},\"routes\":{${routes_json}}}"
done

if [ -n "$json_out" ]; then
  cat > "$json_out" <<JSON
{"schemaVersion":1,"device":"$device","pkg":"$PKG","runs":$RUNS,"packages":[${json_packages}]}
JSON
  echo "json=$json_out"
fi

exit $overall_status
