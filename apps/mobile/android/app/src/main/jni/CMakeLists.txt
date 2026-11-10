cmake_minimum_required(VERSION 3.13)
project(appmodules)

if(RABBY_NEW_ARCH_ENABLED)
    # Keep RN's default OnLoad and generated module registration. Do not place
    # .cpp files beside this file: RN treats those as an OnLoad override.
    include(${REACT_ANDROID_DIR}/cmake-utils/ReactNative-application.cmake)
endif()

if(RABBY_HERMES_ENABLED)
    find_package(hermes-engine REQUIRED CONFIG)
    find_package(ReactAndroid REQUIRED CONFIG)
    add_library(rabby_hermes_profiler SHARED profiler/RabbyHermesProfiler.cpp)
    target_compile_features(rabby_hermes_profiler PRIVATE cxx_std_20)
    target_link_libraries(rabby_hermes_profiler
        hermes-engine::libhermes ReactAndroid::jsi)
endif()
