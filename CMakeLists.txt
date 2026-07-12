cmake_minimum_required(VERSION 3.20)

project(
    fenrua_kernel
    VERSION 0.1.0
    DESCRIPTION "Deterministic Fenrua P/N521 arithmetic and research interfaces"
    LANGUAGES CXX
)

find_package(OpenSSL 3.0 REQUIRED COMPONENTS Crypto)

add_library(fenrua_kernel STATIC
    lib/p521_field_element.cpp
    lib/sha256_digest.cpp
    kernel/research_interfaces.cpp
    mesh/state_machine.cpp
)

add_library(fenrua::kernel ALIAS fenrua_kernel)

target_link_libraries(fenrua_kernel PUBLIC OpenSSL::Crypto)

target_compile_features(fenrua_kernel PUBLIC cxx_std_20)
target_include_directories(fenrua_kernel
    PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
)

set_target_properties(fenrua_kernel PROPERTIES
    CXX_EXTENSIONS OFF
    EXPORT_NAME kernel
    POSITION_INDEPENDENT_CODE ON
)

if(MSVC)
    target_compile_options(fenrua_kernel PRIVATE /W4 /permissive-)
else()
    target_compile_options(fenrua_kernel PRIVATE
        -Wall
        -Wextra
        -Wpedantic
        -Wconversion
        -Wsign-conversion
    )
endif()

include(GNUInstallDirs)
include(CMakePackageConfigHelpers)

install(TARGETS fenrua_kernel
    EXPORT fenrua_kernel_targets
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

install(DIRECTORY include/ DESTINATION ${CMAKE_INSTALL_INCLUDEDIR})

install(EXPORT fenrua_kernel_targets
    FILE fenrua_kernel_targets.cmake
    NAMESPACE fenrua::
    DESTINATION ${CMAKE_INSTALL_LIBDIR}/cmake/fenrua_kernel
)

configure_package_config_file(
    cmake/fenrua_kernelConfig.cmake.in
    "${CMAKE_CURRENT_BINARY_DIR}/fenrua_kernelConfig.cmake"
    INSTALL_DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/fenrua_kernel"
)

write_basic_package_version_file(
    "${CMAKE_CURRENT_BINARY_DIR}/fenrua_kernelConfigVersion.cmake"
    VERSION "${PROJECT_VERSION}"
    COMPATIBILITY SameMajorVersion
)

install(
    FILES
        "${CMAKE_CURRENT_BINARY_DIR}/fenrua_kernelConfig.cmake"
        "${CMAKE_CURRENT_BINARY_DIR}/fenrua_kernelConfigVersion.cmake"
    DESTINATION "${CMAKE_INSTALL_LIBDIR}/cmake/fenrua_kernel"
)

include(CTest)

if(BUILD_TESTING)
    add_executable(fenrua_kernel_tests tests/native_kernel_test.cpp)
    target_link_libraries(fenrua_kernel_tests PRIVATE fenrua::kernel)

    if(MSVC)
        target_compile_options(fenrua_kernel_tests PRIVATE /W4 /permissive-)
    else()
        target_compile_options(fenrua_kernel_tests PRIVATE
            -Wall
            -Wextra
            -Wpedantic
            -Wconversion
            -Wsign-conversion
        )
    endif()

    add_test(NAME fenrua_kernel_native COMMAND fenrua_kernel_tests)

    include(CheckIncludeFileCXX)
    check_include_file_cxx("boost/multiprecision/cpp_int.hpp" FENRUA_HAS_BOOST_CPP_INT)
    if(FENRUA_HAS_BOOST_CPP_INT)
        add_executable(
            fenrua_kernel_differential_tests
            tests/independent_pn521_differential.cpp
        )
        target_link_libraries(fenrua_kernel_differential_tests PRIVATE fenrua::kernel)
        add_test(
            NAME fenrua_kernel_differential
            COMMAND fenrua_kernel_differential_tests
        )
    else()
        message(WARNING "Boost.Multiprecision not found; differential test is unavailable")
    endif()
endif()
