#pragma once
#include "supabase_client.h"
#include <string>
#include <vector>
#include <cstdint>
#include <mutex>

/**
 * Yjs CRDT persistence layer.
 *
 * Manages incremental update accumulation and periodic snapshot compaction.
 * Each room accumulates binary Yjs updates in memory and flushes to Supabase
 * on a timer or when the update count exceeds a threshold.
 *
 * Compaction strategy:
 *   1. Accumulate incremental updates (small, fast writes)
 *   2. When count > threshold OR timer fires:
 *      a. Merge all updates into a single state vector (snapshot)
 *      b. Write snapshot atomically
 *      c. Delete old incremental updates
 */
class YjsPersistence {
public:
  explicit YjsPersistence(SupabaseClient& client, uint32_t compaction_threshold = 100);

  /**
   * Load full state for a project: snapshot + any updates after it.
   * Returns merged binary state, or empty vector if no data exists.
   */
  std::vector<uint8_t> load_state(const std::string& project_id);

  /**
   * Persist an incremental Yjs update.
   * Triggers compaction if threshold is reached.
   */
  void persist_update(const std::string& project_id, const uint8_t* data, size_t len);

  /**
   * Force compaction: merge all updates into snapshot.
   * Called periodically or on room close.
   */
  void compact(const std::string& project_id, const uint8_t* merged_state, size_t len);

private:
  SupabaseClient& client_;
  uint32_t compaction_threshold_;

  // Per-project update counter (for compaction trigger)
  std::mutex counter_mutex_;
  std::unordered_map<std::string, uint32_t> update_counts_;
};
