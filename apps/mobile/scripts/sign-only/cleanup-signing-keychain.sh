#!/usr/bin/env bash
# Restore the operator keychain search list and remove the ephemeral keychain
# created by prepare-signing-keychain.sh.
set -euo pipefail

KEYCHAIN_PATH="${1:?keychain path is required}"
ORIG_LIST_FILE="${2:-}"

if [ -n "$ORIG_LIST_FILE" ] && [ -f "$ORIG_LIST_FILE" ]; then
  ORIG=()
  while IFS= read -r line; do ORIG+=("$line"); done < "$ORIG_LIST_FILE"
  if [ "${#ORIG[@]}" -gt 0 ]; then
    security list-keychains -d user -s "${ORIG[@]}" 2>/dev/null || true
  fi
fi

if [ -e "$KEYCHAIN_PATH" ]; then
  security delete-keychain "$KEYCHAIN_PATH" 2>/dev/null || true
fi
