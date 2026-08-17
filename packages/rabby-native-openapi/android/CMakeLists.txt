cmake_minimum_required(VERSION 3.18.1)
project(RabbyNativeOpenApiAndroid)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
  rabbynativeopenapi
  SHARED
  src/main/cpp/AndroidOpenApiRuntime.cpp
  ../cpp/RabbyAddressCachePersistence.cpp
  ../cpp/RabbyOpenApiAssetModels.cpp
  ../cpp/RabbyOpenApiClient.cpp
  ../cpp/RabbyOpenApiCredential.cpp
  ../cpp/RabbyOpenApiDiagnostic.cpp
  ../cpp/RabbyOpenApiNftSync.cpp
  ../cpp/RabbyOpenApiProtocolSync.cpp
  ../cpp/RabbyOpenApiRequest.cpp
  ../cpp/RabbyOpenApiSigning.cpp
  ../cpp/RabbyOpenApiTokenSync.cpp
  ../cpp/RabbyTokenCachePersistence.cpp
  ../cpp/RabbyTokenSnapshotCodec.cpp
  ../cpp/third_party/json11/json11.cpp
)

target_include_directories(
  rabbynativeopenapi
  PRIVATE
  ../cpp/include
  ../cpp/third_party/json11
)

find_package(rabby-native-http REQUIRED CONFIG)
find_library(LOG_LIB log)

target_link_options(
  rabbynativeopenapi
  PRIVATE
  "-Wl,-z,max-page-size=16384"
)

target_link_libraries(
  rabbynativeopenapi
  rabby-native-http::rabbynativehttp
  ${LOG_LIB}
)
