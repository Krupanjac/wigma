#include "server/ws_server.h"
#include "config.h"
#include <iostream>
#include <csignal>

static WsServer* g_server = nullptr;

void signal_handler(int sig) {
  std::cout << "\n[wigma-ws] Caught signal " << sig << ", shutting down..." << std::endl;
  if (g_server) g_server->stop();
}

int main() {
  std::cout << "═══════════════════════════════════════" << std::endl;
  std::cout << "  Wigma WebSocket Server v0.1.0" << std::endl;
  std::cout << "  Real-time collaboration relay" << std::endl;
  std::cout << "═══════════════════════════════════════" << std::endl;

  // Load config from environment
  auto config = Config::from_env();

  if (config.supabase_url.empty() || config.jwt_secret.empty()) {
    std::cerr << "[wigma-ws] ERROR: SUPABASE_URL and JWT_SECRET must be set" << std::endl;
    return 1;
  }

  std::cout << "[wigma-ws] Port: " << config.port << std::endl;
  std::cout << "[wigma-ws] Max rooms: " << config.max_rooms << std::endl;
  std::cout << "[wigma-ws] Max peers/room: " << config.max_peers << std::endl;
  std::cout << "[wigma-ws] Snapshot interval: " << config.snapshot_interval_ms << "ms" << std::endl;

  // Register signal handlers
  std::signal(SIGINT, signal_handler);
  std::signal(SIGTERM, signal_handler);

  // Create and run server
  WsServer server(config);
  g_server = &server;
  server.run();

  std::cout << "[wigma-ws] Server stopped." << std::endl;
  return 0;
}
