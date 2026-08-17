cmake_minimum_required(VERSION 3.18.1)
project(RabbyNativeOpenApi)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
  rabbynativeopenapi
  STATIC
  cpp/RabbyAddressCachePersistence.cpp
  cpp/RabbyOpenApiAssetModels.cpp
  cpp/RabbyOpenApiClient.cpp
  cpp/RabbyOpenApiCredential.cpp
  cpp/RabbyOpenApiDiagnostic.cpp
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
