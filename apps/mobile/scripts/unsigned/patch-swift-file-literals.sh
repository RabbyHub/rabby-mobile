#!/usr/bin/env bash
# Replace `#file` / `#filePath` with `#fileID` in vendored Swift sources.
#
# Swift bakes the absolute path of the source file into `#file` / `#filePath`
# literals and no compiler flag remaps them, which forces every builder of an
# artifact to use the same absolute checkout path. The affected call sites here
# only use the value in log/assert messages (`file: StaticString = #file`), and
# `#fileID` yields the stable `Module/File.swift` form.
#
# Usage: patch-swift-file-literals.sh [--check] [<pod dir>...]
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
project_dir="$(cd "$script_dir/../.." && pwd)"

check_only=false
roots=()
for arg in "$@"; do
  case "$arg" in
    --check) check_only=true ;;
    *) roots+=("$arg") ;;
  esac
done
if [ "${#roots[@]}" -eq 0 ]; then
  roots=(
    "$project_dir/ios/Pods/MultiplatformBleAdapter"
    "$project_dir/ios/Pods/Sentry"
  )
fi

total=0
for root in "${roots[@]}"; do
  [ -d "$root" ] || continue
  files=$(grep -rlE '#file(Path)?[^A-Za-z]' --include='*.swift' "$root" 2>/dev/null || true)
  [ -n "$files" ] || continue
  count=$(printf '%s\n' "$files" | wc -l | tr -d ' ')
  total=$((total + count))
  if [ "$check_only" = true ]; then
    echo "[swift-literals] ${root#"$project_dir"/}: $count file(s) still use #file"
    continue
  fi
  printf '%s\n' "$files" | while IFS= read -r file; do
    perl -pi -e 's/#filePath\b/#fileID/g; s/#file\b(?![A-Za-z])/#fileID/g' "$file"
  done
  echo "[swift-literals] ${root#"$project_dir"/}: rewrote $count file(s)"
done

if [ "$total" -eq 0 ]; then
  echo "[swift-literals] nothing to do"
elif [ "$check_only" = true ]; then
  exit 1
fi
