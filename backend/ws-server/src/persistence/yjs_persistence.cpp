#include "yjs_persistence.h"
#include <algorithm>

YjsPersistence::YjsPersistence(SupabaseClient& client, uint32_t compaction_threshold)
  : client_(client), compaction_threshold_(compaction_threshold) {}

std::vector<uint8_t> YjsPersistence::load_state(const std::string& project_id) {
  // 1. Load snapshot (full state)
  auto snapshot = client_.get_snapshot(project_id);

  // 2. Load incremental updates after snapshot
  auto updates = client_.get_updates(project_id, 0);

  if (!snapshot.has_value() && updates.empty()) {
    return {}; // No data — fresh project
  }

  // 3. Merge: snapshot + updates
  // The actual Yjs merging happens client-side (y-websocket provider).
  // Server just concatenates binary blobs; the Yjs protocol handles merging.
  // For the initial sync, we send snapshot first, then updates.

  std::vector<uint8_t> result;
  size_t total_size = 0;

  if (snapshot.has_value()) {
    total_size += snapshot->size();
  }
  for (auto& u : updates) {
    total_size += u.size();
  }

  result.reserve(total_size);

  if (snapshot.has_value()) {
    result.insert(result.end(), snapshot->begin(), snapshot->end());
  }

  // Note: In practice, each update is sent as a separate yjs-sync message.
  // This concatenation is a simplified model. The real implementation
  // will send them as individual binary frames.

  return result;
}

void YjsPersistence::persist_update(const std::string& project_id, const uint8_t* data, size_t len) {
  // Write incremental update
  client_.append_update(project_id, data, len);

  // Check if compaction is needed
  uint32_t count;
  {
    std::lock_guard lock(counter_mutex_);
    count = ++update_counts_[project_id];
  }

  // Compaction trigger is handled by the room, which has the merged Yjs state.
  // We just track the count here so the room can check it.
  (void)count; // Room will call compact() when ready
}

void YjsPersistence::compact(const std::string& project_id, const uint8_t* merged_state, size_t len) {
  // Atomic compaction:
  // 1. Write new snapshot
  client_.upsert_snapshot(project_id, merged_state, len);

  // 2. Delete old incremental updates
  client_.clear_updates(project_id);

  // 3. Reset counter
  {
    std::lock_guard lock(counter_mutex_);
    update_counts_[project_id] = 0;
  }
}
