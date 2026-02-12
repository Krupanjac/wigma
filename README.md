# Wigma

A Figma-like vector design engine built with **Angular 21**, **PixiJS 8**, **Tailwind CSS 4.1**, and **rbush** R-tree spatial indexing. Wigma provides GPU-accelerated canvas rendering, a rich tool palette, undo/redo history, and a dark-themed professional UI.

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
9. [Performance Strategies](#performance-strategies)
10. [Keyboard Shortcuts](#keyboard-shortcuts)

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
│   │   └── drag-handler.ts
│   ├── overlays/              # Selection handles, guides, grid, cursor
│   ├── pools/                 # Object pools for Graphics, Sprite, Container, Text
│   ├── rendering/
│   │   ├── renderers/         # Per-node-type PixiJS renderers
│   │   ├── node-renderer.registry.ts
│   │   ├── render-pipeline.ts # 6-step frame lifecycle
│   │   └── render-manager.ts
│   ├── scene-graph/
│   │   ├── base-node.ts       # Abstract base with dirty flags
│   │   ├── rectangle-node.ts, ellipse-node.ts, polygon-node.ts, …
│   │   ├── group-node.ts      # Recursive bounds union
│   │   └── scene-graph-manager.ts  # Flat Map + tree, emits events
│   ├── selection/
│   │   ├── selection-manager.ts
│   │   ├── selection-box.ts   # Rubber-band marquee
│   │   └── alignment.ts       # Align/distribute algorithms
│   ├── spatial/
│   │   ├── spatial-index.ts   # rbush R-tree facade
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
│   │   └── batch-command.ts
│   ├── models/                # TypeScript interfaces
│   └── services/              # Angular services (history, clipboard, etc.)
├── panels/                    # Angular UI components (Tailwind)
│   ├── toolbar/
│   ├── layers-panel/
│   ├── properties-panel/      # With sub-sections: transform, fill, stroke, text
│   ├── menu-bar/
│   └── context-menu/
└── shared/
    ├── math/                  # Vec2, Matrix2D, Bounds, Bézier
    ├── data-structures/       # ObjectPool<T>
    └── utils/                 # uid, color-utils, geometry-utils, constants
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

Toolbar groups are organized Figma-style into: Selection, Frame/Section/Slice, Geometry (+ Image/Video), Pen/Pencil, Text, and Comment. The bottom toolbar also includes Draw/Design/Dev mode switching.

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

## Performance Strategies

| Strategy                    | Mechanism                                                |
| --------------------------- | -------------------------------------------------------- |
| NgZone escape               | Engine runs outside Angular, no CD on rAF/mouse/wheel    |
| Dirty flag propagation      | Skip unchanged subtrees in transform/render updates      |
| Idle frame detection        | Skip entire frame when nothing is dirty                  |
| R-tree viewport culling     | Only render nodes within visible bounds                  |
| Object pools                | Reuse PixiJS Graphics/Sprite/Container/Text objects      |
| Immutable + mutable math    | Zero-alloc inner loops with MutableVec2/Matrix2D/Bounds  |
| Adaptive Bézier subdivision | Fewer vertices at low zoom, more at high zoom            |
| OnPush change detection     | All Angular components use OnPush                        |
| Signal-based reactivity     | Computed signals replace manual subscriptions             |

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

## Tech Stack

| Technology     | Version | Purpose                              |
| -------------- | ------- | ------------------------------------ |
| Angular        | 21.1.4    | UI framework, signals, DI, routing   |
| PixiJS         | 8.16    | GPU-accelerated 2D canvas rendering  |
| Tailwind CSS   | 4.1     | Utility-first styling (PostCSS)      |
| rbush          | 4.0     | R-tree spatial index                 |
| TypeScript     | 5.9.3     | Type safety throughout               |

---