cmake_minimum_required(VERSION 3.20)
project(fenrua_kernel_consumer LANGUAGES CXX)

find_package(fenrua_kernel CONFIG REQUIRED)

add_executable(fenrua_kernel_consumer main.cpp)
target_link_libraries(fenrua_kernel_consumer PRIVATE fenrua::kernel)
target_compile_features(fenrua_kernel_consumer PRIVATE cxx_std_20)
