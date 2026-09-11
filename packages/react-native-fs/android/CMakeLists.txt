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
  ../cpp/RabbySafeMedia.cpp
)

find_program(BASH_EXECUTABLE bash REQUIRED)
if(DEFINED ENV{CARGO} AND EXISTS "$ENV{CARGO}")
  set(CARGO_EXECUTABLE "$ENV{CARGO}")
else()
  find_program(
    CARGO_EXECUTABLE
    cargo
    HINTS "$ENV{CARGO_HOME}/bin" "$ENV{HOME}/.cargo/bin"
    REQUIRED
  )
endif()

set(SAFE_SVG_CRATE_DIR "${CMAKE_CURRENT_LIST_DIR}/../rust/safe-svg")
set(SAFE_SVG_LIBRARY "${CMAKE_CURRENT_BINARY_DIR}/rust/${ANDROID_ABI}/librabby_safe_svg.a")
add_custom_command(
  OUTPUT "${SAFE_SVG_LIBRARY}"
  COMMAND
    ${CMAKE_COMMAND} -E env "CARGO=${CARGO_EXECUTABLE}"
    "${BASH_EXECUTABLE}"
    "${SAFE_SVG_CRATE_DIR}/scripts/build-rust.sh"
    android
    "${ANDROID_ABI}"
    "${SAFE_SVG_LIBRARY}"
  DEPENDS
    "${SAFE_SVG_CRATE_DIR}/Cargo.toml"
    "${SAFE_SVG_CRATE_DIR}/Cargo.lock"
    "${SAFE_SVG_CRATE_DIR}/rust-toolchain.toml"
    "${SAFE_SVG_CRATE_DIR}/src/lib.rs"
    "${SAFE_SVG_CRATE_DIR}/include/rabby_safe_svg.h"
    "${SAFE_SVG_CRATE_DIR}/scripts/build-rust.sh"
  VERBATIM
)
add_custom_target(rabby_safe_svg_build DEPENDS "${SAFE_SVG_LIBRARY}")
add_library(rabby_safe_svg STATIC IMPORTED GLOBAL)
set_target_properties(
  rabby_safe_svg
  PROPERTIES IMPORTED_LOCATION "${SAFE_SVG_LIBRARY}"
)
add_dependencies(${PACKAGE_NAME} rabby_safe_svg_build)

include_directories(
  src/main/cpp
  ../cpp
  ../rust/safe-svg/include
)

find_library(LOG_LIB log)
find_package(fbjni REQUIRED CONFIG)
find_package(ReactAndroid REQUIRED CONFIG)

target_link_libraries(
  ${PACKAGE_NAME}
  "-Wl,-z,max-page-size=16384"
  ${LOG_LIB}
  android
  rabby_safe_svg
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
