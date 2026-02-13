#pragma once
#include <string>
#include <vector>
#include <unordered_map>
#include <unordered_set>
#include <functional>
#include <cstdint>

/**
 * Collaboration room — represents a single project's live editing session.
 *
 * Manages:
 *   - Peer set (connected user WebSocket pointers)
 *   - Yjs update broadcasting (fan-out to all peers except sender)
 *   - Awareness state relay (cursor positions, selections)
 *   - Accumulation of Yjs updates for persistence
 *
 * Design: Zero-copy broadcast — binary updates are forwarded as-is
 * without deserialization. The server is a pure relay; all CRDT
 * merging happens on the client side via Yjs.
 */

// Forward declaration — ws pointer is opaque at this level
struct PerSocketData;

class Room {
public:
  explicit Room(std::string project_id);

  const std::string& id() const { return project_id_; }
  size_t peer_count() const { return peers_.size(); }
  bool empty() const { return peers_.empty(); }

  /** Add a peer to the room. Returns false if already present. */
  bool add_peer(void* ws, const std::string& user_id);

  /** Remove a peer. Returns true if room is now empty. */
  bool remove_peer(void* ws);

  /** Get user ID for a socket. */
  std::string get_user_id(void* ws) const;

  /** Get all connected user IDs. */
  std::vector<std::string> get_peer_ids() const;

  /**
   * Broadcast a binary message to all peers except the sender.
   * @param sender Socket pointer of the sender (nullptr = broadcast to all)
   * @param data Binary message data
   * @param len Message length
   * @param send_fn Callback to actually send data through WebSocket
   */
  void broadcast(
    void* sender,
    const char* data,
    size_t len,
    const std::function<void(void* ws, const char* data, size_t len, bool is_binary)>& send_fn
  ) const;

  /**
   * Broadcast a text message to all peers except the sender.
   */
  void broadcast_text(
    void* sender,
    const std::string& message,
    const std::function<void(void* ws, const char* data, size_t len, bool is_binary)>& send_fn
  ) const;

private:
  std::string project_id_;

  // ws pointer → user_id mapping
  std::unordered_map<void*, std::string> peers_;
};
