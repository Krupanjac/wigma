#pragma once
#include "room.h"
#include <string>
#include <unordered_map>
#include <memory>
#include <mutex>
#include <functional>
#include <cstdint>

/**
 * Room manager — owns all active collaboration rooms.
 *
 * Thread-safe (mutex-guarded) since uWebSockets may call from
 * the event loop thread. Rooms are lazily created on first join
 * and destroyed when the last peer leaves.
 *
 * Lookup is O(1) via unordered_map with project_id as key.
 */
class RoomManager {
public:
  explicit RoomManager(uint32_t max_rooms = 1024);

  /**
   * Get or create a room for the given project.
   * Returns nullptr if max_rooms limit is reached.
   */
  Room* get_or_create(const std::string& project_id);

  /**
   * Get an existing room. Returns nullptr if not found.
   */
  Room* get(const std::string& project_id);

  /**
   * Remove a room if it's empty.
   * Called after a peer leaves and room.empty() is true.
   */
  void remove_if_empty(const std::string& project_id);

  /** Number of active rooms. */
  size_t room_count() const;

  /** Iterate over all rooms (for periodic tasks like compaction). */
  void for_each(const std::function<void(Room&)>& fn);

private:
  uint32_t max_rooms_;
  mutable std::mutex mutex_;
  std::unordered_map<std::string, std::unique_ptr<Room>> rooms_;
};
