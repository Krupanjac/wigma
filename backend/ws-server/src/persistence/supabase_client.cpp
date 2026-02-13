#include "supabase_client.h"
#include <nlohmann/json.hpp>
#include <sstream>
#include <stdexcept>

using json = nlohmann::json;

SupabaseClient::SupabaseClient(std::string url, std::string service_key)
  : url_(std::move(url)), service_key_(std::move(service_key)) {}

// ── Placeholder HTTP implementation ──────────────────────────────────────────
// TODO: Replace with libcurl or a proper HTTP client.
// For now, these methods define the API contract and data flow.

SupabaseClient::Response SupabaseClient::request(
    std::string_view /*method*/,
    std::string_view /*path*/,
    std::string_view /*body*/,
    const std::vector<std::pair<std::string, std::string>>& /*headers*/) {
  // Stub — will be implemented with libcurl
  return { 501, R"({"error":"not implemented"})" };
}

std::optional<std::vector<uint8_t>> SupabaseClient::get_snapshot(std::string_view project_id) {
  std::string path = "/rest/v1/yjs_snapshots?project_id=eq." + std::string(project_id) + "&select=snapshot";
  auto resp = request("GET", path);
  if (!resp.ok()) return std::nullopt;

  try {
    auto arr = json::parse(resp.body);
    if (arr.empty()) return std::nullopt;

    // Supabase returns bytea as base64 in JSON (or hex depending on config)
    auto& data_str = arr[0]["snapshot"].get_ref<const std::string&>();
    std::vector<uint8_t> result(data_str.begin(), data_str.end());
    return result;
  } catch (...) {
    return std::nullopt;
  }
}

bool SupabaseClient::upsert_snapshot(std::string_view project_id, const uint8_t* data, size_t len) {
  json body;
  body["project_id"] = project_id;
  // Encode as base64 for Supabase bytea column
  body["snapshot"]   = std::string(reinterpret_cast<const char*>(data), len);

  auto resp = request("POST", "/rest/v1/yjs_snapshots",
    body.dump(),
    {{"Prefer", "resolution=merge-duplicates"}});
  return resp.ok();
}

std::vector<std::vector<uint8_t>> SupabaseClient::get_updates(std::string_view project_id, int64_t after_id) {
  std::string path = "/rest/v1/yjs_updates?project_id=eq." + std::string(project_id)
    + "&id=gt." + std::to_string(after_id)
    + "&order=id.asc&select=data";

  auto resp = request("GET", path);
  std::vector<std::vector<uint8_t>> updates;

  if (!resp.ok()) return updates;

  try {
    auto arr = json::parse(resp.body);
    updates.reserve(arr.size());
    for (auto& row : arr) {
      auto& s = row["data"].get_ref<const std::string&>();
      updates.emplace_back(s.begin(), s.end());
    }
  } catch (...) {}

  return updates;
}

bool SupabaseClient::append_update(std::string_view project_id, const uint8_t* data, size_t len) {
  json body;
  body["project_id"] = project_id;
  body["data"]       = std::string(reinterpret_cast<const char*>(data), len);

  auto resp = request("POST", "/rest/v1/yjs_updates", body.dump());
  return resp.ok();
}

bool SupabaseClient::clear_updates(std::string_view project_id) {
  std::string path = "/rest/v1/yjs_updates?project_id=eq." + std::string(project_id);
  auto resp = request("DELETE", path);
  return resp.ok();
}

bool SupabaseClient::check_project_access(std::string_view project_id, std::string_view user_id) {
  std::string path = "/rest/v1/project_users?project_id=eq." + std::string(project_id)
    + "&user_id=eq." + std::string(user_id)
    + "&select=role";

  auto resp = request("GET", path);
  if (!resp.ok()) return false;

  try {
    auto arr = json::parse(resp.body);
    return !arr.empty();
  } catch (...) {
    return false;
  }
}
