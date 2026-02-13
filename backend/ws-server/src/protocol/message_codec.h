#pragma once
#include <string>
#include <string_view>
#include <cstdint>
#include <vector>

/**
 * WebSocket protocol message types.
 * Binary-first encoding for Yjs data, JSON for control messages.
 *
 * Binary frame layout:
 *   [1 byte: message type][N bytes: payload]
 *
 * Message type IDs:
 *   0x01 = yjs-sync     (server → client: full state)
 *   0x02 = yjs-update   (bidirectional: incremental update)
 *   0x03 = awareness    (bidirectional: cursor/presence)
 *
 * JSON control messages are sent as text frames.
 */

enum class MessageType : uint8_t {
  YjsSync     = 0x01,
  YjsUpdate   = 0x02,
  Awareness   = 0x03,
};

namespace MessageCodec {

  /** Encode binary payload with message type prefix. */
  std::string encode_binary(MessageType type, const uint8_t* data, size_t len);

  /** Decode message type from binary frame. Returns type and payload offset. */
  struct DecodedBinary {
    MessageType type;
    const uint8_t* payload;
    size_t payload_len;
    bool valid;
  };
  DecodedBinary decode_binary(const uint8_t* data, size_t len);

  /** Encode JSON control messages. */
  std::string encode_joined(std::string_view user_id, const std::vector<std::string>& peers);
  std::string encode_peer_joined(std::string_view user_id);
  std::string encode_peer_left(std::string_view user_id);
  std::string encode_error(std::string_view code, std::string_view message);
  std::string encode_pong();

  /** Decode JSON control message type. */
  struct ControlMessage {
    std::string type;
    std::string project_id;
    std::string token;
    bool valid;
  };
  ControlMessage decode_control(std::string_view json);

} // namespace MessageCodec
