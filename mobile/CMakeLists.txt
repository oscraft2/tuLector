cmake_minimum_required(VERSION 3.10.2)
project(omr_engine)

add_library(omr_engine SHARED native/omr_engine.cpp)

target_include_directories(omr_engine PRIVATE native)

find_library(log-lib log)
target_link_libraries(omr_engine ${log-lib})

set_target_properties(omr_engine PROPERTIES
    CXX_STANDARD 17
    CXX_STANDARD_REQUIRED ON
)
