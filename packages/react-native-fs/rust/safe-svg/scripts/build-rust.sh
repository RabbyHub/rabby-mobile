#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRATE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
PLATFORM="${1:-}"
SELECTOR="${2:-}"
OUTPUT="${3:-}"

if [[ -z "${PLATFORM}" || -z "${SELECTOR}" || -z "${OUTPUT}" ]]; then
  echo "usage: build-rust.sh android <abi> <output> | ios <platform>[:archs] <output>" >&2
  exit 2
fi

CARGO_BIN="${CARGO:-}"
if [[ -z "${CARGO_BIN}" ]]; then
  CARGO_BIN="$(command -v cargo || true)"
fi
if [[ -z "${CARGO_BIN}" && -x "${HOME}/.cargo/bin/cargo" ]]; then
  CARGO_BIN="${HOME}/.cargo/bin/cargo"
fi
if [[ -z "${CARGO_BIN}" || ! -x "${CARGO_BIN}" ]]; then
  echo "cargo is required to build Rabby Safe SVG (Rust 1.95.0)" >&2
  exit 1
fi

mkdir -p "$(dirname "${OUTPUT}")"
BUILD_ROOT="$(dirname "${OUTPUT}")/cargo-target"

build_target() {
  local rust_target="$1"
  local target_dir="${BUILD_ROOT}/${rust_target}"
  CARGO_TARGET_DIR="${target_dir}" \
    "${CARGO_BIN}" +1.95.0 build \
      --manifest-path "${CRATE_DIR}/Cargo.toml" \
      --release \
      --locked \
      --target "${rust_target}"
  printf '%s' "${target_dir}/${rust_target}/release/librabby_safe_svg.a"
}

if [[ "${PLATFORM}" == "android" ]]; then
  case "${SELECTOR}" in
    arm64-v8a) RUST_TARGET="aarch64-linux-android" ;;
    armeabi-v7a) RUST_TARGET="armv7-linux-androideabi" ;;
    x86) RUST_TARGET="i686-linux-android" ;;
    x86_64) RUST_TARGET="x86_64-linux-android" ;;
    *)
      echo "unsupported Android ABI for Rabby Safe SVG: ${SELECTOR}" >&2
      exit 2
      ;;
  esac
  cp "$(build_target "${RUST_TARGET}")" "${OUTPUT}"
  exit 0
fi

if [[ "${PLATFORM}" != "ios" ]]; then
  echo "unsupported platform for Rabby Safe SVG: ${PLATFORM}" >&2
  exit 2
fi

IOS_PLATFORM="${SELECTOR%%:*}"
IOS_ARCHS="${SELECTOR#*:}"
if [[ "${IOS_PLATFORM}" == "${IOS_ARCHS}" || -z "${IOS_ARCHS}" ]]; then
  echo "iOS build selector must be <platform>:<space-separated-archs>" >&2
  exit 2
fi

LIBRARIES=()
for arch in ${IOS_ARCHS}; do
  case "${IOS_PLATFORM}:${arch}" in
    iphoneos:arm64) RUST_TARGET="aarch64-apple-ios" ;;
    iphonesimulator:arm64) RUST_TARGET="aarch64-apple-ios-sim" ;;
    iphonesimulator:x86_64) RUST_TARGET="x86_64-apple-ios" ;;
    *)
      echo "unsupported iOS platform/arch for Rabby Safe SVG: ${IOS_PLATFORM}/${arch}" >&2
      exit 2
      ;;
  esac
  LIBRARIES+=("$(build_target "${RUST_TARGET}")")
done

if [[ "${#LIBRARIES[@]}" -eq 1 ]]; then
  cp "${LIBRARIES[0]}" "${OUTPUT}"
else
  xcrun lipo -create "${LIBRARIES[@]}" -output "${OUTPUT}"
fi
