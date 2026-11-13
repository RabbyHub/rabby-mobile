#!/usr/bin/env bash
# Ensures a usable ccache for the native parts of a mobile build.
#
# Resolution order:
#   1. a ccache already on PATH, if it is at least RABBY_MOBILE_CCACHE_VERSION
#   2. the managed bundle previously unpacked under RABBY_MOBILE_CCACHE_ROOT
#   3. the managed bundle published in S3
#      s3://$RABBY_MOBILE_BUILD_BUCKET/_private/toolchains/ccache/<version>/<platform>.tar.gz
#      (plus a .sha256 next to it). natively built and signed by us, no
#      third-party package manager involved.
#
# When none of those work the behaviour depends on RABBY_MOBILE_CCACHE_STRICT:
#   true (default in CI)  fail the build with an actionable message
#   false                 warn and continue without ccache
#
# On success it exports CCACHE_BIN, CCACHE_DIR, CCACHE_MAXSIZE and prepends the
# binary to PATH (and to GITHUB_ENV/GITHUB_PATH when running in Actions).
set -euo pipefail

MIN_VERSION="${RABBY_MOBILE_CCACHE_MIN_VERSION:-4.8.0}"
VERSION="${RABBY_MOBILE_CCACHE_VERSION:-4.14.3}"
BUCKET="${RABBY_MOBILE_BUILD_BUCKET:-}"
ROOT="${RABBY_MOBILE_CCACHE_ROOT:-$HOME/.cache/rabby-mobile/ccache}"
STRICT="${RABBY_MOBILE_CCACHE_STRICT:-true}"
MAX_SIZE="${RABBY_MOBILE_CCACHE_MAX_SIZE:-10G}"

# Diagnostics go to stderr: stdout is reserved for resolved paths.
log() { printf '[ccache] %s\n' "$*" >&2; }

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"
  case "$os" in
    Darwin)
      case "$arch" in
        arm64) echo 'darwin-arm64' ;;
        x86_64) echo 'darwin-x86_64' ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64) echo 'linux-x86_64' ;;
        aarch64|arm64) echo 'linux-aarch64' ;;
      esac
      ;;
  esac
}

version_at_least() {
  # $1 = found version, $2 = required version
  [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -1)" = "$2" ]
}

current_ccache() {
  local bin
  bin="$(command -v ccache 2>/dev/null || true)"
  [ -n "$bin" ] || return 1
  local found
  found="$("$bin" --version 2>/dev/null | head -1 | awk '{print $3}')"
  [ -n "$found" ] || return 1
  if version_at_least "$found" "$MIN_VERSION"; then
    printf '%s' "$bin"
    return 0
  fi
  log "found ccache $found at $bin, but $VERSION or newer is required"
  return 1
}

managed_bundle_dir() {
  local platform="$1"
  printf '%s/%s/%s' "$ROOT" "$VERSION" "$platform"
}

install_managed() {
  local platform="$1" dir bundle sha_url sha_file
  dir="$(managed_bundle_dir "$platform")"
  if [ -x "$dir/bin/ccache" ]; then
    printf '%s' "$dir/bin/ccache"
    return 0
  fi

  bundle="ccache-$VERSION-$platform.tar.gz"
  if [ -z "$BUCKET" ]; then
    return 1
  fi
  if ! command -v aws >/dev/null 2>&1; then
    log 'aws CLI is unavailable; cannot download the managed bundle'
    return 1
  fi

  mkdir -p "$ROOT/$VERSION"
  CCACHE_TMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/rabby-ccache-XXXXXX")"
  local tmp="$CCACHE_TMP_DIR"

  log "downloading managed ccache $VERSION for $platform"
  aws s3 cp "s3://$BUCKET/_private/toolchains/ccache/$VERSION/$platform.tar.gz" \
    "$tmp/$bundle" --only-show-errors
  aws s3 cp "s3://$BUCKET/_private/toolchains/ccache/$VERSION/$platform.tar.gz.sha256" \
    "$tmp/$bundle.sha256" --only-show-errors

  local expected actual
  expected="$(awk '{print $1}' "$tmp/$bundle.sha256")"
  actual="$(shasum -a 256 "$tmp/$bundle" 2>/dev/null | awk '{print $1}' \
    || sha256sum "$tmp/$bundle" | awk '{print $1}')"
  if [ -z "$expected" ] || [ "$expected" != "$actual" ]; then
    log "checksum mismatch for $bundle (expected ${expected:-none}, got $actual)"
    return 1
  fi

  rm -rf "$dir"
  mkdir -p "$dir"
  tar -C "$dir" -xzf "$tmp/$bundle"
  if [ ! -x "$dir/bin/ccache" ]; then
    log "managed bundle did not contain bin/ccache"
    return 1
  fi
  printf '%s' "$dir/bin/ccache"
}

resolve_ccache() {
  local platform bin
  platform="$(detect_platform)"
  if [ -z "$platform" ]; then
    log "unsupported platform: $(uname -s) $(uname -m)"
    return 1
  fi
  if bin="$(current_ccache)"; then
    printf '%s' "$bin"
    return 0
  fi
  install_managed "$platform"
}

CCACHE_TMP_DIR=''
trap 'if [ -n "${CCACHE_TMP_DIR:-}" ]; then rm -rf "$CCACHE_TMP_DIR"; fi' EXIT

bin="$(resolve_ccache || true)"
if [ -z "$bin" ]; then
  if [ "$STRICT" = "true" ]; then
    log "no usable ccache (>= $MIN_VERSION) was found and the managed bundle could not be installed."
    log "Provide a managed bundle at s3://${BUCKET:-<bucket>}/_private/toolchains/ccache/$VERSION/<platform>.tar.gz,"
    log "install ccache locally, or set RABBY_MOBILE_CCACHE_STRICT=false to build without it."
    exit 1
  fi
  log 'continuing without ccache (RABBY_MOBILE_CCACHE_STRICT=false)'
  exit 0
fi

BIN_DIR="$(dirname "$bin")"
export PATH="$BIN_DIR:$PATH"
export CCACHE_BIN="$bin"
export CCACHE_DIR="${CCACHE_DIR:-$ROOT/cache}"
export CCACHE_MAXSIZE="$MAX_SIZE"
export CCACHE_COMPRESS="${CCACHE_COMPRESS:-true}"
export CCACHE_COMPILERCHECK="${CCACHE_COMPILERCHECK:-content}"
mkdir -p "$CCACHE_DIR"

log "using $bin"
"$bin" --version | head -1

if [ -n "${GITHUB_ENV:-}" ]; then
  {
    echo "CCACHE_BIN=$CCACHE_BIN"
    echo "CCACHE_DIR=$CCACHE_DIR"
    echo "CCACHE_MAXSIZE=$CCACHE_MAXSIZE"
    echo "CCACHE_COMPRESS=$CCACHE_COMPRESS"
    echo "CCACHE_COMPILERCHECK=$CCACHE_COMPILERCHECK"
    echo "RABBY_MOBILE_CCACHE_BIN=$CCACHE_BIN"
  } >> "$GITHUB_ENV"
fi
if [ -n "${GITHUB_PATH:-}" ]; then
  echo "$BIN_DIR" >> "$GITHUB_PATH"
fi
