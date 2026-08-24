cmake_minimum_required(VERSION 3.18.1)
project(RabbyNativeHttp)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
  rabbynativehttp
  SHARED
  src/main/cpp/AndroidHttpClient.cpp
  src/main/cpp/AndroidHttpRuntime.cpp
  ../cpp/RabbyHttpTypes.cpp
)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
  target_sources(
    rabbynativehttp
    PRIVATE
    src/debug/cpp/NativeHttpTestHarness.cpp
  )
endif()

target_include_directories(
  rabbynativehttp
  PUBLIC
  ../cpp/include
  PRIVATE
  src/main/cpp
)

find_library(LOG_LIB log)

target_link_options(
  rabbynativehttp
  PRIVATE
  "-Wl,-z,max-page-size=16384"
)

target_link_libraries(
  rabbynativehttp
  ${LOG_LIB}
)
