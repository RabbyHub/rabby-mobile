#!/usr/bin/env bash
# Xcode compilation cache (LLVM CAS) for the iOS builds.
#
# Swift and Clang compilations are content-addressed: a changed source, flag,
# compiler or module dependency misses, everything else is reused. The CAS is
# kept outside the temporary DerivedData so it survives across CI runs; Xcode
# evicts nothing on its own, so prune this directory (or the whole build-cache
# root) when it grows.
#
# Usage: rabby_ios_compilation_cache_xcargs   -> prints xcodebuild/gym xcargs
set -uo pipefail

rabby_ios_compilation_cache_xcargs() {
  local root="${RABBY_MOBILE_TURBO_LOCAL_CACHE_ROOT:-$HOME/Library/Caches/rabby-mobile/build-cache}"
  local cas="$root/swift-cas"
  mkdir -p "$cas" 2>/dev/null || true
  printf 'COMPILATION_CACHE_ENABLE_CACHING=YES COMPILATION_CACHE_KEEP_CAS_DIRECTORY=YES COMPILATION_CACHE_CAS_PATH=%s' "$cas"
}
