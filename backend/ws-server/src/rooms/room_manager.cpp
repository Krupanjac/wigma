#include "room_manager.h"

RoomManager::RoomManager(uint32_t max_rooms)
  : max_rooms_(max_rooms) {}

Room* RoomManager::get_or_create(const std::string& project_id) {
  std::lock_guard lock(mutex_);

  auto it = rooms_.find(project_id);
  if (it != rooms_.end()) {
    return it->second.get();
  }

  if (rooms_.size() >= max_rooms_) {
    return nullptr; // Limit reached
  }

  auto room = std::make_unique<Room>(project_id);
  auto* ptr = room.get();
  rooms_.emplace(project_id, std::move(room));
  return ptr;
}

Room* RoomManager::get(const std::string& project_id) {
  std::lock_guard lock(mutex_);
  auto it = rooms_.find(project_id);
  return it != rooms_.end() ? it->second.get() : nullptr;
}

void RoomManager::remove_if_empty(const std::string& project_id) {
  std::lock_guard lock(mutex_);
  auto it = rooms_.find(project_id);
  if (it != rooms_.end() && it->second->empty()) {
    rooms_.erase(it);
  }
}

size_t RoomManager::room_count() const {
  std::lock_guard lock(mutex_);
  return rooms_.size();
}

void RoomManager::for_each(const std::function<void(Room&)>& fn) {
  std::lock_guard lock(mutex_);
  for (auto& [id, room] : rooms_) {
    fn(*room);
  }
}
