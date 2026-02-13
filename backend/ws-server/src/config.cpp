#include "config.h"
#include <cstdlib>

Config Config::from_env() {
  Config cfg;

  if (auto* v = std::getenv("WS_PORT"))
    cfg.port = static_cast<uint16_t>(std::stoi(v));

  if (auto* v = std::getenv("SUPABASE_URL"))
    cfg.supabase_url = v;

  if (auto* v = std::getenv("SUPABASE_SERVICE_KEY"))
    cfg.supabase_service_key = v;

  if (auto* v = std::getenv("JWT_SECRET"))
    cfg.jwt_secret = v;

  if (auto* v = std::getenv("MAX_ROOMS"))
    cfg.max_rooms = static_cast<uint32_t>(std::stoi(v));

  if (auto* v = std::getenv("MAX_PEERS"))
    cfg.max_peers = static_cast<uint32_t>(std::stoi(v));

  if (auto* v = std::getenv("SNAPSHOT_INTERVAL_MS"))
    cfg.snapshot_interval_ms = static_cast<uint32_t>(std::stoi(v));

  return cfg;
}
