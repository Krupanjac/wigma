#include "supabase_client.h"
#include <nlohmann/json.hpp>
#include <sstream>
#include <stdexcept>
#include <iostream>
#include <cstring>

using json = nlohmann::json;

// ── Lifecycle ────────────────────────────────────────────────────────────────

SupabaseClient::SupabaseClient(std::string url, std::string service_key)
  : url_(std::move(url)), service_key_(std::move(service_key)) {
  curl_global_init(CURL_GLOBAL_DEFAULT);
  curl_ = curl_easy_init();
  if (!curl_) {
    throw std::runtime_error("SupabaseClient: curl_easy_init() failed");
  }
}

SupabaseClient::~SupabaseClient() {
  if (curl_) curl_easy_cleanup(curl_);
  curl_global_cleanup();
}

// ── libcurl write callback ───────────────────────────────────────────────────

size_t SupabaseClient::write_callback(char* ptr, size_t size, size_t nmemb, void* userdata) {
  auto* response_body = static_cast<std::string*>(userdata);
  size_t total = size * nmemb;
  response_body->append(ptr, total);
  return total;
}

// ── HTTP request via libcurl ─────────────────────────────────────────────────

SupabaseClient::Response SupabaseClient::request(
    std::string_view method,
    std::string_view path,
    std::string_view body,
    const std::vector<std::pair<std::string, std::string>>& extra_headers) {

  if (!curl_) return { 500, R"({"error":"curl not initialized"})" };

  // Build full URL: url_ already contains the Supabase project URL
  std::string full_url = url_ + std::string(path);

  curl_easy_reset(curl_);

  // Response body accumulator
  std::string response_body;

  // Basic options
  curl_easy_setopt(curl_, CURLOPT_URL, full_url.c_str());
  curl_easy_setopt(curl_, CURLOPT_WRITEFUNCTION, write_callback);
  curl_easy_setopt(curl_, CURLOPT_WRITEDATA, &response_body);
  curl_easy_setopt(curl_, CURLOPT_TIMEOUT, 10L);
  curl_easy_setopt(curl_, CURLOPT_CONNECTTIMEOUT, 5L);

  // Method
  std::string method_str(method);
  if (method_str == "GET") {
    curl_easy_setopt(curl_, CURLOPT_HTTPGET, 1L);
  } else if (method_str == "POST") {
    curl_easy_setopt(curl_, CURLOPT_POST, 1L);
  } else if (method_str == "PATCH") {
    curl_easy_setopt(curl_, CURLOPT_CUSTOMREQUEST, "PATCH");
  } else if (method_str == "DELETE") {
    curl_easy_setopt(curl_, CURLOPT_CUSTOMREQUEST, "DELETE");
  } else {
    curl_easy_setopt(curl_, CURLOPT_CUSTOMREQUEST, method_str.c_str());
  }

  // Headers
  struct curl_slist* headers = nullptr;
  headers = curl_slist_append(headers, ("apikey: " + service_key_).c_str());
  headers = curl_slist_append(headers, ("Authorization: Bearer " + service_key_).c_str());
  headers = curl_slist_append(headers, "Content-Type: application/json");

  for (auto& [key, value] : extra_headers) {
    headers = curl_slist_append(headers, (key + ": " + value).c_str());
  }

  curl_easy_setopt(curl_, CURLOPT_HTTPHEADER, headers);

  // Body
  std::string body_str(body);
  if (!body_str.empty()) {
    curl_easy_setopt(curl_, CURLOPT_POSTFIELDS, body_str.c_str());
    curl_easy_setopt(curl_, CURLOPT_POSTFIELDSIZE, static_cast<long>(body_str.size()));
  }

  // Execute
  CURLcode res = curl_easy_perform(curl_);
  long http_code = 0;
  curl_easy_getinfo(curl_, CURLINFO_RESPONSE_CODE, &http_code);
  curl_slist_free_all(headers);

  if (res != CURLE_OK) {
    std::cerr << "[supabase] curl error: " << curl_easy_strerror(res)
              << " url: " << full_url << std::endl;
    return { 500, std::string(R"({"error":")") + curl_easy_strerror(res) + "\"}" };
  }

  return { static_cast<int>(http_code), std::move(response_body) };
}

// ── Yjs Persistence (unchanged API, now backed by real HTTP) ─────────────────

std::optional<std::vector<uint8_t>> SupabaseClient::get_snapshot(std::string_view project_id) {
  std::string path = "/rest/v1/yjs_snapshots?project_id=eq." + std::string(project_id) + "&select=snapshot";
  auto resp = request("GET", path);
  if (!resp.ok()) return std::nullopt;

  try {
    auto arr = json::parse(resp.body);
    if (arr.empty() || !arr.is_array()) return std::nullopt;

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
    if (!arr.is_array()) return updates;
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
    return arr.is_array() && !arr.empty();
  } catch (...) {
    return false;
  }
}
