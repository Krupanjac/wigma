# Wigma

A Figma-like vector design engine built with **Angular 21**, **PixiJS 8**, **Tailwind CSS 4.1**, and **rbush** R-tree spatial indexing. Wigma provides GPU-accelerated canvas rendering, a rich tool palette, undo/redo history, clipboard operations, IndexedDB persistence, and a dark-themed professional UI.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Directory Structure](#directory-structure)
3. [Getting Started](#getting-started)
4. [Algorithms & Data Structures](#algorithms--data-structures)
5. [Rendering Pipeline](#rendering-pipeline)
6. [Scene Graph & Node Model](#scene-graph--node-model)
7. [Tool System](#tool-system)
8. [Command Pattern & Undo/Redo](#command-pattern--undoredo)
9. [Persistence Layer](#persistence-layer)
10. [Performance Strategies](#performance-strategies)
11. [Keyboard Shortcuts](#keyboard-shortcuts)
12. [Tech Stack](#tech-stack)

---

## Architecture Overview

Wigma is organized into four strictly layered tiers. Dependencies flow **downward only** — upper layers may import from lower layers, never the reverse.

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

**Key design decisions:**

- **Engine runs outside NgZone** — `NgZone.runOutsideAngular()` prevents Angular change detection from firing on every `requestAnimationFrame`, mouse move, or wheel event. Angular signals bridge engine state back to the UI layer on demand.
- **Immutable + Mutable variants** — Hot-path math classes (`Vec2`, `Matrix2D`, `Bounds`) have both immutable (safe, allocating) and mutable (zero-alloc, in-place) variants. The engine's inner loops use mutable variants; UI-facing APIs expose immutable ones.
- **rbush is the sole spatial index** — No quadtree, no grid. The R-tree provides $O(\log n)$ range queries with a well-tuned branching factor ($M = 9$).
- **Dirty flag propagation** — Nodes carry `transform`, `render`, and `bounds` dirty flags that propagate parent → children. The render pipeline skips frames when nothing is dirty (idle detection).
- **Center-pivot transforms** — Node transforms compose around local geometric center so rotate/scale handles and render transforms remain consistent.
- **Anchor-aware scaling** — Scale operations can pin any of 9 anchor positions (`top-left` … `bottom-right`) from the Transform panel.

---

## Directory Structure

```
src/app/
├── engine/                    # Pure OOP engine (zero Angular deps)
│   ├── canvas-engine.ts       # Main entry point, wires all subsystems
│   ├── interaction/           # DOM event → engine pointer events
│   │   ├── interaction-manager.ts
│   │   ├── hit-tester.ts      # Two-phase broad + narrow hit testing
│   │   ├── snap-engine.ts     # Binary-search snap guides
│   │   ├── alignment-index.ts # Bucketed hashmap snap alignment
│   │   ├── guide-state.ts     # Alignment guide visual state
│   │   └── drag-handler.ts    # Batch drag with deferred spatial updates
│   ├── pools/                 # Object pools for Graphics, Sprite, Container, Text
│   ├── rendering/
│   │   ├── renderers/         # Per-node-type PixiJS renderers (12 types)
│   │   ├── overlays/          # Selection, grid, guide, cursor overlays
│   │   ├── remote-transform-lerper.ts  # Snapshot interpolation for remote collab
│   │   ├── node-renderer.registry.ts
│   │   ├── render-pipeline.ts # 6-step frame lifecycle
│   │   └── render-manager.ts  # Dirty-only render loop, skips inactive pages
│   ├── scene-graph/
│   │   ├── base-node.ts       # Abstract base with dirty flags
│   │   ├── rectangle-node.ts, ellipse-node.ts, polygon-node.ts, …
│   │   ├── image-node.ts      # Image node with TextureStore integration
│   │   ├── group-node.ts      # Recursive bounds union
│   │   └── scene-graph-manager.ts  # Flat Map + tree, batch event coalescing
│   ├── selection/
│   │   ├── selection-manager.ts  # Cached selectedNodeIds
│   │   ├── selection-box.ts   # Rubber-band marquee
│   │   └── alignment.ts       # Align/distribute algorithms
│   ├── spatial/
│   │   ├── spatial-index.ts   # rbush R-tree facade with bulk updateBatch()
│   │   └── bounds-calculator.ts
│   └── viewport/
│       ├── camera.ts          # View/inverse matrices
│       ├── zoom-controller.ts # Lerped zoom animation
│       └── viewport-manager.ts
├── tools/                     # OOP tools + Angular ToolManagerService
│   ├── base-tool.ts
│   ├── select-tool.ts         # Click/shift-click/marquee/drag state machine
│   ├── rectangle-tool.ts, ellipse-tool.ts, polygon-tool.ts, …
│   ├── pen-tool.ts            # Bézier path: click=sharp, drag=smooth
│   └── tool-manager.service.ts
├── core/
│   ├── commands/              # Command pattern for undo/redo
│   │   ├── command.interface.ts
│   │   ├── move-node.command.ts, resize-node.command.ts, …
│   │   └── batch-command.ts   # Auto-batching with SceneGraphManager
│   ├── models/                # TypeScript interfaces
│   └── services/              # Angular services
│       ├── history.service.ts    # Undo/redo stack (max 200)
│       ├── clipboard.service.ts  # Copy/cut/paste with deep clone
│       ├── project.service.ts    # IndexedDB persistence, auto-save
│       ├── keybinding.service.ts # Keyboard shortcut management
│       ├── export.service.ts     # PNG/JSON export pipeline
│       ├── loader.service.ts     # Loading state management
│       ├── collab-provider.service.ts  # Bridges WS transport with scene graph
│       └── collaboration.service.ts    # WebSocket connection management
├── panels/                    # Angular UI components (Tailwind)
│   ├── toolbar/
│   ├── layers-panel/          # Animated expand/collapse, rename, visibility
│   ├── properties-panel/      # Sub-sections: transform, fill, stroke, text
│   ├── menu-bar/
│   └── context-menu/
└── shared/
    ├── math/                  # Vec2, Matrix2D, Bounds, Bézier
    ├── data-structures/       # ObjectPool<T>
    └── utils/                 # uid, color-utils, geometry-utils, idb-storage
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install & Run

```bash
npm install
npm start          # → http://localhost:4200
```

### Production Build

```bash
npx ng build --configuration=production
```

Output is written to `dist/wigma/`.

---

## Algorithms & Data Structures

### R-Tree Spatial Index (rbush)

The `SpatialIndex` class wraps [rbush](https://github.com/mourner/rbush), an efficient JavaScript R-tree implementation using the R*-tree split strategy.

- **Bulk loading:** `O(n log n)` via Sort-Tile-Recursive (STR)
- **Point / range queries:** `O(log n)` average
- **Insert / remove / update:** `O(log n)` amortized
- **Branching factor:** $M = 9$ (default), tuned for typical design document sizes (100–10,000 nodes)

A secondary `Map<string, RBushItem>` provides $O(1)$ ID-based lookups for updates and removals.

### Two-Phase Hit Testing

1. **Broad phase:** Query the R-tree with a small rectangle around the pointer → candidate set $C$
2. **Narrow phase:** For each candidate in $C$ (sorted by z-order, back-to-front):
   - **Rectangle:** AABB containment check
   - **Ellipse:** $(x/r_x)^2 + (y/r_y)^2 \leq 1$
   - **Polygon / Star:** Ray-casting point-in-polygon ($O(v)$ where $v$ = vertex count)
   - **Path (Bézier):** Distance to nearest curve segment < stroke tolerance
   - **Group:** Recursive check on children

### Ray-Casting Point-in-Polygon

```
crossings = 0
for each edge (v_i, v_{i+1}):
    if ray from point crosses edge:
        crossings++
point is inside iff crossings is odd
```

Time complexity: $O(v)$ per polygon.

### De Casteljau's Algorithm (Bézier Evaluation)

Evaluates a cubic Bézier curve at parameter $t \in [0, 1]$:

$$B(t) = (1-t)^3 P_0 + 3(1-t)^2 t\, P_1 + 3(1-t) t^2\, P_2 + t^3 P_3$$

Used for: rendering, hit-testing, subdivision.

### Newton-Raphson Nearest Point on Bézier

Finds the parameter $t^*$ that minimizes $\|B(t) - Q\|^2$:

1. Sample $N$ points to find initial $t_0$
2. Iterate: $t_{n+1} = t_n - \frac{f'(t_n)}{f''(t_n)}$ where $f(t) = \|B(t) - Q\|^2$
3. Converges in 4–8 iterations for typical curves

### Adaptive Subdivision

Subdivides a Bézier curve until each segment is "flat enough" (distance from control points to chord < tolerance). Provides Level-of-Detail control:

- **High zoom:** More subdivisions → smoother curves
- **Low zoom:** Fewer subdivisions → better performance

### Arc Length (Gauss-Legendre Quadrature)

Computes arc length of a cubic Bézier using 5-point Gauss-Legendre quadrature on the speed function $\|B'(t)\|$.

### Bézier Bounding Box

Finds the tight AABB by:
1. Computing roots of $B'_x(t) = 0$ and $B'_y(t) = 0$ (quadratic)
2. Evaluating $B(t)$ at roots and endpoints
3. Taking min/max

---

## Rendering Pipeline

The `RenderPipeline` executes a 6-step frame lifecycle:

```
1. Dirty Check       → Skip frame if nothing changed (idle detection)
2. Transform Update  → Recompute world matrices for dirty nodes
3. Spatial Update     → Sync R-tree entries for moved/resized nodes
4. Viewport Culling   → Query R-tree for nodes in visible bounds
5. Sync Renderers     → Create/update/destroy PixiJS display objects
6. Clear Flags        → Reset dirty flags for next frame
```

**Idle detection:** If no dirty flags are set across the entire scene graph, the frame is skipped entirely — no GPU draw calls, no JS work beyond the check.

**Three render groups:**
- **Content:** Scene graph nodes (rectangles, ellipses, text, etc.)
- **Overlay:** Selection handles, guides, snap lines
- **Grid:** Background dot/line grid

---

## Scene Graph & Node Model

All visual elements extend `BaseNode`, which provides:

| Property       | Type          | Description                        |
| -------------- | ------------- | ---------------------------------- |
| `id`           | `string`      | Unique identifier (UUID v4)        |
| `type`         | `NodeType`    | Discriminant for type narrowing    |
| `name`         | `string`      | User-facing label                  |
| `x, y`         | `number`      | Position (setters trigger dirty)   |
| `width, height`| `number`      | Dimensions                         |
| `rotation`     | `number`      | Radians                            |
| `scaleX, scaleY`| `number`     | Non-uniform scale                  |
| `fill`         | `FillStyle`   | Fill color + visibility            |
| `stroke`       | `StrokeStyle` | Stroke color, width, visibility    |
| `opacity`      | `number`      | 0–1                                |
| `visible`      | `boolean`     | Visibility toggle                  |
| `locked`       | `boolean`     | Prevents interaction               |

**Node types:** `rectangle`, `ellipse`, `polygon`, `star`, `line`, `arrow`, `text`, `image`, `path`, `group`

**Dirty flags** (`transform`, `render`, `bounds`) propagate from parent to children. Setting `x` or `rotation` on a parent automatically marks all descendants' transforms dirty.

---

## Tool System

Tools follow a lifecycle pattern:

```
onActivate() → [onPointerDown → onPointerMove → onPointerUp]* → onDeactivate()
```

| Tool      | Key       | Behavior                                              |
| --------- | --------- | ----------------------------------------------------- |
| Select    | V         | Click, shift-click, marquee rubber-band, drag-move   |
| Hand      | H         | Drag to pan viewport                                  |
| Scale     | K         | Dedicated transform mode with anchor-aware scaling    |
| Frame     | F         | Click + drag to create frame                          |
| Section   | Shift+S   | Click + drag to create section container              |
| Slice     | X         | Click + drag to create export slice                   |
| Rectangle | R         | Click + drag to create rectangle                      |
| Ellipse   | O         | Click + drag to create ellipse                        |
| Polygon   | —         | Click + drag, configurable side count                 |
| Star      | —         | Click + drag, configurable points & inner radius      |
| Line      | L         | Click + drag to draw line                             |
| Arrow     | A         | Click + drag to draw arrow                            |
| Image     | I         | Click to place image placeholder                      |
| Video     | Shift+V   | Click to place video placeholder                      |
| Pen       | P         | Click = sharp anchor, drag = smooth (Bézier handles) |
| Pencil    | B         | Freehand drawing path                                 |
| Text      | T         | Click to create/edit text                             |
| Comment   | C         | Click to place comment note                           |
| Zoom      | Z         | Click to zoom in, alt+click to zoom out               |

The `ToolManagerService` (Angular) wraps the OOP tool system and exposes the active tool as a signal for reactive UI updates.

Toolbar groups are organized Figma-style into: Selection, Frame/Section/Slice, Geometry (+ Image/Video), Pen/Pencil, Text, and Comment.

Current grouped-toolbar UX:
- Split group controls: main icon runs the group's last-used tool, adjacent chevron opens the group menu.
- Group menus render in a fixed, viewport-anchored overlay above the dock for reliable z-order over canvas.
- Group icon is dynamic and follows last-selected tool in that group.
- Draw/Design/Dev mode switch lives in the same centered dock cluster.

Transform/text interaction behavior:
- Transform handles (resize/rotate) remain available even when non-select tools are active.
- Resize supports sign inversion when crossing zero (Figma-like flip behavior).
- Text editing supports on-canvas focused editing overlay plus properties-panel editing.
- Text resize updates font metrics/box dimensions instead of stretching glyphs via scale distortion.
- Single-selection dimensions badge (`W`/`H`) is rendered in screen-space below selected object.

Snapping/viewport behavior:
- Alignment guides are finite reference segments between involved objects (not full-canvas lines).
- Zoom interactions preserve pointer anchoring for wheel/click zoom.

---

## Command Pattern & Undo/Redo

Every state mutation goes through the `HistoryService`:

```typescript
historyService.execute(new MoveNodeCommand(sceneGraph, nodeIds, dx, dy));
```

- **Undo stack:** max 200 commands
- **Redo stack:** cleared on any new command
- **Temporal merging:** Consecutive compatible commands within 300ms are merged (e.g., dragging accumulates move deltas into a single undo step)
- **BatchCommand:** Wraps multiple commands into a single atomic undo/redo unit

Available commands:
- `MoveNodeCommand` — mergeable
- `ResizeNodeCommand`
- `CreateNodeCommand`
- `DeleteNodeCommand`
- `ModifyPropertyCommand` — generic, mergeable
- `GroupNodesCommand`
- `ReorderNodeCommand`
- `BatchCommand`

---

## Persistence Layer

Wigma persists the full project document (all pages, nodes, and embedded assets) to the browser's **IndexedDB** via a lightweight `IdbStorage` wrapper.

### Why IndexedDB?

localStorage is limited to ~5–10 MB depending on the browser. Design documents with embedded image/video data URLs can easily exceed this (e.g. 144 MB for ~900 nodes with images). IndexedDB has no practical size limit.

### Storage Architecture

```
┌───────────────────────────────────────────┐
│  ProjectService                           │
│  ├── schedulePersist()                    │
│  │   └── queueMicrotask → fire-and-forget │
│  ├── writeBrowserSnapshot() → async IDB   │
│  └── readBrowserSnapshot() → async IDB    │
│       └── localStorage migration on first │
│           load for backwards compatibility│
├───────────────────────────────────────────┤
│  IdbStorage (shared/utils/idb-storage.ts) │
│  ├── Database: wigma-db                   │
│  ├── Object store: snapshots              │
│  └── Methods: get(key), set(key, value),  │
│       delete(key)                         │
└───────────────────────────────────────────┘
```

- **Auto-save:** Scene graph events trigger `schedulePersist()`, which debounces via `queueMicrotask` and writes asynchronously without blocking the main thread.
- **Migration:** On first load, if the old `localStorage` snapshot exists, it is read, migrated to IndexedDB, and the localStorage key is removed.
- **Fire-and-forget writes:** `writeBrowserSnapshot()` is async but not awaited — persistence never blocks the UI.

---

## Performance Strategies

| Strategy                    | Mechanism                                                |
| --------------------------- | -------------------------------------------------------- |
| NgZone escape               | Engine runs outside Angular, no CD on rAF/mouse/wheel    |
| Dirty flag propagation      | Skip unchanged subtrees in transform/render updates      |
| Idle frame detection        | Skip entire frame when nothing is dirty                  |
| Dirty-only render loop      | Skip non-active-page nodes, inline dirty flag clearing   |
| R-tree viewport culling     | Only render nodes within visible bounds                  |
| Batch spatial updates       | `updateBatch()` — bulk R-tree rebuild for ≥10 nodes      |
| Batch event coalescing      | `beginBatch()`/`endBatch()` defers hierarchy-changed events until entire operation completes |
| BatchCommand auto-batching  | `BatchCommand` wraps execute/undo in begin/endBatch to prevent O(N×M) cascading |
| Debounced persistence       | `schedulePersist()` uses queueMicrotask — one write per microtask tick |
| Debounced layers panel      | `refreshNodes()` debounced via queueMicrotask, skips property-only events |
| Alignment skip during drag  | Alignment index rebuild deferred during active drag       |
| Object pools                | Reuse PixiJS Graphics/Sprite/Container/Text objects in renderers and overlays |
| Immutable + mutable math    | Zero-alloc inner loops with MutableVec2/Matrix2D/Bounds  |
| Adaptive Bézier subdivision | Fewer vertices at low zoom, more at high zoom            |
| OnPush change detection     | All Angular components use OnPush                        |
| Signal-based reactivity     | Computed signals replace manual subscriptions            |
| IndexedDB persistence       | Async fire-and-forget writes to IndexedDB (no localStorage size limit) |
| Texture deduplication       | TextureStore caches image/video textures by data URL hash |
| Asset deduplication          | Shared assets (images, videos) stored once with reference counting, reducing `.json.gz` by ~90% |
| Snapshot interpolation       | Remote geometry changes rendered via adaptive interpolation buffer — zero jitter, zero lag accumulation |
| Adaptive buffer delay        | Interpolation buffer self-tunes from measured network intervals (×1.05), clamped 16–80 ms |
| Direct spatial index update  | Remote lerper updates R-tree directly, bypasses scene event chain to avoid 60 fps serialization |
| Environment-gated debug logs | `environment.debugLogging` flag gates verbose `plog()` output; disabled by default |

---

## Keyboard Shortcuts

| Shortcut          | Action          |
| ----------------- | --------------- |
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

## Real-Time Collaboration Engine

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│  CollabProviderService                                  │
│  ─ Bridges WebSocket transport ↔ CanvasEngine scene graph │
│  ─ Outbound: SceneEvent → serialize → throttle → WS send  │
│  ─ Inbound:  WS binary  → deserialize → apply to scene   │
└─────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴───────────────┐
                │  RemoteTransformLerper      │
                │  Snapshot interpolation     │
                │  Adaptive buffer delay      │
                │  Direct spatial index update │
                └─────────────────────────────┘
```

### Snapshot Interpolation (RemoteTransformLerper)

Remote geometry changes (move, resize, scale, rotate) are not applied directly to the scene graph. Instead, they are buffered as timestamped snapshots and played back via **linear interpolation** between two known-good positions:

```
renderTime = now − adaptiveBufferDelay
value = snapshot0[prop] + (snapshot1[prop] − snapshot0[prop]) × t
```

**Key properties:**

| Property | Value | Purpose |
|----------|-------|---------|
| Buffer delay | Adaptive (16–80 ms) | Auto-tunes from measured inter-packet interval × 1.05 |
| Send rate | ~30 Hz (33 ms throttle) | Move and modify operations |
| Buffer size | 20 snapshots/node | ~660 ms of history at 30 Hz |
| Settle factor | 0.85/frame | Fast convergence when updates stop |
| Snap threshold | 0.15 px | Below this, snap to exact target |

**Why snapshot interpolation (not prediction/extrapolation):**
- Every rendered frame uses **real authoritative data** — no prediction errors
- Zero jitter — no overshoot or oscillation from velocity estimation
- Zero lag accumulation — constant, small delay regardless of movement speed
- Graceful packet loss handling — buffer absorbs one dropped packet

**Performance isolation:** The lerper writes node properties directly via backing fields (`_x`, `_y`, etc.) and updates the R-tree spatial index in-place, deliberately **bypassing `sceneGraph.notifyNodesChanged()`**. This avoids triggering the full listener chain (project serialization, collab diff, layers panel rebuild) at 60 fps.

### Throttle Rates

| Channel | Rate | Constant |
|---------|------|----------|
| Move operations | ~30 Hz | `MOVE_THROTTLE_MS = 33` |
| Modify operations | ~30 Hz | `MODIFY_THROTTLE_MS = 33` |
| Cursor awareness | ~12 Hz | `AWARENESS_INTERVAL_MS = 80` |

### Loop Prevention

When applying remote operations, `_applyingRemote` is set to `true`. The scene event handler skips broadcasting when this flag is set. Additionally, nodes being interpolated by the `RemoteTransformLerper` are filtered out of outbound broadcasts via `isLerping()` checks.

---

## Debug Logging

Verbose debug logging in `project.service.ts` and `auth.service.ts` is gated behind the `environment.debugLogging` flag:

```typescript
// frontend/src/environments/environment.ts
export const environment = {
  debugLogging: false,  // Set to true for verbose console output
  // ...
};
```

This prevents `plog()` calls from flooding the console during normal operation (especially during drag operations which trigger scene events at 60 fps).

---

## Tech Stack

| Technology     | Version | Purpose                              |
| -------------- | ------- | ------------------------------------ |
| Angular        | 21.1.4  | UI framework, signals, DI, routing   |
| PixiJS         | 8.16    | GPU-accelerated 2D canvas rendering  |
| Tailwind CSS   | 4.1     | Utility-first styling (PostCSS)      |
| rbush          | 4.0     | R-tree spatial index                 |
| Supabase JS    | 2.95    | Auth, DB, Storage client SDK         |
| Yjs            | 13.6    | CRDT for conflict-free collaboration |
| TypeScript     | 5.9.3   | Type safety throughout               |

---