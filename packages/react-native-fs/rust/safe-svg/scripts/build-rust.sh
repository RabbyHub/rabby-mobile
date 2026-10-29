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

# The Rust staticlib bundles its own copy of Rust std. Other prebuilt Rust
# libraries in the app (e.g. WalletConnect's libyttrium.a) bundle another one,
# so symbols like _rust_eh_personality would be defined twice at app link time
# (it only stays hidden when dead code stripping is on). Prelink into a single
# object that only exports the C API from include/rabby_safe_svg.h; every other
# symbol becomes local.
EXPORTED_SYMBOLS_FILE="${BUILD_ROOT}/exported_symbols.txt"
mkdir -p "${BUILD_ROOT}"
cat > "${EXPORTED_SYMBOLS_FILE}" <<'SYMBOLS'
_rabby_safe_svg_render_file
_rabby_safe_svg_sha256
SYMBOLS

case "${IOS_PLATFORM}" in
  iphoneos) LD_PLATFORM="ios" ;;
  iphonesimulator) LD_PLATFORM="ios-simulator" ;;
  *) LD_PLATFORM="" ;;
esac
IOS_MIN_VERSION="${IPHONEOS_DEPLOYMENT_TARGET:-12.4}"
IOS_SDK_VERSION="$(xcrun --sdk "${IOS_PLATFORM}" --show-sdk-version)"

# Called directly (not inside $(...)) so `set -e` stops the build on failure.
prelink_ios_library() {
  local arch="$1"
  local library="$2"
  local output="$3"
  local object="${output%.a}.o"
  mkdir -p "$(dirname "${output}")"
  xcrun ld -r \
    -arch "${arch}" \
    -platform_version "${LD_PLATFORM}" "${IOS_MIN_VERSION}" "${IOS_SDK_VERSION}" \
    -all_load \
    -exported_symbols_list "${EXPORTED_SYMBOLS_FILE}" \
    "${library}" \
    -o "${object}"
  rm -f "${output}"
  xcrun libtool -static -o "${output}" "${object}"
}

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
  build_target "${RUST_TARGET}" >/dev/null
  RUST_LIBRARY="${BUILD_ROOT}/${RUST_TARGET}/${RUST_TARGET}/release/librabby_safe_svg.a"
  PRELINKED_LIBRARY="${BUILD_ROOT}/prelinked/${RUST_TARGET}/librabby_safe_svg.a"
  prelink_ios_library "${arch}" "${RUST_LIBRARY}" "${PRELINKED_LIBRARY}"
  LIBRARIES+=("${PRELINKED_LIBRARY}")
done

if [[ "${#LIBRARIES[@]}" -eq 1 ]]; then
  cp "${LIBRARIES[0]}" "${OUTPUT}"
else
  xcrun lipo -create "${LIBRARIES[@]}" -output "${OUTPUT}"
fi
