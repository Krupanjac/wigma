# Wigma Backend

C++ WebSocket relay server for real-time collaboration, backed by **Supabase Cloud** (PostgreSQL, Auth, Storage) and **Yjs CRDT** for conflict-free document merging.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Recent Changes (2026-02-14)](#recent-changes-2026-02-14)
3. [Directory Structure](#directory-structure)
4. [Prerequisites](#prerequisites)
5. [Environment Setup](#environment-setup)
6. [Building & Running](#building--running)
7. [Database Schema](#database-schema)
8. [WebSocket Protocol](#websocket-protocol)
9. [C++ Server Internals](#c-server-internals)
10. [Docker Deployment](#docker-deployment)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────┐
│  Frontend (Angular)                                      │
│  Supabase JS SDK ──→ Supabase Cloud (Auth, DB, Storage)  │
│  WebSocket client ──→ C++ WS Relay Server                │
└──────────────────────────────────────────────────────────┘
         │ wss://                          │ REST/HTTPS
         ▼                                 ▼
┌─────────────────────┐     ┌──────────────────────────────┐
│  C++ WS Server      │     │  Supabase Cloud              │
│  (uWebSockets)      │────→│  PostgreSQL + Auth + Storage │
│                     │     │                              │
│  • JWT verification │     │  Tables:                     │
│  • Room management  │     │    projects                  │
│  • Yjs relay        │     │    project_users             │
│  • Persistence      │     │    profiles                  │
│                     │     │    yjs_snapshots             │
│  Port: 9001         │     │    yjs_updates               │
│                     │     │    media_files               │
└─────────────────────┘     └──────────────────────────────┘
```

**Key design decisions:**

- **Server is a pure relay** — The C++ server does NOT interpret Yjs CRDT data. It broadcasts binary Yjs updates to all peers in a room and persists them as opaque blobs. All merge logic runs on the client via the Yjs library.
- **Supabase Cloud for everything stateful** — Auth (JWT + OAuth), PostgreSQL (project metadata, Yjs persistence), Storage (images, videos). No self-hosted DB to manage.
- **Binary-first protocol** — Yjs updates and awareness data are sent as binary WebSocket frames with a 1-byte type prefix. Control messages (join, peer events) use JSON text frames.
- **Zero-copy broadcast** — Binary payloads are forwarded to peers without deserialization. The server only reads the 1-byte type prefix to decide whether to persist the update.

---

## Recent Changes (2026-02-14)

### Frontend math moved to WASM (interop note)

The frontend shared math layer now uses a C/WebAssembly module (Emscripten) instead of pure TypeScript for vector/matrix/bounds/Bézier operations.

### Backend impact

- No changes to this backend service were required.
- WebSocket protocol, binary frame types, persistence flow, and Supabase schema remain unchanged.
- Existing Docker/native backend startup commands in this README are still valid.

### Full-stack run note

When running the full stack, the frontend now performs a WASM build step (`build:wasm`) before `start`/`build`.

---

## Directory Structure

```
backend/
├── .env.example              ← Environment variable template (copy to .env)
├── Dockerfile                ← Multi-stage build (build + slim runtime)
├── docker-compose.yml        ← One-command deployment
├── README.md                 ← This file
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql   ← Full PostgreSQL schema + RLS policies
└── ws-server/
    ├── CMakeLists.txt        ← CMake build (C++20)
    └── src/
        ├── main.cpp          ← Entry point, signal handlers
        ├── config.h / .cpp   ← Config from environment variables
        ├── auth/
        │   ├── jwt_verifier.h / .cpp   ← ES256/HS256 JWT verification (OpenSSL + JWKS)
        ├── persistence/
        │   ├── supabase_client.h / .cpp ← REST client for Supabase DB
        │   └── yjs_persistence.h / .cpp ← Snapshot + incremental update storage
        ├── protocol/
        │   └── message_codec.h / .cpp   ← Binary + JSON message encoding
        ├── rooms/
        │   ├── room.h / .cpp            ← Single collaboration room
        │   └── room_manager.h / .cpp    ← Room lifecycle + lookup
        └── server/
            └── ws_server.h / .cpp       ← uWebSockets event loop + handlers
```

---

## Prerequisites

| Tool       | Version | Purpose                           |
|------------|---------|-----------------------------------|
| CMake      | ≥ 3.20  | Build system                      |
| GCC / Clang| C++20   | Compiler                          |
| OpenSSL    | ≥ 3.0   | JWT signature verification        |
| zlib       |         | WebSocket compression             |
| Git        |         | Clone dependencies                |
| Docker     | ≥ 24    | Containerized deployment          |

**Supabase Cloud account** with a project created at [supabase.com](https://supabase.com).

---

## Environment Setup

### 1. Copy the env template

```bash
cd backend
cp .env.example .env
```

### 2. Fill in your Supabase credentials

Open `.env` and set these values from your **Supabase Dashboard → Settings → API**:

| Variable               | Where to find it                           | Description                                    |
|------------------------|--------------------------------------------|------------------------------------------------|
| `SUPABASE_URL`         | Dashboard → Settings → API → Project URL   | Already set to your project URL                |
| `SUPABASE_SERVICE_KEY` | Dashboard → Settings → API → `service_role` | **Server-only** key that bypasses RLS          |
| `JWT_SECRET`           | Dashboard → Settings → API → JWT Secret    | Used to verify auth tokens locally (no roundtrip) |

The remaining variables (`WS_PORT`, `MAX_ROOMS`, `MAX_PEERS`, `SNAPSHOT_INTERVAL_MS`) have sensible defaults.

### 3. Frontend environment

The frontend environment files are already configured at:
- `frontend/src/environments/environment.ts` (dev)
- `frontend/src/environments/environment.prod.ts` (prod)

These use the **anon key** (safe for client-side) — already filled in.

### 4. Run the database migration

In the Supabase Dashboard → SQL Editor, paste and run:

```
backend/supabase/migrations/001_initial_schema.sql
```

This creates all tables, RLS policies, triggers, and indexes.

Alternatively, if you install the [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase db push
```

---

## Building & Running

### Option A: Docker (recommended)

```bash
cd backend
docker compose up --build
```

This will:
1. Clone uWebSockets + nlohmann/json into a build stage
2. Compile the C++ server with CMake (Release mode)
3. Copy the binary into a slim Ubuntu 24.04 runtime image
4. Start the server on port 9001

### Option B: Native build

```bash
cd backend/ws-server

# Clone dependencies
mkdir -p deps
git clone --depth 1 --recurse-submodules https://github.com/uNetworking/uWebSockets.git deps/uWebSockets
git clone --depth 1 --branch v3.11.3 https://github.com/nlohmann/json.git deps/json

# Build
cmake -S . -B build -DCMAKE_BUILD_TYPE=Release
cmake --build build --parallel $(nproc)

# Run (set env vars first)
source ../env          # or export them manually
./build/wigma-ws-server
```

### Verify it's running

```bash
curl -s http://localhost:9001 || echo "Server is up (WebSocket only, no HTTP response expected)"
```

The server logs to stdout:
```
═══════════════════════════════════════
  Wigma WebSocket Server v0.1.0
  Real-time collaboration relay
═══════════════════════════════════════
[wigma-ws] Port: 9001
[wigma-ws] Max rooms: 1024
[wigma-ws] Listening on port 9001
```

---

## Database Schema

Six tables with full Row-Level Security:

| Table             | Purpose                                      | RLS                              |
|-------------------|----------------------------------------------|----------------------------------|
| `projects`        | Project metadata (name, canvas config)       | Members read, owner writes       |
| `project_users`   | Collaboration membership + roles             | Members see co-members           |
| `profiles`        | User display name, avatar, cursor color      | Public read, self-write          |
| `yjs_snapshots`   | Full Yjs document state (compacted)          | Members read, editors write      |
| `yjs_updates`     | Incremental Yjs binary diffs                 | Members read, editors write      |
| `media_files`     | Image/video metadata (bytes in Storage)      | Members read, editors upload     |

**Roles:** `owner` · `editor` · `viewer`

**Auto-triggers:**
- `on_auth_user_created` → inserts a `profiles` row
- `on_project_created` → inserts a `project_users` row with role `owner`

---

## WebSocket Protocol

### Connection flow

```
Client                          Server
  │                                │
  │──── WebSocket connect ────────→│
  │                                │
  │──── { type: "join",     ──────→│  1. Verify JWT
  │       projectId: "...",        │  2. Check project_users access
  │       token: "eyJ..." }       │  3. Join/create room
  │                                │
  │←── { type: "joined",   ──────→│  4. Send peer list
  │      userId: "...",            │
  │      peers: [...] }            │
  │                                │
  │←── [0x01][yjs state]  ───────→│  5. Send initial Yjs snapshot
  │                                │
  │←→── [0x02][yjs update] ──────→│  6. Bidirectional Yjs updates
  │←→── [0x03][awareness]  ──────→│  7. Cursor/selection sync
  │                                │
```

### Binary frames (Yjs data)

| Byte 0 | Type        | Direction      | Persisted? |
|--------|-------------|----------------|------------|
| `0x01` | yjs-sync    | Server → Client | —          |
| `0x02` | yjs-update  | Bidirectional   | Yes        |
| `0x03` | awareness   | Bidirectional   | No         |

### JSON text frames (control)

| Type           | Direction       | Fields                          |
|----------------|----------------|---------------------------------|
| `join`         | Client → Server | `projectId`, `token`            |
| `joined`       | Server → Client | `userId`, `peers[]`             |
| `peer-joined`  | Server → Client | `userId`                        |
| `peer-left`    | Server → Client | `userId`                        |
| `error`        | Server → Client | `code`, `message`               |
| `ping` / `pong`| Bidirectional   | —                               |

---

## C++ Server Internals

### Class hierarchy

| Class              | Responsibility                                                |
|--------------------|---------------------------------------------------------------|
| `WsServer`         | uWebSockets event loop, message dispatch, lifecycle           |
| `RoomManager`      | O(1) room lookup by project ID, lazy create/destroy           |
| `Room`             | Peer set, zero-copy broadcast, user ID mapping                |
| `JwtVerifier`      | ES256 (JWKS) + HS256 fallback JWT verification via OpenSSL    |
| `MessageCodec`     | Binary encode/decode (1-byte prefix), JSON control messages   |
| `SupabaseClient`   | REST API calls to Supabase (service-role key, bypasses RLS)   |
| `YjsPersistence`   | Load snapshots + updates, append updates, compact             |
| `Config`           | Reads all settings from `std::getenv()`                       |

### Dependencies (git submodules, cloned at build time)

| Library                    | Version | Purpose                          |
|----------------------------|---------|----------------------------------|
| [uWebSockets](https://github.com/uNetworking/uWebSockets) | latest | High-perf WebSocket server       |
| [nlohmann/json](https://github.com/nlohmann/json)          | 3.11.3 | JSON parsing for control messages |
| OpenSSL (system)           | ≥ 3.0   | JWT verification (ES256 + HS256) |
| zlib (system)              |         | WebSocket per-message deflate    |

---

## Docker Deployment

### Build & run

```bash
cd backend
docker compose up --build -d
```

### Check logs

```bash
docker compose logs -f ws-server
```

### Stop

```bash
docker compose down
```

### Image details

- **Build stage:** Ubuntu 24.04 + build-essential + cmake + OpenSSL + zlib
- **Runtime stage:** Ubuntu 24.04 + libssl3 + zlib1g (~80 MB)
- **Binary:** Statically-linked server at `/usr/local/bin/wigma-ws-server`
- **Port:** 9001 (configurable via `WS_PORT`)

---

## JWT Verification

The `JwtVerifier` supports two signature algorithms to handle Supabase's key rotation:

| Algorithm | Key Source | Usage |
|-----------|-----------|-------|
| **ES256** (primary) | JWKS endpoint (`/auth/v1/.well-known/jwks.json`) | Supabase's current default — ECC P-256 public key fetched on server startup |
| **HS256** (fallback) | `JWT_SECRET` environment variable | Legacy Supabase projects or custom JWTs |

**Startup flow:**
1. Server fetches the JWKS endpoint from Supabase
2. Extracts the ES256 (P-256) public key from the first RSA/EC key in the set
3. Caches the key in memory for the lifetime of the process
4. On each WebSocket `join`, the JWT is verified against ES256 first; if that fails, HS256 is attempted as fallback

This ensures compatibility regardless of whether Supabase uses ES256 or HS256 for a given project.

---

## Logging

The server uses structured logging with the `[wigma-ws]` prefix:

| Event | Log Level | Example |
|-------|-----------|-------|
| Server startup | INFO | `Port: 9001`, `Max rooms: 1024` |
| Peer join/leave | INFO | `User <id> joined room <project>` |
| Auth failure | WARN | `JWT verification failed` |
| Room lifecycle | INFO | `Created room`, `Destroyed empty room` |

Temporary per-message debug logging has been removed to avoid stdout flooding under load. Only lifecycle and error events are logged.

### Production checklist

- [ ] Set real values in `.env` (especially `JWT_SECRET` and `SUPABASE_SERVICE_KEY`)
- [ ] Put behind a reverse proxy (nginx/Caddy) with TLS for `wss://`
- [ ] Set `wsUrl` in `frontend/src/environments/environment.prod.ts` to your domain
- [ ] Run the SQL migration on your Supabase project
- [ ] Create the `media` Storage bucket: Supabase Dashboard → Storage → New bucket → "media" (public)
