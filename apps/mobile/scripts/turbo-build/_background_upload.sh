#!/bin/sh

set -e

local_dir="$1"
remote_path="$2"
upload_marker="$3"
upload_log="$4"
shift 4

tmp_archive=$(mktemp "${TMPDIR:-/tmp}/rabby-turbo-save-bg.XXXXXX")

cleanup() {
  rm -f "$upload_marker" "$tmp_archive"
}

trap cleanup EXIT INT TERM

printf '%s\n' "$$" >"$upload_marker"
printf '[%s] start upload to %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$remote_path" >"$upload_log"

if tar -cf "$tmp_archive" -C "$local_dir" "$@"; then
  :
else
  status=$?
  printf '[%s] archive failed with status %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$status" >>"$upload_log"
  exit "$status"
fi

if aws s3 cp "$tmp_archive" "$remote_path" --only-show-errors >/dev/null; then
  printf '[%s] upload completed\n' "$(date '+%Y-%m-%d %H:%M:%S')" >>"$upload_log"
else
  status=$?
  printf '[%s] upload failed with status %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$status" >>"$upload_log"
  exit "$status"
fi
