#include "ws_server.h"
#include <App.h>   // uWebSockets
#include <iostream>
#include <cstring>

WsServer::WsServer(const Config& config)
  : config_(config)
  , room_manager_(config.max_rooms)
  , jwt_verifier_(config.jwt_secret)
  , supabase_client_(config.supabase_url, config.supabase_service_key)
  , persistence_(supabase_client_) {}

void WsServer::run() {
  running_ = true;

  uWS::App()
    .ws<PerSocketData>("/*", {
      .compression    = uWS::SHARED_COMPRESSOR,
      .maxPayloadLength = 16 * 1024 * 1024,  // 16 MB max message
      .idleTimeout    = 120,
      .maxBackpressure = 1024 * 1024,

      .open = [](auto* ws) {
        // Socket opened — wait for "join" message before allowing data
        auto* data = ws->getUserData();
        data->authenticated = false;
      },

      .message = [this](auto* ws, std::string_view message, uWS::OpCode opCode) {
        auto* data = ws->getUserData();

        if (opCode == uWS::OpCode::TEXT) {
          on_text_message(static_cast<void*>(ws), data, message);
        } else if (opCode == uWS::OpCode::BINARY) {
          on_binary_message(
            static_cast<void*>(ws), data,
            reinterpret_cast<const uint8_t*>(message.data()),
            message.size()
          );
        }
      },

      .close = [this](auto* ws, int /*code*/, std::string_view /*message*/) {
        auto* data = ws->getUserData();
        on_close(static_cast<void*>(ws), data);
      }
    })
    .listen(config_.port, [this](auto* listen_socket) {
      if (listen_socket) {
        std::cout << "[wigma-ws] Listening on port " << config_.port << std::endl;
      } else {
        std::cerr << "[wigma-ws] Failed to listen on port " << config_.port << std::endl;
        running_ = false;
      }
    })
    .run();
}

void WsServer::stop() {
  running_ = false;
  // uWebSockets will exit run() when the loop is drained
}

void WsServer::on_text_message(void* ws, PerSocketData* data, std::string_view message) {
  auto msg = MessageCodec::decode_control(message);
  if (!msg.valid) return;

  // Handle "ping" from any state
  if (msg.type == "ping") {
    auto pong = MessageCodec::encode_pong();
    auto* typed_ws = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(ws);
    typed_ws->send(pong, uWS::OpCode::TEXT);
    return;
  }

  // Handle "join" — authenticate and enter room
  if (msg.type == "join" && !data->authenticated) {
    // 1. Verify JWT
    auto claims = jwt_verifier_.verify(msg.token);
    if (!claims.has_value()) {
      auto err = MessageCodec::encode_error("AUTH_FAILED", "Invalid or expired token");
      auto* typed_ws = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(ws);
      typed_ws->send(err, uWS::OpCode::TEXT);
      typed_ws->close();
      return;
    }

    // 2. Check project access
    if (!supabase_client_.check_project_access(msg.project_id, claims->sub)) {
      auto err = MessageCodec::encode_error("ACCESS_DENIED", "No access to this project");
      auto* typed_ws = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(ws);
      typed_ws->send(err, uWS::OpCode::TEXT);
      typed_ws->close();
      return;
    }

    // 3. Join room
    auto* room = room_manager_.get_or_create(msg.project_id);
    if (!room) {
      auto err = MessageCodec::encode_error("ROOM_LIMIT", "Server room limit reached");
      auto* typed_ws = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(ws);
      typed_ws->send(err, uWS::OpCode::TEXT);
      typed_ws->close();
      return;
    }

    data->user_id    = claims->sub;
    data->project_id = msg.project_id;
    data->authenticated = true;
    room->add_peer(ws, claims->sub);

    // 4. Send "joined" confirmation
    auto peers  = room->get_peer_ids();
    auto joined = MessageCodec::encode_joined(claims->sub, peers);
    auto* typed_ws = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(ws);
    typed_ws->send(joined, uWS::OpCode::TEXT);

    // 5. Notify other peers
    auto peer_joined = MessageCodec::encode_peer_joined(claims->sub);
    room->broadcast_text(ws, peer_joined, [](void* peer_ws, const char* d, size_t len, bool) {
      auto* typed = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(peer_ws);
      typed->send(std::string_view(d, len), uWS::OpCode::TEXT);
    });

    // 6. Send initial Yjs state
    auto state = persistence_.load_state(msg.project_id);
    if (!state.empty()) {
      auto sync_msg = MessageCodec::encode_binary(
        MessageType::YjsSync, state.data(), state.size());
      typed_ws->send(sync_msg, uWS::OpCode::BINARY);
    }

    std::cout << "[wigma-ws] User " << claims->sub
              << " joined room " << msg.project_id
              << " (" << room->peer_count() << " peers)" << std::endl;
    return;
  }
}

void WsServer::on_binary_message(void* ws, PerSocketData* data,
                                  const uint8_t* payload, size_t len) {
  if (!data->authenticated) return;

  auto decoded = MessageCodec::decode_binary(payload, len);
  if (!decoded.valid) return;

  auto* room = room_manager_.get(data->project_id);
  if (!room) return;

  // Broadcast to all peers (zero-copy relay)
  room->broadcast(ws, reinterpret_cast<const char*>(payload), len,
    [](void* peer_ws, const char* d, size_t l, bool) {
      auto* typed = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(peer_ws);
      typed->send(std::string_view(d, l), uWS::OpCode::BINARY);
    });

  // Persist Yjs updates (not awareness)
  if (decoded.type == MessageType::YjsUpdate) {
    persistence_.persist_update(data->project_id, decoded.payload, decoded.payload_len);
  }
}

void WsServer::on_close(void* ws, PerSocketData* data) {
  if (!data->authenticated) return;

  auto* room = room_manager_.get(data->project_id);
  if (!room) return;

  std::string user_id = data->user_id;
  std::string project_id = data->project_id;

  bool empty = room->remove_peer(ws);

  // Notify remaining peers
  if (!empty) {
    auto left_msg = MessageCodec::encode_peer_left(user_id);
    room->broadcast_text(nullptr, left_msg, [](void* peer_ws, const char* d, size_t l, bool) {
      auto* typed = static_cast<uWS::WebSocket<false, true, PerSocketData>*>(peer_ws);
      typed->send(std::string_view(d, l), uWS::OpCode::TEXT);
    });
  }

  // Clean up empty room
  if (empty) {
    room_manager_.remove_if_empty(project_id);
  }

  std::cout << "[wigma-ws] User " << user_id
            << " left room " << project_id << std::endl;
}
