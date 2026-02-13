cmake_minimum_required(VERSION 3.20)
project(wigma-ws-server LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ── Options ──────────────────────────────────────────────────────────────────
option(BUILD_TESTS "Build unit tests" OFF)

# ── Dependencies (git submodules in deps/) ───────────────────────────────────

# uWebSockets (header-only, uses uSockets)
add_library(uSockets STATIC
  deps/uWebSockets/uSockets/src/bsd.c
  deps/uWebSockets/uSockets/src/context.c
  deps/uWebSockets/uSockets/src/loop.c
  deps/uWebSockets/uSockets/src/socket.c
  deps/uWebSockets/uSockets/src/eventing/epoll_kqueue.c
  deps/uWebSockets/uSockets/src/crypto/openssl.c
  deps/uWebSockets/uSockets/src/crypto/sni_tree.cpp
)
target_compile_definitions(uSockets PRIVATE LIBUS_USE_OPENSSL)
target_include_directories(uSockets PUBLIC deps/uWebSockets/uSockets/src)

find_package(OpenSSL REQUIRED)
find_package(ZLIB REQUIRED)
target_link_libraries(uSockets PUBLIC OpenSSL::SSL OpenSSL::Crypto ZLIB::ZLIB)

# uWebSockets headers
add_library(uWebSockets INTERFACE)
target_include_directories(uWebSockets INTERFACE deps/uWebSockets/src)
target_link_libraries(uWebSockets INTERFACE uSockets)

# nlohmann/json (header-only)
add_library(nlohmann_json INTERFACE)
target_include_directories(nlohmann_json INTERFACE deps/json/include)

# ── Main Server ──────────────────────────────────────────────────────────────

add_executable(wigma-ws-server
  src/main.cpp
  src/server/ws_server.cpp
  src/rooms/room.cpp
  src/rooms/room_manager.cpp
  src/auth/jwt_verifier.cpp
  src/persistence/yjs_persistence.cpp
  src/persistence/supabase_client.cpp
  src/protocol/message_codec.cpp
)

target_include_directories(wigma-ws-server PRIVATE src)
target_link_libraries(wigma-ws-server PRIVATE
  uWebSockets
  nlohmann_json
  pthread
)

# ── Install ──────────────────────────────────────────────────────────────────

install(TARGETS wigma-ws-server DESTINATION bin)
