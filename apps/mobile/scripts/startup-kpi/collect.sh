#!/bin/bash
# Cold-start KPI collector for Rabby Mobile Android packages.
#
# Measures, per cold start:
#   - am start -W TotalTime (first Android frame / splash)
#   - [StartupKpi] first_content_frame (unlock or home, first one wins)
#   - "Fully drawn ..." when the app calls reportFullyDrawn()
#
# A run with no first_content_frame marker is INVALID: the app never reached a
# user-visible surface, so the number would not mean anything. The script fails
# instead of reporting a misleading "no difference".
#
# usage: collect.sh --apk a.apk [--apk b.apk] --device <serial> [--runs 5]
set -u

export PATH="$PATH:$HOME/Library/Android/sdk/platform-tools"
PKG=${PKG:-com.debank.rabbymobile.regression}
RUNS=${RUNS:-5}
WAIT_S=${WAIT_S:-8}
apks=()
device=""

while [ $# -gt 0 ]; do
  case "$1" in
    --apk) apks+=("$2"); shift 2 ;;
    --device) device="$2"; shift 2 ;;
    --runs) RUNS="$2"; shift 2 ;;
    --wait) WAIT_S="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

[ ${#apks[@]} -gt 0 ] || { echo "--apk is required" >&2; exit 64; }
[ -n "$device" ] || { echo "--device is required" >&2; exit 64; }

median() { printf '%s\n' "$@" | sort -n | awk '{a[NR]=$1} END {if(NR%2) print a[(NR+1)/2]; else print int((a[NR/2]+a[NR/2+1])/2)}'; }

for apk in "${apks[@]}"; do
  label=$(basename "$apk" .apk)
  echo "=== $label ==="
  adb -s "$device" install -r "$apk" >/dev/null 2>&1 || { echo "install failed" >&2; exit 1; }
  totals=(); frames=(); routes=(); drawn=(); invalid=0

  for i in $(seq 1 "$RUNS"); do
    adb -s "$device" shell am force-stop "$PKG"
    sleep 4
    adb -s "$device" logcat -c
    t=$(adb -s "$device" shell "am start -W -n $PKG/com.debank.rabbymobile.MainActivity" 2>/dev/null | tr -d '\r' | awk '/TotalTime/{print $2}')
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
    d=$(printf '%s\n' "$log" | grep -oE 'Fully drawn [^:]*: \+[0-9]+ms' | grep -oE '[0-9]+ms' | tr -d 'ms' | head -1)
    if [ -z "$f" ]; then
      echo "  run$i INVALID (no first_content_frame marker; app never reached unlock/home)"
      invalid=$((invalid+1)); continue
    fi
    ms=$(printf '%s' "$f" | sed -E 's/.*(native_ms|js_ms)=([0-9]+).*/\2/')
    rt=$(printf '%s' "$f" | sed -E 's/.*route=([a-z]+).*/\1/')
    totals+=("$t"); frames+=("$ms"); routes+=("$rt"); [ -n "$d" ] && drawn+=("$d")
    echo "  run$i total=${t}ms content=${ms}ms(${src}) route=$rt${d:+ fully_drawn=${d}ms}"
  done

  if [ ${#frames[@]} -eq 0 ]; then
    echo "  RESULT: INVALID - no valid runs for $label" >&2
    exit 2
  fi
  echo "  ---- $label: content median=$(median "${frames[@]}")ms  total median=$(median "${totals[@]}")ms  valid=${#frames[@]}/${RUNS} invalid=$invalid routes=$(printf '%s\n' "${routes[@]}" | sort | uniq -c | tr '\n' ' ')"
done
