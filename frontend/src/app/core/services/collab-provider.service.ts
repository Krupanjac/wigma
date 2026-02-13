import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { CollaborationService } from './collaboration.service';
import { ProjectService } from './project.service';
import { AuthService } from './auth.service';
import { CanvasEngine } from '../../engine/canvas-engine';
import { BaseNode } from '../../engine/scene-graph/base-node';
import { SceneEvent } from '../../engine/scene-graph/scene-graph-manager';
import type { SceneNodeModel } from '@wigma/shared';
import {
  SceneOp,
  AwarenessState,
  decodeSceneOp,
  decodeAwareness,
} from '../../shared/collab-protocol';

// Node factories — reuse the same imports as ProjectService
import { GroupNode } from '../../engine/scene-graph/group-node';
import { RectangleNode } from '../../engine/scene-graph/rectangle-node';
import { EllipseNode } from '../../engine/scene-graph/ellipse-node';
import { PolygonNode } from '../../engine/scene-graph/polygon-node';
import { StarNode } from '../../engine/scene-graph/star-node';
import { LineNode } from '../../engine/scene-graph/line-node';
import { ArrowNode } from '../../engine/scene-graph/arrow-node';
import { TextNode } from '../../engine/scene-graph/text-node';
import { ImageNode } from '../../engine/scene-graph/image-node';
import { VideoNode } from '../../engine/scene-graph/video-node';
import { PathNode, AnchorType, PathAnchor } from '../../engine/scene-graph/path-node';
import type { NodeType } from '../../engine/scene-graph/base-node';
import { Vec2 } from '@shared/math/vec2';

/* ── Logging ────────────────────────────────────────────────── */
const LOG = '[Collab]';

/* ── Throttle constants ──────────────────────────────────────── */
const AWARENESS_INTERVAL_MS = 80;  // ~12 Hz cursor updates
const MOVE_THROTTLE_MS      = 50;  // ~20 Hz for drag operations
const MODIFY_THROTTLE_MS    = 50;  // ~20 Hz for property slider changes

/**
 * CollabProvider — bridges CollaborationService (WebSocket transport)
 * with the CanvasEngine scene graph for real-time multi-user editing.
 *
 * Architecture:
 *   LOCAL EDIT  ──► SceneEvent ──► serialize to SceneOp ──► WS broadcast
 *   REMOTE EDIT ◄── WS binary  ◄── deserialize SceneOp ◄── apply to scene graph
 *
 * Loop prevention:
 *   When applying remote operations, `_applyingRemote` is set to `true`.
 *   The scene event handler skips broadcasting when this flag is set.
 *
 * Throttling:
 *   High-frequency operations (move during drag, property slider changes)
 *   are debounced to ~20 Hz to avoid flooding the WebSocket.
 *
 * Conflict resolution:
 *   Last-writer-wins at the property level. Both users editing the same
 *   property simultaneously = last received value wins on each client.
 */
@Injectable({ providedIn: 'root' })
export class CollabProvider implements OnDestroy {
  private readonly collab = inject(CollaborationService);
  private readonly project = inject(ProjectService);
  private readonly auth = inject(AuthService);

  private engine: CanvasEngine | null = null;
  private unsubscribeScene: (() => void) | null = null;
  private unsubscribeCursor: (() => void) | null = null;
  private awarenessTimer: ReturnType<typeof setInterval> | null = null;

  /** True while applying remote operations — suppresses outbound broadcasts. */
  private _applyingRemote = false;

  /**
   * State cache — snapshot of each node's last-broadcast properties.
   * Used to compute minimal diffs (only changed properties are sent).
   * Deep-cloned to avoid reference aliasing with mutable node objects.
   */
  private _stateCache = new Map<string, Record<string, unknown>>();

  /** Move throttle — accumulates multi-node drag into single delta ops. */
  private _moveTimer: ReturnType<typeof setTimeout> | null = null;
  private _moveNodes: BaseNode[] | null = null;

  /** Per-node modify throttle — coalesces property changes at ~20 Hz. */
  private _modifyTimers = new Map<string, ReturnType<typeof setTimeout>>();

  /** Nodes that changed during a throttle window — flushed when timer expires. */
  private _modifyDirty = new Set<string>();

  /** Track cursor position for awareness broadcasts. */
  private _cursorWorld: [number, number] | null = null;

  /** Reusable TextEncoder — avoids allocation per broadcast. */
  private readonly _encoder = new TextEncoder();

  // ── Public signals ─────────────────────────────────────────

  /** Remote peer presence states. */
  readonly remotePeers = signal<Map<string, AwarenessState>>(new Map());

  /** Number of collaborators currently connected (excluding self). */
  readonly peerCount = computed(() => this.remotePeers().size);

  /** Whether collaboration is active. */
  readonly isConnected = computed(() => this.collab.state() === 'connected');

  /** Connection state forwarded from transport. */
  readonly connectionState = this.collab.state;

  ngOnDestroy(): void {
    this.detach();
  }

  // ── Lifecycle ──────────────────────────────────────────────

  /** Store engine reference and subscribe to scene graph events. */
  init(engine: CanvasEngine): void {
    this.engine = engine;

    // Wire CollaborationService callbacks
    this.collab.onYjsMessage = (type, data) => this.onRemoteOperation(type, data);
    this.collab.onAwarenessMessage = (data) => this.onRemoteAwareness(data);
    this.collab.onPeerJoined = (userId) => this.onPeerJoined(userId);
    this.collab.onPeerLeft = (userId) => this.onPeerLeft(userId);
    this.collab.onConnected = () => this.onConnected();

    // Subscribe to scene graph events for outbound broadcasting
    this.unsubscribeScene = engine.sceneGraph.on(event => {
      if (this._applyingRemote) return; // Loop prevention
      this.onLocalSceneEvent(event);
    });

    // Track cursor position
    this.setupCursorTracking();

    // Snapshot any existing nodes (scene may be loaded before collab connects)
    this.snapshotAllNodes();

  }

  /** Connect to a project room (call after scene graph is loaded). */
  connect(projectId: string): void {
    if (!this.engine) {
      console.warn(LOG, 'connect() called before init()');
      return;
    }

    // Snapshot all loaded nodes (scene was loaded from Supabase before connect)
    this.snapshotAllNodes();

    // Start awareness broadcasting
    this.startAwareness();

    // Connect to the WS room
    this.collab.connect(projectId);
  }

  /** Detach from the engine and disconnect. */
  detach(): void {
    this.collab.disconnect();
    this.collab.onYjsMessage = null;
    this.collab.onAwarenessMessage = null;
    this.collab.onPeerJoined = null;
    this.collab.onPeerLeft = null;
    this.collab.onConnected = null;

    this.unsubscribeScene?.();
    this.unsubscribeScene = null;

    this.unsubscribeCursor?.();
    this.unsubscribeCursor = null;

    this.stopAwareness();
    this.clearThrottles();
    this._stateCache.clear();
    this.engine?.remoteLerper.clear();
    this.remotePeers.set(new Map());
    this.engine = null;
  }

  /** Update cursor world position (called by canvas interaction layer). */
  setCursorWorld(x: number, y: number): void {
    this._cursorWorld = [x, y];
  }

  clearCursor(): void {
    this._cursorWorld = null;
  }

  // ── Outbound: Local → Remote ───────────────────────────────

  private onLocalSceneEvent(event: SceneEvent): void {
    if (!this.isConnected()) return;

    switch (event.type) {
      case 'node-added':
        this.broadcastNodeAdded(event.node);
        break;
      case 'node-removed':
        this._stateCache.delete(event.node.id);
        this.broadcastOp({ o: 'delete', id: event.node.id });
        break;
      case 'node-changed':
        // Skip nodes being interpolated by the remote lerper
        if (this.engine?.remoteLerper.isLerping(event.node.id)) return;
        this.broadcastNodeChanged(event.node);
        break;
      case 'nodes-changed': {
        // Filter out nodes being interpolated by the remote lerper
        const lerper = this.engine?.remoteLerper;
        const localNodes = lerper
          ? event.nodes.filter(n => !lerper.isLerping(n.id))
          : event.nodes;
        if (localNodes.length > 0) {
          this.broadcastNodesChanged(localNodes);
        }
        break;
      }
      case 'node-reordered':
        this.broadcastNodeReordered(event.node);
        break;
      // hierarchy-changed is a derived event — no need to broadcast
    }
  }

  private broadcastNodeAdded(node: BaseNode): void {
    // Don't broadcast root or page-level groups that are structural
    if (node.parent === this.engine?.sceneGraph.root) return;

    const parentId = node.parent?.id;
    if (!parentId) return;

    const model = this.serializeNodeShallow(node);
    const index = node.parent ? node.parent.children.indexOf(node) : undefined;
    this.broadcastOp({ o: 'create', n: model, p: parentId, i: index });

    // Snapshot the new node so future diffs work
    this.snapshotNode(node);
  }

  /**
   * Broadcast a multi-node drag as a single delta `move` op.
   *
   * All selected nodes share the same (dx, dy) displacement during drag,
   * so we compute delta from one node's cached position and send one op
   * with all IDs. This is >10× smaller than individual full-property modifies.
   */
  private broadcastNodesChanged(nodes: BaseNode[]): void {
    if (nodes.length === 0) return;

    const ref = nodes[0];
    const cached = this._stateCache.get(ref.id);

    if (!cached || typeof cached['x'] !== 'number' || typeof cached['y'] !== 'number') {
      for (const n of nodes) this.broadcastNodeChanged(n);
      return;
    }

    const dx = ref.x - (cached['x'] as number);
    const dy = ref.y - (cached['y'] as number);

    // Skip negligible movement
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

    // Store nodes reference for deferred flush
    this._moveNodes = nodes;

    if (this._moveTimer) return; // Timer pending — flush will pick up latest

    // Send immediately
    this.flushMove(dx, dy, nodes);

    // Set timer for deferred updates within the throttle window
    this._moveTimer = setTimeout(() => {
      this._moveTimer = null;
      const pending = this._moveNodes;
      this._moveNodes = null;
      if (!pending || pending.length === 0) return;

      // Recompute delta from current cache (updated by the last flush)
      const r = pending[0];
      const c = this._stateCache.get(r.id);
      if (!c || typeof c['x'] !== 'number') return;

      const ddx = r.x - (c['x'] as number);
      const ddy = r.y - (c['y'] as number);
      if (Math.abs(ddx) < 0.01 && Math.abs(ddy) < 0.01) return;

      this.flushMove(ddx, ddy, pending);
    }, MOVE_THROTTLE_MS);
  }

  /** Actually send a move op and update the position cache. */
  private flushMove(dx: number, dy: number, nodes: BaseNode[]): void {
    const ids = nodes.map(n => n.id);
    this.broadcastOp({ o: 'move', ids, dx, dy });

    // Update cached positions
    for (const n of nodes) {
      const c = this._stateCache.get(n.id);
      if (c) {
        c['x'] = n.x;
        c['y'] = n.y;
      }
    }
  }

  /**
   * Broadcast a single-node property change with minimal diff.
   *
   * Compares the node's current state against a cached snapshot and sends
   * only the properties that actually changed. This avoids sending fill,
   * stroke, name, etc. when only x/y changed — reducing false conflicts
   * and saving bandwidth.
   */
  private broadcastNodeChanged(node: BaseNode): void {
    // If throttled, mark dirty — the timer will re-diff and flush
    if (this._modifyTimers.has(node.id)) {
      this._modifyDirty.add(node.id);
      return;
    }

    // Compute diff and send
    const diff = this.computeNodeDiff(node);
    if (!diff) return;

    this.broadcastOp({ o: 'modify', id: node.id, props: diff });

    // Start throttle window — any changes during this window are deferred
    this._modifyTimers.set(node.id, setTimeout(() => {
      this._modifyTimers.delete(node.id);
      // Flush accumulated changes that arrived during the throttle window
      if (this._modifyDirty.delete(node.id)) {
        const n = this.engine?.sceneGraph.getNode(node.id);
        if (n && !this._applyingRemote) {
          this.broadcastNodeChanged(n);
        }
      }
    }, MODIFY_THROTTLE_MS));
  }

  /**
   * Compute the property diff between a node's current state and its cached
   * snapshot. Updates the cache to match current state. Returns null if
   * nothing changed.
   */
  private computeNodeDiff(node: BaseNode): Record<string, unknown> | null {
    const cached = this._stateCache.get(node.id);
    const current = this.getNodeProps(node);

    if (!cached) {
      // No cache — send full state, create snapshot
      this._stateCache.set(node.id, this.deepClone(current));
      return current;
    }

    // Compute diff — only changed properties
    const diff: Record<string, unknown> = {};
    let hasChanges = false;

    for (const key of Object.keys(current)) {
      if (!this.propsEqual(cached[key], current[key])) {
        diff[key] = current[key];
        // Update cache entry for this property
        cached[key] = typeof current[key] === 'object' && current[key] !== null
          ? JSON.parse(JSON.stringify(current[key]))
          : current[key];
        hasChanges = true;
      }
    }

    return hasChanges ? diff : null;
  }

  private broadcastNodeReordered(node: BaseNode): void {
    if (!node.parent) return;
    const index = node.parent.children.indexOf(node);
    this.broadcastOp({
      o: 'reorder',
      id: node.id,
      np: node.parent.id,
      i: index,
    });
  }

  /** Encode and send a scene operation via WebSocket. */
  private broadcastOp(op: SceneOp): void {
    const json = JSON.stringify(op);
    const payload = this._encoder.encode(json);
    this.collab.sendYjsUpdate(payload);
  }

  // ── Inbound: Remote → Local ────────────────────────────────

  private onRemoteOperation(_type: number, data: Uint8Array): void {
    const op = decodeSceneOp(data);
    if (!op) return;

    this._applyingRemote = true;
    try {
      this.applyOp(op);
    } catch (e) {
      console.error(LOG, 'failed to apply remote op:', e, op);
    } finally {
      this._applyingRemote = false;
    }
  }

  private applyOp(op: SceneOp): void {
    if (!this.engine) return;
    const sg = this.engine.sceneGraph;

    switch (op.o) {
      case 'create': {
        // Check if node already exists (idempotent)
        if (sg.hasNode(op.n.id)) return;

        const parent = sg.getNode(op.p);
        if (!parent) {
          console.warn(LOG, 'create: parent not found', op.p);
          return;
        }

        const node = this.deserializeNodeShallow(op.n);
        sg.addNode(node, parent, op.i);
        this.snapshotNode(node);
        break;
      }

      case 'delete': {
        const node = sg.getNode(op.id);
        if (!node) return; // already deleted
        this._stateCache.delete(op.id);
        this.engine!.remoteLerper.removeTarget(op.id);
        sg.removeNode(node);
        break;
      }

      case 'modify': {
        const node = sg.getNode(op.id);
        if (!node) return;

        // Separate geometry props (lerped) from visual props (applied immediately)
        const geomTarget: Record<string, number> = {};
        const visualProps: Record<string, unknown> = {};
        const GEOM_KEYS = new Set(['x', 'y', 'width', 'height', 'scaleX', 'scaleY', 'rotation']);

        for (const [key, value] of Object.entries(op.props)) {
          if (GEOM_KEYS.has(key) && typeof value === 'number') {
            geomTarget[key] = value;
          } else {
            visualProps[key] = value;
          }
        }

        // Lerp geometry changes for smoothness
        if (Object.keys(geomTarget).length > 0) {
          this.engine!.remoteLerper.setTarget(op.id, geomTarget as any);
        }

        // Apply non-geometry props immediately (fill, stroke, opacity, etc.)
        if (Object.keys(visualProps).length > 0) {
          this.applyProperties(node, visualProps);
          sg.notifyNodeChanged(node);
        }

        // Update state cache with the received values
        const cached = this._stateCache.get(op.id);
        if (cached) {
          for (const [key, value] of Object.entries(op.props)) {
            cached[key] = typeof value === 'object' && value !== null
              ? JSON.parse(JSON.stringify(value))
              : value;
          }
        }
        break;
      }

      case 'move': {
        // Use lerper for smooth interpolation instead of snapping
        this.engine!.remoteLerper.addDelta(op.ids, op.dx, op.dy);

        // Update position cache to the final target
        for (const id of op.ids) {
          const cached = this._stateCache.get(id);
          if (cached && typeof cached['x'] === 'number' && typeof cached['y'] === 'number') {
            cached['x'] = (cached['x'] as number) + op.dx;
            cached['y'] = (cached['y'] as number) + op.dy;
          }
        }
        break;
      }

      case 'resize': {
        const node = sg.getNode(op.id);
        if (!node) return;

        // Use lerper for smooth interpolation
        this.engine!.remoteLerper.setTarget(op.id, {
          x: op.x, y: op.y,
          width: op.w, height: op.h,
          scaleX: op.sx, scaleY: op.sy,
        });

        // Update cache to the final target values
        const cached = this._stateCache.get(op.id);
        if (cached) {
          cached['x'] = op.x;
          cached['y'] = op.y;
          cached['width'] = op.w;
          cached['height'] = op.h;
          cached['scaleX'] = op.sx;
          cached['scaleY'] = op.sy;
        }
        break;
      }

      case 'reorder': {
        const node = sg.getNode(op.id);
        const newParent = sg.getNode(op.np);
        if (!node || !newParent) return;
        sg.moveNode(node, newParent, op.i);
        break;
      }

      case 'batch': {
        sg.beginBatch();
        for (const subOp of op.ops) {
          this.applyOp(subOp);
        }
        sg.endBatch();
        break;
      }

      case 'full-sync': {
        // Full state from peer — rebuild scene graph
        this.applyFullSync(op.nodes);
        break;
      }

      case 'sync-request': {
        // A peer is asking for current state
        this.sendFullSync();
        break;
      }
    }
  }

  // ── Awareness ──────────────────────────────────────────────

  private onRemoteAwareness(data: Uint8Array): void {
    const state = decodeAwareness(data);
    if (!state) return;

    this.remotePeers.update(peers => {
      const next = new Map(peers);
      next.set(state.u, state);
      return next;
    });
  }

  private onPeerJoined(_userId: string): void {
    // Peer presence is handled via awareness
  }

  private onPeerLeft(userId: string): void {
    this.remotePeers.update(peers => {
      const next = new Map(peers);
      next.delete(userId);
      return next;
    });
  }

  private onConnected(): void {
    // Request current state from existing peers
    const json = JSON.stringify({ o: 'sync-request' });
    this.collab.sendYjsUpdate(this._encoder.encode(json));
  }

  private startAwareness(): void {
    this.awarenessTimer = setInterval(() => {
      if (!this.isConnected()) return;

      const user = this.auth.user();
      if (!user) return;

      const selectedIds = this.engine?.selection.selectedNodeIds ?? [];

      const state: AwarenessState = {
        u: user.id,
        c: this._cursorWorld,
        s: selectedIds,
        n: this.auth.displayName() ?? 'Anonymous',
        cl: '#3b82f6',
      };

      const json = JSON.stringify(state);
      this.collab.sendAwareness(this._encoder.encode(json));
    }, AWARENESS_INTERVAL_MS);
  }

  private stopAwareness(): void {
    if (this.awarenessTimer) {
      clearInterval(this.awarenessTimer);
      this.awarenessTimer = null;
    }
  }

  private setupCursorTracking(): void {
    if (!this.engine) return;

    this.unsubscribeCursor = this.engine.interaction.onPointerMove(e => {
      this._cursorWorld = [e.worldPosition.x, e.worldPosition.y];
    });
  }

  // ── Full Sync ──────────────────────────────────────────────

  private sendFullSync(): void {
    if (!this.engine) return;

    const pages = this.engine.sceneGraph.root.children;
    const models: SceneNodeModel[] = pages.map(page => this.serializeNodeDeep(page));

    this.broadcastOp({ o: 'full-sync', nodes: models });
  }

  private applyFullSync(pageModels: SceneNodeModel[]): void {
    if (!this.engine) return;

    const sg = this.engine.sceneGraph;
    // Clear state cache and lerp targets — will rebuild after adding nodes
    this._stateCache.clear();
    this.engine.remoteLerper.clear();

    this.engine.runWithoutAutoPageSelection(() => {
      this.engine!.selection.clearSelection();
      sg.clear();

      for (const pageModel of pageModels) {
        const page = this.deserializeNodeDeep(pageModel);
        sg.addNode(page);
      }

      const firstPageId = sg.root.children[0]?.id;
      if (firstPageId) {
        this.engine!.setActivePage(firstPageId);
      }
    });

    // Snapshot every node for future diffs
    this.snapshotAllNodes();
  }

  /** Snapshot all nodes in the scene graph for diff tracking. */
  private snapshotAllNodes(): void {
    if (!this.engine) return;
    this.engine.sceneGraph.forEachNode(node => {
      if (node !== this.engine!.sceneGraph.root) {
        this.snapshotNode(node);
      }
    });
  }

  // ── Serialization Helpers ──────────────────────────────────

  /**
   * Serialize a node (without children) to SceneNodeModel.
   * Used for 'create' operations.
   */
  private serializeNodeShallow(node: BaseNode): SceneNodeModel {
    const raw = node.toJSON() as Record<string, unknown>;

    const base: SceneNodeModel = {
      id: node.id, // preserve original ID for cross-client sync
      type: node.type,
      name: node.name,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      rotation: node.rotation,
      scaleX: node.scaleX,
      scaleY: node.scaleY,
      fill: { ...node.fill },
      stroke: { ...node.stroke },
      opacity: node.opacity,
      visible: node.visible,
      locked: node.locked,
      parentId: node.parent?.id ?? null,
      children: [],
      data: {},
    };

    const reserved = new Set([
      'id', 'type', 'name', 'x', 'y', 'width', 'height', 'rotation',
      'scaleX', 'scaleY', 'fill', 'stroke', 'opacity', 'visible', 'locked', 'children',
    ]);

    for (const [key, value] of Object.entries(raw)) {
      if (reserved.has(key)) continue;
      base.data[key] = value;
    }

    return base;
  }

  /**
   * Serialize a node and all its children recursively.
   */
  private serializeNodeDeep(node: BaseNode): SceneNodeModel {
    const model = this.serializeNodeShallow(node);
    model.children = node.children.map(child => this.serializeNodeDeep(child));
    return model;
  }

  /**
   * Deserialize a SceneNodeModel into a BaseNode (without children).
   * Preserves the original ID (unlike ProjectService which regenerates IDs).
   */
  private deserializeNodeShallow(model: SceneNodeModel): BaseNode {
    const node = this.createNodeByType(model.type, model.name, model.id);

    node.x = model.x;
    node.y = model.y;
    node.width = model.width;
    node.height = model.height;
    node.rotation = model.rotation;
    node.scaleX = model.scaleX;
    node.scaleY = model.scaleY;
    node.fill = { ...model.fill };
    node.stroke = { ...model.stroke };
    node.opacity = model.opacity;
    node.visible = model.visible;
    node.locked = model.locked;

    this.applyTypeData(node, model.data);
    return node;
  }

  /**
   * Deserialize a SceneNodeModel with all children recursively.
   */
  private deserializeNodeDeep(model: SceneNodeModel): BaseNode {
    const node = this.deserializeNodeShallow(model);
    for (const childModel of model.children ?? []) {
      const child = this.deserializeNodeDeep(childModel);
      node.addChild(child);
    }
    return node;
  }

  /**
   * Apply properties from a modify operation to an existing node.
   */
  private applyProperties(node: BaseNode, props: Record<string, unknown>): void {
    // Base properties
    if (typeof props['x'] === 'number') node.x = props['x'];
    if (typeof props['y'] === 'number') node.y = props['y'];
    if (typeof props['width'] === 'number') node.width = props['width'];
    if (typeof props['height'] === 'number') node.height = props['height'];
    if (typeof props['rotation'] === 'number') node.rotation = props['rotation'];
    if (typeof props['scaleX'] === 'number') node.scaleX = props['scaleX'];
    if (typeof props['scaleY'] === 'number') node.scaleY = props['scaleY'];
    if (typeof props['opacity'] === 'number') node.opacity = props['opacity'];
    if (typeof props['visible'] === 'boolean') node.visible = props['visible'];
    if (typeof props['locked'] === 'boolean') node.locked = props['locked'];
    if (typeof props['name'] === 'string') node.name = props['name'];

    if (props['fill'] && typeof props['fill'] === 'object') {
      node.fill = { ...node.fill, ...(props['fill'] as any) };
    }
    if (props['stroke'] && typeof props['stroke'] === 'object') {
      node.stroke = { ...node.stroke, ...(props['stroke'] as any) };
    }

    // Type-specific properties — delegate to the same logic as ProjectService
    this.applyTypeData(node, props);

    node.markTransformDirty();
    node.markRenderDirty();
    node.markBoundsDirty();
  }

  /**
   * Create a node by type, optionally with a specific ID.
   */
  private createNodeByType(type: NodeType, name: string, id?: string): BaseNode {
    let node: BaseNode;
    switch (type) {
      case 'rectangle': node = new RectangleNode(name); break;
      case 'ellipse':   node = new EllipseNode(name); break;
      case 'polygon':   node = new PolygonNode(name); break;
      case 'star':      node = new StarNode(name); break;
      case 'line':      node = new LineNode(name); break;
      case 'arrow':     node = new ArrowNode(name); break;
      case 'text':      node = new TextNode(name); break;
      case 'image':     node = new ImageNode(name); break;
      case 'video':     node = new VideoNode(name); break;
      case 'path':      node = new PathNode(name); break;
      case 'group':
      default:          node = new GroupNode(name); break;
    }

    // Override the auto-generated ID to preserve cross-client identity
    if (id) {
      (node as any).id = id;
    }

    return node;
  }

  /**
   * Apply type-specific data to a node (mirrors ProjectService.applyTypeData).
   */
  private applyTypeData(node: BaseNode, data: Record<string, unknown> | undefined): void {
    if (!data) return;

    if (node instanceof RectangleNode && typeof data['cornerRadius'] === 'number') {
      node.cornerRadius = data['cornerRadius'];
    }

    if (node instanceof PolygonNode && typeof data['sides'] === 'number') {
      node.sides = data['sides'];
    }

    if (node instanceof StarNode) {
      if (typeof data['points'] === 'number') node.points = data['points'];
      if (typeof data['innerRadiusRatio'] === 'number') node.innerRadiusRatio = data['innerRadiusRatio'];
    }

    if (node instanceof LineNode) {
      const sp = data['startPoint'];
      const ep = data['endPoint'];
      if (Array.isArray(sp) && sp.length === 2) node.startPoint = new Vec2(Number(sp[0]), Number(sp[1]));
      if (Array.isArray(ep) && ep.length === 2) node.endPoint = new Vec2(Number(ep[0]), Number(ep[1]));
    }

    if (node instanceof ArrowNode) {
      const sp = data['startPoint'];
      const ep = data['endPoint'];
      if (Array.isArray(sp) && sp.length === 2) node.startPoint = new Vec2(Number(sp[0]), Number(sp[1]));
      if (Array.isArray(ep) && ep.length === 2) node.endPoint = new Vec2(Number(ep[0]), Number(ep[1]));
      if (typeof data['startArrow'] === 'string') node.startArrow = data['startArrow'] as ArrowNode['startArrow'];
      if (typeof data['endArrow'] === 'string') node.endArrow = data['endArrow'] as ArrowNode['endArrow'];
      if (typeof data['arrowSize'] === 'number') node.arrowSize = data['arrowSize'];
    }

    if (node instanceof TextNode) {
      if (typeof data['text'] === 'string') node.text = data['text'];
      if (typeof data['fontSize'] === 'number') node.fontSize = data['fontSize'];
      if (typeof data['fontFamily'] === 'string') node.fontFamily = data['fontFamily'];
      if (typeof data['fontWeight'] === 'string') node.fontWeight = data['fontWeight'] as TextNode['fontWeight'];
      if (typeof data['fontStyle'] === 'string') node.fontStyle = data['fontStyle'] as TextNode['fontStyle'];
      if (typeof data['textAlign'] === 'string') node.textAlign = data['textAlign'] as TextNode['textAlign'];
      if (typeof data['verticalAlign'] === 'string') node.verticalAlign = data['verticalAlign'] as TextNode['verticalAlign'];
      if (typeof data['lineHeight'] === 'number') node.lineHeight = data['lineHeight'];
      if (typeof data['letterSpacing'] === 'number') node.letterSpacing = data['letterSpacing'];
    }

    if (node instanceof ImageNode) {
      if (typeof data['src'] === 'string') node.src = data['src'];
      if (typeof data['naturalWidth'] === 'number') node.naturalWidth = data['naturalWidth'];
      if (typeof data['naturalHeight'] === 'number') node.naturalHeight = data['naturalHeight'];
      if (data['fit'] === 'fill' || data['fit'] === 'contain' || data['fit'] === 'cover') {
        node.fit = data['fit'];
      }
    }

    if (node instanceof VideoNode) {
      if (typeof data['src'] === 'string') node.src = data['src'];
      if (typeof data['posterSrc'] === 'string') node.posterSrc = data['posterSrc'];
      if (typeof data['naturalWidth'] === 'number') node.naturalWidth = data['naturalWidth'];
      if (typeof data['naturalHeight'] === 'number') node.naturalHeight = data['naturalHeight'];
      if (typeof data['duration'] === 'number') node.duration = data['duration'];
    }

    if (node instanceof GroupNode && typeof data['expanded'] === 'boolean') {
      node.expanded = data['expanded'];
    }

    if (node instanceof PathNode) {
      if (typeof data['closed'] === 'boolean') node.closed = data['closed'];

      const anchorsRaw = data['anchors'];
      if (Array.isArray(anchorsRaw)) {
        const anchors: PathAnchor[] = [];
        for (const item of anchorsRaw) {
          if (!item || typeof item !== 'object') continue;
          const rec = item as Record<string, unknown>;
          const position = rec['position'];
          const handleIn = rec['handleIn'];
          const handleOut = rec['handleOut'];
          const type = rec['type'];
          if (!Array.isArray(position) || !Array.isArray(handleIn) || !Array.isArray(handleOut)) continue;
          if (position.length !== 2 || handleIn.length !== 2 || handleOut.length !== 2) continue;
          anchors.push({
            position: new Vec2(Number(position[0]), Number(position[1])),
            handleIn: new Vec2(Number(handleIn[0]), Number(handleIn[1])),
            handleOut: new Vec2(Number(handleOut[0]), Number(handleOut[1])),
            type: (typeof type === 'string' ? type : 'sharp') as AnchorType,
          });
        }
        node.anchors = anchors;
      }
    }
  }

  private clearThrottles(): void {
    if (this._moveTimer) {
      clearTimeout(this._moveTimer);
      this._moveTimer = null;
    }
    this._moveNodes = null;

    for (const timer of this._modifyTimers.values()) {
      clearTimeout(timer);
    }
    this._modifyTimers.clear();
    this._modifyDirty.clear();
  }

  // ── State Cache Helpers ────────────────────────────────────

  /**
   * Extract a flat property map from a node — no children, no id/type.
   * Uses `toJSON()` for correctness (includes type-specific props),
   * but strips children to avoid recursive serialization overhead.
   */
  private getNodeProps(node: BaseNode): Record<string, unknown> {
    const raw = node.toJSON();
    const props: Record<string, unknown> = {};
    for (const key of Object.keys(raw)) {
      if (key === 'children' || key === 'id' || key === 'type') continue;
      props[key] = raw[key];
    }
    return props;
  }

  /** Cache a deep clone of a node's properties for future diffs. */
  private snapshotNode(node: BaseNode): void {
    this._stateCache.set(node.id, this.deepClone(this.getNodeProps(node)));
  }

  /** Compare two property values for equality. */
  private propsEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (a == null || b == null) return a === b;
    if (typeof a !== typeof b) return false;
    if (typeof a === 'object') {
      return JSON.stringify(a) === JSON.stringify(b);
    }
    return false;
  }

  /** Deep clone a plain JSON-compatible object. */
  private deepClone<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj));
  }
}
