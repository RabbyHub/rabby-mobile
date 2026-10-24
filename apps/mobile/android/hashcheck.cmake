# This preload file is only injected by the hashcheck Gradle configuration.
function(rabby_hashcheck_append_flag variable flag)
    # -C also runs when an existing CMake build is reconfigured.
    string(FIND " ${${variable}} " " ${flag} " flag_index)
    if(flag_index EQUAL -1)
        set(${variable} "${${variable}} ${flag}" CACHE STRING "Hashcheck flags" FORCE)
    endif()
endfunction()

rabby_hashcheck_append_flag(CMAKE_SHARED_LINKER_FLAGS "-Wl,--build-id=none")

function(rabby_hashcheck_map_path variable destination)
    if(NOT DEFINED ${variable} OR "${${variable}}" STREQUAL "")
        message(FATAL_ERROR "Hashcheck requires ${variable} before loading hashcheck.cmake")
    endif()

    # Keep both spellings: include paths may preserve a symlink such as /tmp,
    # while the compiler/debug information can use its resolved /private/tmp.
    get_filename_component(absolute_path "${${variable}}" ABSOLUTE)
    get_filename_component(real_path "${${variable}}" REALPATH)
    set(source_paths "${absolute_path}" "${real_path}")
    list(REMOVE_DUPLICATES source_paths)
    foreach(source_path IN LISTS source_paths)
        # __FILE__ from RN's Prefab headers is present in runtime .rodata too.
        # A debug-only prefix map would leave those strings machine-dependent.
        string(REPLACE "\\" "\\\\" escaped_path "${source_path}")
        string(REPLACE "\"" "\\\"" escaped_path "${escaped_path}")
        set(flag "\"-ffile-prefix-map=${escaped_path}=${destination}\"")
        rabby_hashcheck_append_flag(CMAKE_C_FLAGS "${flag}")
        rabby_hashcheck_append_flag(CMAKE_CXX_FLAGS "${flag}")
    endforeach()
endfunction()

rabby_hashcheck_map_path(RABBY_HASHCHECK_SOURCE_ROOT /rabby-mobile)
rabby_hashcheck_map_path(RABBY_HASHCHECK_GRADLE_USER_HOME /gradle)
