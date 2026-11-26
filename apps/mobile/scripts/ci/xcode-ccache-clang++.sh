#!/bin/sh
# Compiler launcher for the iOS app target.
#
# ccache is a build accelerator, never a requirement: this wrapper resolves a
# usable ccache (project setting, PATH, then the usual Homebrew locations) and
# falls back to the real compiler when none is installed, so packaging on a
# machine without ccache still works.
#
# Usage: Xcode sets this as CC/LD (clang) or CXX/LDPLUSPLUS (clang++).
set -e

case "$(basename "$0")" in
  *clang++*) compiler=clang++ ;;
  *) compiler=clang ;;
esac

ccache_bin=''
if [ -n "${CCACHE_BINARY:-}" ] && [ -x "${CCACHE_BINARY}" ]; then
  ccache_bin="${CCACHE_BINARY}"
else
  for candidate in "$(command -v ccache 2>/dev/null || true)" \
    /opt/homebrew/bin/ccache /usr/local/bin/ccache; do
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      ccache_bin="$candidate"
      break
    fi
  done
fi

if [ -z "$ccache_bin" ]; then
  printf '[xcode-ccache] no ccache found; compiling with %s\n' "$compiler" >&2
  exec "$compiler" "$@"
fi

# Reuse React Native's ccache configuration when the dependency tree is
# installed; it only tunes sloppiness/dependency mode, so a missing file is fine.
if [ -z "${CCACHE_CONFIGPATH:-}" ]; then
  rn_conf="$(cd "$(dirname "$0")/../../node_modules/react-native/scripts/xcode" 2>/dev/null && pwd || true)/ccache.conf"
  if [ -f "$rn_conf" ]; then
    export CCACHE_CONFIGPATH="$rn_conf"
  fi
fi

exec "$ccache_bin" "$compiler" "$@"
