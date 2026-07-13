cmake_minimum_required(VERSION 3.9.0)
project(RabbyNativeFS)

set(PACKAGE_NAME "rabbynativefs")
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

add_library(
  ${PACKAGE_NAME}
  SHARED
  src/main/cpp/cpp-adapter.cpp
  ../cpp/RabbyNativeFS.cpp
)

include_directories(
  src/main/cpp
  ../cpp
)

find_library(LOG_LIB log)
find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)

target_link_libraries(
  ${PACKAGE_NAME}
  "-Wl,-z,max-page-size=16384"
  ${LOG_LIB}
  android
  fbjni::fbjni
  ReactAndroid::jsi
)

if(ReactAndroid_VERSION_MINOR GREATER_EQUAL 76)
  target_link_libraries(${PACKAGE_NAME} ReactAndroid::reactnative)
else()
  target_link_libraries(
    ${PACKAGE_NAME}
    ReactAndroid::react_nativemodule_core
    ReactAndroid::turbomodulejsijni
  )
endif()
