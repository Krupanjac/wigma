#include "room.h"

Room::Room(std::string project_id)
  : project_id_(std::move(project_id)) {}

bool Room::add_peer(void* ws, const std::string& user_id) {
  auto [it, inserted] = peers_.emplace(ws, user_id);
  return inserted;
}

bool Room::remove_peer(void* ws) {
  peers_.erase(ws);
  return peers_.empty();
}

std::string Room::get_user_id(void* ws) const {
  auto it = peers_.find(ws);
  return it != peers_.end() ? it->second : "";
}

std::vector<std::string> Room::get_peer_ids() const {
  std::vector<std::string> ids;
  ids.reserve(peers_.size());
  for (auto& [ws, uid] : peers_) {
    ids.push_back(uid);
  }
  return ids;
}

void Room::broadcast(
    void* sender,
    const char* data,
    size_t len,
    const std::function<void(void* ws, const char* data, size_t len, bool is_binary)>& send_fn) const {
  for (auto& [ws, uid] : peers_) {
    if (ws != sender) {
      send_fn(ws, data, len, true);
    }
  }
}

void Room::broadcast_text(
    void* sender,
    const std::string& message,
    const std::function<void(void* ws, const char* data, size_t len, bool is_binary)>& send_fn) const {
  for (auto& [ws, uid] : peers_) {
    if (ws != sender) {
      send_fn(ws, message.data(), message.size(), false);
    }
  }
}
