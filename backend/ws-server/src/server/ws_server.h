#pragma once
#include "rooms/room_manager.h"
#include "auth/jwt_verifier.h"
#include "persistence/yjs_persistence.h"
#include "persistence/supabase_client.h"
#include "protocol/message_codec.h"
#include "config.h"
#include <string>
#include <functional>

/**
 * Per-socket user data stored by uWebSockets.
 * Allocated on ws open, freed on ws close.
 */
struct PerSocketData {
  std::string user_id;
  std::string project_id;
  bool authenticated = false;
};

/**
 * WebSocket server — ties together all subsystems.
 *
 * Architecture:
 *   1. Client connects via WebSocket
 *   2. Client sends JSON "join" message with project ID + JWT token
 *   3. Server verifies JWT, checks project access, joins room
 *   4. Server sends initial Yjs state (loaded from Supabase)
 *   5. All subsequent binary frames are Yjs updates/awareness → broadcast
 *   6. On disconnect, peer is removed; if room empty, persist + destroy room
 *
 * Single-threaded event loop (uWebSockets) — no locking needed for I/O,
 * only RoomManager uses a mutex for safety with potential timer callbacks.
 */
class WsServer {
public:
  explicit WsServer(const Config& config);

  /** Start the event loop (blocking). */
  void run();

  /** Request graceful shutdown. */
  void stop();

private:
  Config config_;
  RoomManager room_manager_;
  JwtVerifier jwt_verifier_;
  SupabaseClient supabase_client_;
  YjsPersistence persistence_;
  bool running_ = false;

  /** Handle incoming text message (JSON control). */
  void on_text_message(void* ws, PerSocketData* data, std::string_view message);

  /** Handle incoming binary message (Yjs data). */
  void on_binary_message(void* ws, PerSocketData* data, const uint8_t* payload, size_t len);

  /** Handle peer disconnect. */
  void on_close(void* ws, PerSocketData* data);
};
