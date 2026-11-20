#!/bin/bash
# Answers "is this commit already in develop?" for a measured package.
#
# A baseline package is only a meaningful baseline when it comes from the
# shared development branch; a package built from a feature branch measures
# that branch, not what everyone else ships. The workflow warns (it does not
# fail) so a deliberate comparison is still possible.
#
# usage: commit-on-develop.sh --commit <hash> [--base-ref origin/develop]
# prints JSON on stdout:
#   {"commit":"cbe7765f","resolved":"cbe7765f...","onDevelop":true|false|null}
# `null` means the object is not in this clone, so it cannot be decided.
set -u

COMMIT=""
BASE_REF=${BASE_REF:-origin/develop}

while [ $# -gt 0 ]; do
  case "$1" in
    --commit) COMMIT="$2"; shift 2 ;;
    --base-ref) BASE_REF="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 64 ;;
  esac
done

[ -n "$COMMIT" ] || { echo "--commit is required" >&2; exit 64; }

FULL=$(git rev-parse --verify --quiet "${COMMIT}^{commit}" 2>/dev/null || true)

if [ -z "$FULL" ]; then
  printf '{"commit":"%s","resolved":null,"onDevelop":null,"reason":"commit-not-in-clone"}\n' "$COMMIT"
  exit 0
fi

if ! git rev-parse --verify --quiet "${BASE_REF}^{commit}" >/dev/null 2>&1; then
  printf '{"commit":"%s","resolved":"%s","onDevelop":null,"reason":"base-ref-missing"}\n' "$COMMIT" "$FULL"
  exit 0
fi

if git merge-base --is-ancestor "$FULL" "$BASE_REF"; then
  printf '{"commit":"%s","resolved":"%s","onDevelop":true,"baseRef":"%s"}\n' "$COMMIT" "$FULL" "$BASE_REF"
else
  printf '{"commit":"%s","resolved":"%s","onDevelop":false,"baseRef":"%s"}\n' "$COMMIT" "$FULL" "$BASE_REF"
fi
