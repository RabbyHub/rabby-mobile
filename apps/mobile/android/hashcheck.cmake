# 不要 .so 中的 build_id
# 这会确保我们的链接器标志有最高优先级
set(CMAKE_SHARED_LINKER_FLAGS "${CMAKE_SHARED_LINKER_FLAGS} -Wl,--build-id=none" CACHE STRING "Force linker flags for reproducible builds" FORCE)
