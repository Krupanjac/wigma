#pragma once
#include <string>
#include <string_view>
#include <vector>
#include <functional>
#include <optional>

/**
 * Minimal Supabase REST client for server-side operations.
 * Uses service-role key for direct DB access (bypasses RLS).
 * Connects via HTTPS to Supabase REST API.
 */
class SupabaseClient {
public:
  SupabaseClient(std::string url, std::string service_key);

  struct Response {
    int status_code;
    std::string body;
    bool ok() const { return status_code >= 200 && status_code < 300; }
  };

  // ── Yjs Persistence ────────────────────────────────────────────────────

  /** Fetch the latest Yjs snapshot for a project. */
  std::optional<std::vector<uint8_t>> get_snapshot(std::string_view project_id);

  /** Upsert (insert or update) a Yjs snapshot. */
  bool upsert_snapshot(std::string_view project_id, const uint8_t* data, size_t len);

  /** Fetch all Yjs incremental updates after a given ID. */
  std::vector<std::vector<uint8_t>> get_updates(std::string_view project_id, int64_t after_id = 0);

  /** Append a Yjs incremental update. */
  bool append_update(std::string_view project_id, const uint8_t* data, size_t len);

  /** Delete all updates for a project (after snapshot compaction). */
  bool clear_updates(std::string_view project_id);

  // ── Auth Helpers ──────────────────────────────────────────────────────

  /** Check if a user has access to a project (project_users row exists). */
  bool check_project_access(std::string_view project_id, std::string_view user_id);

private:
  std::string url_;
  std::string service_key_;

  /** Perform an HTTP request to Supabase REST API. */
  Response request(
    std::string_view method,
    std::string_view path,
    std::string_view body = "",
    const std::vector<std::pair<std::string, std::string>>& headers = {}
  );
};
