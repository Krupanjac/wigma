#pragma once
#include <string>
#include <cstdint>

/**
 * Server configuration loaded from environment variables.
 */
struct Config {
  uint16_t    port           = 9001;
  std::string supabase_url;
  std::string supabase_service_key;   // Service-role key for server-side ops
  std::string jwt_secret;             // Supabase JWT secret for token verification
  uint32_t    max_rooms      = 1024;
  uint32_t    max_peers      = 64;    // Per room
  uint32_t    snapshot_interval_ms = 60000; // Compact Yjs every 60s

  static Config from_env();
};
