#!/usr/bin/env bash
set -euo pipefail

PACKAGE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HTTP_PACKAGE_DIR="$(cd "$PACKAGE_DIR/../rabby-native-http" && pwd)"
BUILD_DIR="$PACKAGE_DIR/.build"

mkdir -p "$BUILD_DIR"

COMMON_ARGS=(
  -std=c++17
  -Wall
  -Wextra
  -Werror
  -I"$PACKAGE_DIR/cpp/include"
  -I"$HTTP_PACKAGE_DIR/cpp/include"
  -I"$PACKAGE_DIR/cpp/third_party/json11"
  "$HTTP_PACKAGE_DIR/cpp/RabbyHttpTypes.cpp"
  "$PACKAGE_DIR/cpp/RabbyAddressCachePersistence.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiAssetModels.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiClient.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiCredential.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiDiagnostic.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiNftSync.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiProtocolSync.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiRequest.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiSigning.cpp"
  "$PACKAGE_DIR/cpp/RabbyOpenApiTokenSync.cpp"
  "$PACKAGE_DIR/cpp/RabbyTokenCachePersistence.cpp"
  "$PACKAGE_DIR/cpp/RabbyTokenSnapshotCodec.cpp"
  "$PACKAGE_DIR/cpp/third_party/json11/json11.cpp"
)

if [[ "${RABBY_NATIVE_OPENAPI_SANITIZE:-}" == "1" ]]; then
  COMMON_ARGS+=(
    -g
    -O0
    -fsanitize=address,undefined
    -fno-omit-frame-pointer
  )
fi

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiRequestTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-request-test"

"$BUILD_DIR/rabby-openapi-request-test"

PRIVATE_SIGNER_DIR="${RABBY_NATIVE_OPENAPI_SIGNER_DIR:-}"
if [[ -z "$PRIVATE_SIGNER_DIR" ]]; then
  for PRIVATE_SIGNER_CANDIDATE in \
    "$PACKAGE_DIR/../../node_modules/@debank/rabby-native-openapi-signer" \
    "$PACKAGE_DIR/../../../rabby-native-openapi-signer"; do
    if [[ -f "$PRIVATE_SIGNER_CANDIDATE/cpp/RabbyNativeOpenApiSigner.cpp" ]]; then
      PRIVATE_SIGNER_DIR="$PRIVATE_SIGNER_CANDIDATE"
      break
    fi
  done
fi
if [[ "${RABBY_NATIVE_OPENAPI_SIGNER_ENABLED:-1}" != "0" ]] &&
  [[ -f "$PRIVATE_SIGNER_DIR/cpp/RabbyNativeOpenApiSigner.cpp" ]]; then
  EXPECTED_SIGNER_VERSION="$(
    node -p \
      "require('$PACKAGE_DIR/package.json').peerDependencies['@debank/rabby-native-openapi-signer']"
  )"
  ACTUAL_SIGNER_VERSION="$(
    node -p "require('$PRIVATE_SIGNER_DIR/package.json').version"
  )"
  if [[ "$ACTUAL_SIGNER_VERSION" != "$EXPECTED_SIGNER_VERSION" ]]; then
    echo "Private signer version mismatch: expected $EXPECTED_SIGNER_VERSION, got $ACTUAL_SIGNER_VERSION" >&2
    exit 1
  fi

  "${CXX:-c++}" \
    "${COMMON_ARGS[@]}" \
    -DRABBY_NATIVE_OPENAPI_PRIVATE_SIGNER=1 \
    -I"$PRIVATE_SIGNER_DIR/cpp/include" \
    "$PRIVATE_SIGNER_DIR/cpp/RabbyNativeOpenApiSigner.cpp" \
    "$PRIVATE_SIGNER_DIR/cpp/Sha256.cpp" \
    "$PACKAGE_DIR/cpp/tests/RabbyOpenApiRequestTest.cpp" \
    -o "$BUILD_DIR/rabby-openapi-request-private-signer-test"

  "$BUILD_DIR/rabby-openapi-request-private-signer-test"
fi

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiCredentialTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-credential-test"

"$BUILD_DIR/rabby-openapi-credential-test"

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiClientTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-client-test"

"$BUILD_DIR/rabby-openapi-client-test"

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiAssetModelsTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-asset-models-test"

"$BUILD_DIR/rabby-openapi-asset-models-test"

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyAddressCachePersistenceTest.cpp" \
  -o "$BUILD_DIR/rabby-address-cache-persistence-test"

"$BUILD_DIR/rabby-address-cache-persistence-test"

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiTokenSyncTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-token-sync-test"

"$BUILD_DIR/rabby-openapi-token-sync-test"

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiProtocolSyncTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-protocol-sync-test"

"$BUILD_DIR/rabby-openapi-protocol-sync-test"

"${CXX:-c++}" \
  "${COMMON_ARGS[@]}" \
  "$PACKAGE_DIR/cpp/tests/RabbyOpenApiNftSyncTest.cpp" \
  -o "$BUILD_DIR/rabby-openapi-nft-sync-test"

"$BUILD_DIR/rabby-openapi-nft-sync-test"
