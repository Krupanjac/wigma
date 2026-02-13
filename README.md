# Wigma

A **Figma-class collaborative vector design tool** built as a monorepo with an **Angular 21 + PixiJS 8** frontend for GPU-accelerated canvas editing and a **C++ uWebSockets** relay server for real-time multi-user collaboration, backed by **Supabase Cloud** (PostgreSQL, Auth, Storage).

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Monorepo Structure](#monorepo-structure)
3. [Architecture Overview](#architecture-overview)
4. [Frontend](#frontend)
5. [Backend](#backend)
6. [Shared Types](#shared-types)
7. [Getting Started](#getting-started)
8. [Database Schema](#database-schema)
9. [Authentication & Authorization](#authentication--authorization)
10. [Real-Time Collaboration](#real-time-collaboration)
11. [Persistence Pipeline](#persistence-pipeline)
12. [Performance Strategies](#performance-strategies)
13. [Keyboard Shortcuts](#keyboard-shortcuts)
14. [Tech Stack](#tech-stack)

---

## Project Overview

Wigma is a full-stack design application that mirrors the Figma workflow: GPU-rendered canvas, vector tools, real-time multi-user editing, and cloud persistence. The three pillars:

| Pillar              | Technology                  | Role                                           |
|---------------------|-----------------------------|-------------------------------------------------|
| **Frontend**        | Angular 21 + PixiJS 8       | Canvas rendering, tool system, UI panels        |
| **Backend**         | C++ uWebSockets (Docker)     | WebSocket relay for real-time Yjs CRDT sync     |
| **Cloud Services**  | Supabase Cloud               | PostgreSQL, JWT Auth, Row-Level Security, Storage|

**Key capabilities:**

- 20+ drawing tools (rectangle, ellipse, polygon, star, pen, pencil, text, image, video, …)
- Undo/redo (command pattern, max 200 steps, temporal merging)
- Copy/cut/paste with deep clone
- GPU-accelerated rendering with idle frame detection
- R-tree spatial indexing for $O(\log n)$ range queries
- Alignment snapping guides
- Cloud save/load with per-project JSONB persistence
- User authentication with auto-profile creation
- Thumbnail generation with WebGL texture-size clamping
- PNG and JSON export

---

## Monorepo Structure

```
wigma/
├── .gitignore
├── README.md                  ← This file
├── frontend/                  ← Angular 21 + PixiJS 8 application
│   ├── package.json
│   ├── angular.json
│   ├── README.md              ← Detailed frontend documentation
│   └── src/
│       └── app/
│           ├── engine/        ← Pure OOP rendering engine (zero Angular deps)
│           ├── tools/         ← 20+ drawing tools
│           ├── core/          ← Commands, models, services
│           ├── panels/        ← UI: toolbar, layers, properties, menu-bar, context-menu
│           ├── pages/         ← Route-level components (login, projects, editor)
│           └── shared/        ← Math, data structures, utilities
├── backend/                   ← C++ WebSocket server + Supabase migrations
│   ├── Dockerfile
│   ├── docker-compose.yml
│   ├── .env / .env.example
│   ├── README.md              ← Detailed backend documentation
│   ├── supabase/
│   │   └── migrations/        ← PostgreSQL schema + RLS policies
│   └── ws-server/
│       ├── CMakeLists.txt
│       └── src/               ← C++20 server source
├── shared/                    ← Cross-boundary TypeScript types
│   └── types/
│       ├── database.types.ts  ← DB row types, insert/update types, WS protocol
│       └── index.ts
└── build/                     ← Build artifacts (gitignored)
```

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend (Angular 21)                          │
│                                                                        │
│   ┌──────────────┐  ┌───────────────┐  ┌────────────────────────────┐ │
│   │  UI Panels   │  │  Tool System  │  │  Canvas Engine (PixiJS 8)  │ │
│   │  (Tailwind)  │  │  (20+ tools)  │  │  scene-graph, viewport,   │ │
│   │              │  │               │  │  rendering, spatial, pools │ │
│   └──────┬───────┘  └───────┬───────┘  └────────────┬───────────────┘ │
│          │ Angular Signals   │ OOP lifecycle          │ WebGL/Canvas2D │
│          └──────────────────┴────────────────────────┘                 │
│                              │                                         │
│          ┌───────────────────┴───────────────────┐                     │
│          │  Core Services (Angular DI)           │                     │
│          │  project, history, clipboard, export  │                     │
│          │  auth, keybinding, supabase            │                     │
│          └──────────────┬────────────────────────┘                     │
└─────────────────────────┼──────────────────────────────────────────────┘
                          │
           ┌──────────────┴──────────────┐
           │ Supabase JS SDK             │ WebSocket
           │ (REST/HTTPS)                │ (wss://)
           ▼                             ▼
┌──────────────────────────┐  ┌─────────────────────────┐
│  Supabase Cloud          │  │  C++ WebSocket Server   │
│                          │  │  (uWebSockets, Docker)  │
│  • PostgreSQL (RLS)      │  │                         │
│  • Auth (JWT + OAuth)    │  │  • JWT verification     │
│  • Storage (media)       │  │  • Room management      │
│                          │  │  • Yjs CRDT relay       │
│  Tables:                 │  │  • Zero-copy broadcast  │
│    projects              │  │                         │
│    project_users         │  │  Port: 9001             │
│    profiles              │  └────────────┬────────────┘
│    yjs_snapshots         │               │
│    yjs_updates           │               │ REST (service-role key)
│    media_files           │←──────────────┘
└──────────────────────────┘
```

**Key design decisions:**

- **Engine runs outside NgZone** — `NgZone.runOutsideAngular()` prevents Angular change detection from firing on `requestAnimationFrame`, mouse moves, or wheel events. Angular signals bridge engine state to the UI on demand.
- **Server is a pure relay** — The C++ server does NOT interpret Yjs CRDT data. It broadcasts binary Yjs updates to all peers in a room and persists them as opaque blobs. All merge logic runs on the client.
- **Supabase Cloud for all state** — Auth (JWT + OAuth), PostgreSQL (project metadata, Yjs persistence), Storage (images, videos). No self-hosted database.
- **Shared types as single source of truth** — `shared/types/database.types.ts` defines all DB row types, insert/update contracts, and WebSocket protocol message shapes, consumed by both frontend and backend.
- **SECURITY DEFINER helpers for RLS** — Row-Level Security policies use PostgreSQL helper functions with `SECURITY DEFINER` to break circular policy references (e.g., `is_project_member()`, `is_project_editor()`).

---

## Frontend

> Full documentation: [`frontend/README.md`](frontend/README.md)

### Four-Layer Architecture

```
┌─────────────────────────────────────────────────┐
│  Angular UI Layer (signals, OnPush, Tailwind)   │
│  app.component, panels/, canvas.component       │
├─────────────────────────────────────────────────┤
│  Tools Layer (pure OOP, ToolManagerService)      │
│  select, rectangle, ellipse, pen, hand, zoom…   │
├─────────────────────────────────────────────────┤
│  Engine Layer (zero Angular deps, pure OOP)      │
│  scene-graph, viewport, selection, rendering,   │
│  spatial, interaction, overlays, pools           │
├─────────────────────────────────────────────────┤
│  Shared Layer (pure functions, zero deps)        │
│  Vec2, Matrix2D, Bounds, Bézier, ObjectPool,    │
│  uid, color-utils, geometry-utils, constants     │
└─────────────────────────────────────────────────┘
```

Dependencies flow **downward only** — upper layers import from lower layers, never the reverse.

### Rendering Pipeline

The `RenderPipeline` runs a 6-step frame lifecycle:

1. **Dirty Check** → Skip frame if nothing changed (idle detection)
2. **Transform Update** → Recompute world matrices for dirty nodes
3. **Spatial Update** → Sync R-tree entries for moved/resized nodes
4. **Viewport Culling** → Query R-tree for nodes in visible bounds
5. **Sync Renderers** → Create/update/destroy PixiJS display objects
6. **Clear Flags** → Reset dirty flags for next frame

### Tool System

20+ tools following a lifecycle pattern: `onActivate() → [onPointerDown → onPointerMove → onPointerUp]* → onDeactivate()`

| Tool      | Key       | Behavior                                              |
| --------- | --------- | ----------------------------------------------------- |
| Select    | V         | Click, shift-click, marquee rubber-band, drag-move   |
| Hand      | H         | Drag to pan viewport                                  |
| Scale     | K         | Anchor-aware scaling                                  |
| Frame     | F         | Draw frame containers                                 |
| Rectangle | R         | Draw rectangles                                       |
| Ellipse   | O         | Draw ellipses                                         |
| Polygon   | —         | Configurable side count                               |
| Star      | —         | Configurable points & inner radius                    |
| Line      | L         | Draw lines                                            |
| Arrow     | A         | Draw arrows                                           |
| Pen       | P         | Bézier paths (click = sharp, drag = smooth)           |
| Pencil    | B         | Freehand drawing                                      |
| Text      | T         | On-canvas text editing                                |
| Image     | I         | Place image                                           |
| Video     | Shift+V   | Place video                                           |
| Comment   | C         | Place comment                                         |
| Zoom      | Z         | Click zoom in, Alt+click zoom out                     |

### Command Pattern & Undo/Redo

Every state mutation flows through the `HistoryService`:

- **Undo stack:** max 200 commands
- **Redo stack:** cleared on any new command
- **Temporal merging:** Consecutive compatible commands within 300ms merge (e.g., drag moves accumulate into a single undo step)
- **Commands:** `MoveNodeCommand`, `ResizeNodeCommand`, `CreateNodeCommand`, `DeleteNodeCommand`, `ModifyPropertyCommand`, `GroupNodesCommand`, `ReorderNodeCommand`, `BatchCommand`

### Scene Graph

All visual elements extend `BaseNode` with properties: `id`, `type`, `name`, `x`, `y`, `width`, `height`, `rotation`, `scaleX`, `scaleY`, `fill`, `stroke`, `opacity`, `visible`, `locked`.

**Node types:** `rectangle`, `ellipse`, `polygon`, `star`, `line`, `arrow`, `text`, `image`, `video`, `path`, `group`

**Dirty flags** (`transform`, `render`, `bounds`) propagate from parent to children automatically.

### Algorithms & Data Structures

- **R-tree spatial index** (rbush): $O(\log n)$ range queries, branching factor $M = 9$
- **Two-phase hit testing:** Broad (R-tree query) → Narrow (per-shape math)
- **Ray-casting point-in-polygon:** $O(v)$ per polygon
- **De Casteljau / Newton-Raphson:** Bézier evaluation and nearest-point computation
- **Adaptive Bézier subdivision:** LOD-based curve flattening
- **Arc length:** Gauss-Legendre quadrature

---

## Backend

> Full documentation: [`backend/README.md`](backend/README.md)

### C++ WebSocket Server

A high-performance relay server built with uWebSockets and compiled as C++20:

| Class              | Responsibility                                                |
|--------------------|---------------------------------------------------------------|
| `WsServer`         | uWebSockets event loop, message dispatch, lifecycle           |
| `RoomManager`      | $O(1)$ room lookup by project ID, lazy create/destroy         |
| `Room`             | Peer set, zero-copy broadcast, user ID mapping                |
| `JwtVerifier`      | HS256 verification via OpenSSL HMAC, expiry checking          |
| `MessageCodec`     | Binary encode/decode (1-byte prefix), JSON control messages   |
| `SupabaseClient`   | REST API calls to Supabase (service-role key, bypasses RLS)   |
| `YjsPersistence`   | Load snapshots + updates, append updates, compact             |
| `Config`           | Reads all settings from `std::getenv()`                       |

### WebSocket Protocol

**Binary frames (Yjs data):**

| Byte 0 | Type        | Direction       | Persisted? |
|--------|-------------|-----------------|------------|
| `0x01` | yjs-sync    | Server → Client | —          |
| `0x02` | yjs-update  | Bidirectional   | Yes        |
| `0x03` | awareness   | Bidirectional   | No         |

**JSON text frames (control):**

| Type           | Direction       | Fields                          |
|----------------|----------------|---------------------------------|
| `join`         | Client → Server | `projectId`, `token`            |
| `joined`       | Server → Client | `userId`, `peers[]`             |
| `peer-joined`  | Server → Client | `userId`                        |
| `peer-left`    | Server → Client | `userId`                        |
| `error`        | Server → Client | `code`, `message`               |
| `ping` / `pong`| Bidirectional   | —                               |

### Docker Deployment

```bash
cd backend
docker compose up --build -d
```

- **Build stage:** Ubuntu 24.04 + build-essential + cmake + OpenSSL + zlib
- **Runtime stage:** Ubuntu 24.04 + libssl3 + zlib1g (~80 MB)
- **Port:** 9001 (configurable via `WS_PORT`)

---

## Shared Types

`shared/types/database.types.ts` is the single source of truth for all data contracts:

| Type               | Purpose                                                      |
|--------------------|--------------------------------------------------------------|
| `DbProject`        | Project row (name, description, canvas_config, project_data) |
| `DbProjectUser`    | Collaboration membership + roles                             |
| `DbProfile`        | User display name, avatar, cursor color                      |
| `DbYjsSnapshot`    | Full Yjs document state (compacted binary)                   |
| `DbYjsUpdate`      | Incremental Yjs binary diffs                                 |
| `DbMediaFile`      | Image/video metadata                                         |
| `DocumentData`     | Scene graph snapshot (`{ nodes, canvas }`)                   |
| `SceneNodeModel`   | Serialized node (geometry, style, children, type-specific data) |
| `WsClientMessage`  | Client → Server WebSocket message union                      |
| `WsServerMessage`  | Server → Client WebSocket message union                      |
| `Database`         | Supabase `createClient<Database>` type map                   |

---

## Getting Started

### Prerequisites

| Tool       | Version | Purpose                           |
|------------|---------|-----------------------------------|
| Node.js    | ≥ 18    | Frontend build and dev server     |
| npm        | ≥ 9     | Package management                |
| Docker     | ≥ 24    | Backend containerized deployment  |
| Git        |         | Version control                   |

A **Supabase Cloud account** with a project created at [supabase.com](https://supabase.com).

### 1. Clone the repository

```bash
git clone https://github.com/Krupanjac/wigma.git
cd wigma
```

### 2. Set up the database

In the Supabase Dashboard → SQL Editor, paste and run the migration files in order:

```
backend/supabase/migrations/001_initial_schema.sql
backend/supabase/migrations/002_fix_rls_policies.sql
backend/supabase/migrations/003_add_project_data.sql
```

This creates all tables, RLS policies, SECURITY DEFINER helpers, triggers, and indexes.

### 3. Configure environment variables

#### Backend

```bash
cd backend
cp .env.example .env
```

Fill in values from **Supabase Dashboard → Settings → API**:

| Variable               | Source                                     | Description                                    |
|------------------------|--------------------------------------------|------------------------------------------------|
| `SUPABASE_URL`         | Dashboard → Settings → API → Project URL   | Your Supabase project URL                      |
| `SUPABASE_SERVICE_KEY` | Dashboard → Settings → API → `service_role` | Server-only key that bypasses RLS              |
| `JWT_SECRET`           | Dashboard → Settings → API → JWT Secret    | Used to verify auth tokens locally             |

#### Frontend

Environment files are at:
- `frontend/src/environments/environment.ts` (dev)
- `frontend/src/environments/environment.prod.ts` (prod)

Set `supabaseUrl` and `supabaseKey` (anon key, safe for client-side).

### 4. Start the backend

```bash
cd backend
docker compose up --build -d
```

The server starts on port 9001.

### 5. Start the frontend

```bash
cd frontend
npm install
npm start
```

Open http://localhost:4200.

### 6. Verify

- Create an account via the login page
- Create a new project from the dashboard
- Draw shapes on the canvas
- Press `Ctrl+S` to save to Supabase
- Refresh — your work loads from the cloud

---

## Database Schema

Six tables with full Row-Level Security:

| Table             | Purpose                                      | RLS Policy                       |
|-------------------|----------------------------------------------|----------------------------------|
| `projects`        | Project metadata, canvas config, project_data| Members read, owner writes       |
| `project_users`   | Collaboration membership + roles             | Members see co-members           |
| `profiles`        | User display name, avatar, cursor color      | Public read, self-write          |
| `yjs_snapshots`   | Full Yjs document state (compacted)          | Members read, editors write      |
| `yjs_updates`     | Incremental Yjs binary diffs                 | Members read, editors write      |
| `media_files`     | Image/video metadata (bytes in Storage)      | Members read, editors upload     |

**Roles:** `owner` · `editor` · `viewer`

**Auto-triggers:**
- `on_auth_user_created` → inserts a `profiles` row with defaults
- `on_project_created` → inserts a `project_users` row with role `owner`

**SECURITY DEFINER helpers** (break circular RLS references):
- `is_project_member(project_id)` — checks if current user has any role
- `is_project_editor(project_id)` — checks if current user is owner or editor
- `get_project_role(project_id)` — returns the user's role

---

## Authentication & Authorization

### Auth Flow

1. **Sign up / Sign in** via Supabase Auth (email + password)
2. **JWT issued** by Supabase, stored in browser
3. **Frontend** attaches JWT to all Supabase SDK calls (auto-handled)
4. **WebSocket** `join` message includes JWT for server-side verification
5. **C++ server** verifies JWT signature (HS256 via OpenSSL) and checks project membership

### Session Restore

- `onAuthStateChange` fires synchronously on page load — sets `isLoading = false` immediately, then fire-and-forget fetches the user profile
- 2-second fallback timeout ensures the app never hangs on a spinner
- Custom `silentNavigatorLock` wraps the Navigator Locks API to suppress `LockAcquireTimeoutError` from Supabase SDK
- Profile auto-creation: if `fetchProfile()` returns no row, one is inserted automatically

### Row-Level Security

All database queries from the frontend use the **anon key** and are subject to RLS policies. The C++ backend uses the **service-role key** to bypass RLS for server operations.

---

## Real-Time Collaboration

### Protocol

```
Client A                     Server                     Client B
  │                            │                            │
  │── join { projectId, token }→│                            │
  │                            │←── join { projectId, token }│
  │←── joined { peers: [B] }──│──→ joined { peers: [A] } ──│
  │                            │                            │
  │←── [0x01] yjs-sync ───────│                            │
  │                            │──→ [0x01] yjs-sync ───────│
  │                            │                            │
  │── [0x02] yjs-update ──────│──→ [0x02] yjs-update ──────│
  │←── [0x02] yjs-update ─────│←── [0x02] yjs-update ──────│
  │                            │                            │
  │── [0x03] awareness ────────│──→ [0x03] awareness ───────│
  │←── [0x03] awareness ───────│←── [0x03] awareness ───────│
```

### CRDT Strategy

- **Yjs** handles conflict-free merging on the client
- Server stores Yjs updates as opaque blobs — zero interpretation overhead
- Periodic compaction: server replaces accumulated updates with a single snapshot
- Awareness channel carries cursor positions and selection state (not persisted)

---

## Persistence Pipeline

Wigma uses a dual-layer persistence model:

```
┌───────────────────────────────────────────────────────┐
│  Layer 1: Browser (IndexedDB)                         │
│  • Project-scoped keys: wigma.project.v1:<projectId>  │
│  • Gzip-compressed snapshots                          │
│  • Auto-save via debounced queueMicrotask             │
│  • Fire-and-forget async writes                       │
│  • No size limit (vs 5–10 MB localStorage)            │
└───────────────────────┬───────────────────────────────┘
                        │ Ctrl+S / explicit save
                        ▼
┌───────────────────────────────────────────────────────┐
│  Layer 2: Supabase Cloud (PostgreSQL)                 │
│  • project_data JSONB column on projects table        │
│  • Stores full DocumentData { nodes, canvas }         │
│  • Metadata sync: name, description                   │
│  • Thumbnail generation (480px max, WebGL clamped)    │
│  • All queries wrapped with 10–15s timeouts           │
└───────────────────────────────────────────────────────┘
```

### Save Flow (Ctrl+S)

1. Serialize scene graph → `DocumentData`
2. Upload `project_data` JSONB to Supabase
3. Sync metadata delta (name, description) if changed
4. Generate 480px thumbnail (WebGL MAX_TEXTURE_SIZE clamped)
5. Write browser snapshot to IndexedDB

### Load Flow (open project)

1. Fetch project metadata from Supabase
2. Load `project_data` from Supabase
3. Deserialize nodes → reconstruct scene graph
4. If Supabase fails, fall back to IndexedDB snapshot

---

## Performance Strategies

| Strategy                    | Mechanism                                                |
| --------------------------- | -------------------------------------------------------- |
| NgZone escape               | Engine runs outside Angular, no CD on rAF/mouse/wheel    |
| Dirty flag propagation      | Skip unchanged subtrees in transform/render updates      |
| Idle frame detection        | Skip entire frame when nothing is dirty                  |
| R-tree viewport culling     | Only render nodes within visible bounds                  |
| Batch spatial updates       | Bulk R-tree rebuild for ≥10 simultaneous node updates    |
| Batch event coalescing      | `beginBatch()`/`endBatch()` defers hierarchy events      |
| Object pools                | Reuse PixiJS Graphics/Sprite/Container/Text objects      |
| Immutable + mutable math    | Zero-alloc inner loops with MutableVec2/Matrix2D/Bounds  |
| Adaptive Bézier subdivision | Fewer vertices at low zoom, more at high zoom            |
| OnPush + signals            | All components use OnPush; computed signals replace subs |
| Query timeouts              | All Supabase calls wrapped with `Promise.race` timeouts  |
| Texture deduplication       | TextureStore caches textures by data URL hash            |
| WebGL texture clamping      | Export/thumbnail respects GPU MAX_TEXTURE_SIZE            |
| Debounced persistence       | `queueMicrotask` — one browser write per microtask tick  |
| Zero-copy WS broadcast      | C++ server forwards binary payloads without deserialization |

---

## Keyboard Shortcuts

| Shortcut          | Action          |
| ----------------- | --------------- |
| `Ctrl+S`          | Save to cloud   |
| `Ctrl+Z`          | Undo            |
| `Ctrl+Shift+Z`    | Redo            |
| `Ctrl+C`          | Copy            |
| `Ctrl+X`          | Cut             |
| `Ctrl+V`          | Paste           |
| `Ctrl+A`          | Select All      |
| `Ctrl+G`          | Group           |
| `Delete`          | Delete          |
| `V`               | Select tool     |
| `K`               | Scale tool      |
| `F`               | Frame tool      |
| `Shift+S`         | Section tool    |
| `X`               | Slice tool      |
| `R`               | Rectangle tool  |
| `O`               | Ellipse tool    |
| `L`               | Line tool       |
| `A`               | Arrow tool      |
| `P`               | Pen tool        |
| `B`               | Pencil tool     |
| `T`               | Text tool       |
| `C`               | Comment tool    |
| `I`               | Image tool      |
| `Shift+V`         | Video tool      |
| `H`               | Hand tool       |
| `Z`               | Zoom tool       |
| `Ctrl+=`          | Zoom in         |
| `Ctrl+-`          | Zoom out        |
| `Ctrl+0`          | Zoom to 100%    |
| `Ctrl+1`          | Zoom to fit     |

---

## Tech Stack

### Frontend

| Technology     | Version | Purpose                              |
| -------------- | ------- | ------------------------------------ |
| Angular        | 21.1.4  | UI framework, signals, DI, routing   |
| PixiJS         | 8.16    | GPU-accelerated 2D canvas rendering  |
| Tailwind CSS   | 4.1     | Utility-first styling (PostCSS)      |
| rbush          | 4.0     | R-tree spatial index                 |
| Supabase JS    | 2.95    | Auth, DB, Storage client SDK         |
| Yjs            | 13.6    | CRDT for conflict-free collaboration |
| TypeScript     | 5.9     | Type safety throughout               |
| IndexedDB      | —       | Browser persistence (no size limit)  |

### Backend

| Technology              | Version | Purpose                          |
|-------------------------|---------|----------------------------------|
| C++                     | 20      | Server language                  |
| uWebSockets             | latest  | High-performance WebSocket server|
| nlohmann/json           | 3.11.3  | JSON parsing for control messages|
| OpenSSL                 | ≥ 3.0   | HMAC-SHA256 for JWT verification |
| zlib                    |         | WebSocket per-message deflate    |
| Docker                  | ≥ 24    | Containerized deployment         |

### Cloud

| Service           | Purpose                                      |
|-------------------|----------------------------------------------|
| Supabase Auth     | JWT-based authentication (email + OAuth)     |
| Supabase Database | PostgreSQL with Row-Level Security           |
| Supabase Storage  | Media file hosting (images, videos)          |

---
