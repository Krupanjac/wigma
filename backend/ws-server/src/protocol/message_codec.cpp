#include "message_codec.h"
#include <nlohmann/json.hpp>
#include <cstring>

using json = nlohmann::json;

namespace MessageCodec {

std::string encode_binary(MessageType type, const uint8_t* data, size_t len) {
  std::string out(1 + len, '\0');
  out[0] = static_cast<char>(type);
  std::memcpy(out.data() + 1, data, len);
  return out;
}

DecodedBinary decode_binary(const uint8_t* data, size_t len) {
  if (len < 1) {
    return { MessageType::YjsSync, nullptr, 0, false };
  }
  return {
    static_cast<MessageType>(data[0]),
    data + 1,
    len - 1,
    true
  };
}

std::string encode_joined(std::string_view user_id, const std::vector<std::string>& peers) {
  json j;
  j["type"]   = "joined";
  j["userId"] = user_id;
  j["peers"]  = peers;
  return j.dump();
}

std::string encode_peer_joined(std::string_view user_id) {
  json j;
  j["type"]   = "peer-joined";
  j["userId"] = user_id;
  return j.dump();
}

std::string encode_peer_left(std::string_view user_id) {
  json j;
  j["type"]   = "peer-left";
  j["userId"] = user_id;
  return j.dump();
}

std::string encode_error(std::string_view code, std::string_view message) {
  json j;
  j["type"]    = "error";
  j["code"]    = code;
  j["message"] = message;
  return j.dump();
}

std::string encode_pong() {
  return R"({"type":"pong"})";
}

ControlMessage decode_control(std::string_view text) {
  try {
    auto j = json::parse(text);
    ControlMessage msg;
    msg.type       = j.value("type", "");
    msg.project_id = j.value("projectId", "");
    msg.token      = j.value("token", "");
    msg.valid      = !msg.type.empty();
    return msg;
  } catch (...) {
    return { "", "", "", false };
  }
}

} // namespace MessageCodec
