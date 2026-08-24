cmake_minimum_required(VERSION 3.18.1)
project(RabbyNativeOpenApi)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
  rabbynativeopenapi
  STATIC
  cpp/RabbyAddressCachePersistence.cpp
  cpp/RabbyOpenApiAssetSyncScheduler.cpp
  cpp/RabbyOpenApiAssetModels.cpp
  cpp/RabbyOpenApiClient.cpp
  cpp/RabbyOpenApiCredential.cpp
  cpp/RabbyOpenApiDiagnostic.cpp
  cpp/RabbyOpenApiNftSync.cpp
  cpp/RabbyOpenApiProtocolSync.cpp
  cpp/RabbyOpenApiRequest.cpp
  cpp/RabbyOpenApiSigning.cpp
  cpp/RabbyOpenApiTokenSync.cpp
  cpp/RabbyTokenCachePersistence.cpp
  cpp/RabbyTokenSnapshotCodec.cpp
  cpp/third_party/json11/json11.cpp
)

set(
  RABBY_NATIVE_HTTP_INCLUDE_DIR
  "${CMAKE_CURRENT_LIST_DIR}/../rabby-native-http/cpp/include"
  CACHE PATH
  "Path to Rabby Native HTTP public headers"
)

target_include_directories(
  rabbynativeopenapi
  PUBLIC
  cpp/include
  ${RABBY_NATIVE_HTTP_INCLUDE_DIR}
  PRIVATE
  cpp/third_party/json11
)

if(TARGET rabbynativehttp::rabbynativehttp)
  target_link_libraries(rabbynativeopenapi PUBLIC rabbynativehttp::rabbynativehttp)
elseif(TARGET rabbynativehttp)
  target_link_libraries(rabbynativeopenapi PUBLIC rabbynativehttp)
endif()

option(
  RABBY_NATIVE_OPENAPI_SIGNER_ENABLED
  "Link the optional private Rabby OpenAPI signer"
  ON
)
set(
  RABBY_NATIVE_OPENAPI_SIGNER_DIR
  "$ENV{RABBY_NATIVE_OPENAPI_SIGNER_DIR}"
  CACHE PATH
  "Path to the private Rabby Native OpenAPI signer package"
)
if(NOT RABBY_NATIVE_OPENAPI_SIGNER_DIR)
  set(_RABBY_NATIVE_OPENAPI_SIGNER_CANDIDATES
    "${CMAKE_CURRENT_LIST_DIR}/../../node_modules/@debank/rabby-native-openapi-signer"
    "${CMAKE_CURRENT_LIST_DIR}/../../../rabby-native-openapi-signer"
  )
  foreach(_RABBY_NATIVE_OPENAPI_SIGNER_CANDIDATE IN LISTS _RABBY_NATIVE_OPENAPI_SIGNER_CANDIDATES)
    if(EXISTS "${_RABBY_NATIVE_OPENAPI_SIGNER_CANDIDATE}/CMakeLists.txt")
      set(
        RABBY_NATIVE_OPENAPI_SIGNER_DIR
        "${_RABBY_NATIVE_OPENAPI_SIGNER_CANDIDATE}"
      )
      break()
    endif()
  endforeach()
endif()
if(
  RABBY_NATIVE_OPENAPI_SIGNER_ENABLED
  AND EXISTS "${RABBY_NATIVE_OPENAPI_SIGNER_DIR}/CMakeLists.txt"
)
  add_subdirectory(
    "${RABBY_NATIVE_OPENAPI_SIGNER_DIR}"
    "${CMAKE_CURRENT_BINARY_DIR}/private-openapi-signer"
  )
  target_compile_definitions(
    rabbynativeopenapi
    PRIVATE RABBY_NATIVE_OPENAPI_PRIVATE_SIGNER=1
  )
  target_link_libraries(
    rabbynativeopenapi
    PRIVATE rabby-native-openapi-signer::rabbynativeopenapisigner
  )
endif()
