import { BaseNode } from './base-node';
import { GroupNode } from './group-node';

/**
 * Event types emitted by the SceneGraphManager.
 */
export type SceneEvent =
  | { type: 'node-added'; node: BaseNode }
  | { type: 'node-removed'; node: BaseNode }
  | { type: 'node-changed'; node: BaseNode }
  | { type: 'nodes-changed'; nodes: BaseNode[] }
  | { type: 'node-reordered'; node: BaseNode }
  | { type: 'hierarchy-changed' };

export type SceneEventHandler = (event: SceneEvent) => void;

/**
 * SceneGraphManager maintains the scene tree and a flat Map<string, BaseNode>
 * for O(1) ID lookup. Emits change events consumed by SpatialIndex and RenderManager.
 */
export class SceneGraphManager {
  /** Root of the scene tree. */
  readonly root: GroupNode;

  /** Flat map of all nodes by ID for O(1) lookup. */
  private nodeMap = new Map<string, BaseNode>();

  /** Event listeners. */
  private listeners: SceneEventHandler[] = [];

  /** Batch depth counter — when > 0, hierarchy-changed events are deferred. */
  private _batchDepth = 0;
  private _pendingHierarchyChanged = false;

  constructor() {
    this.root = new GroupNode('Root');
    this.nodeMap.set(this.root.id, this.root);
  }

  /**
   * Begin a batch operation. While batched, `hierarchy-changed` events
   * are coalesced and emitted once when the outermost batch ends.
   * Nest-safe: maintains a depth counter.
   */
  beginBatch(): void {
    this._batchDepth++;
  }

  /**
   * End a batch operation. When the outermost batch ends, a single
   * `hierarchy-changed` event is emitted if any were deferred.
   */
  endBatch(): void {
    this._batchDepth = Math.max(0, this._batchDepth - 1);
    if (this._batchDepth === 0 && this._pendingHierarchyChanged) {
      this._pendingHierarchyChanged = false;
      this.emit({ type: 'hierarchy-changed' });
    }
  }

  /** Subscribe to scene events. */
  on(handler: SceneEventHandler): () => void {
    this.listeners.push(handler);
    return () => {
      const idx = this.listeners.indexOf(handler);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private emit(event: SceneEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Get a node by ID. O(1). */
  getNode(id: string): BaseNode | undefined {
    return this.nodeMap.get(id);
  }

  /** Check if a node exists. O(1). */
  hasNode(id: string): boolean {
    return this.nodeMap.has(id);
  }

  /** Get all nodes (creates a new array — avoid in hot paths). */
  getAllNodes(): BaseNode[] {
    return Array.from(this.nodeMap.values());
  }

  /** Iterate all nodes without allocating an array. Use in hot paths (render loop). */
  forEachNode(callback: (node: BaseNode) => void): void {
    for (const node of this.nodeMap.values()) {
      callback(node);
    }
  }

  /** Total number of nodes (including root). */
  get nodeCount(): number {
    return this.nodeMap.size;
  }

  /**
   * Add a node to a parent. If no parent specified, adds to root.
   * Recursively registers all descendants in the flat map.
   */
  addNode(node: BaseNode, parent?: BaseNode, index?: number): void {
    const targetParent = parent ?? this.root;

    if (index !== undefined) {
      // Insert at specific position
      if (node.parent) {
        node.parent.removeChild(node);
      }
      node.parent = targetParent;
      targetParent.children.splice(index, 0, node);
      // Reindex render orders
      for (let i = 0; i < targetParent.children.length; i++) {
        targetParent.children[i].renderOrder = i;
      }
      node.markTransformDirty();
    } else {
      targetParent.addChild(node);
    }

    this.registerNode(node);
    this.emitNodeAddedRecursive(node);
    this.emitHierarchyChanged();
  }

  /** Remove a node from the scene graph. */
  removeNode(node: BaseNode): void {
    if (node === this.root) return; // Cannot remove root

    if (node.parent) {
      node.parent.removeChild(node);
    }

    this.emitNodeRemovedRecursive(node);
    this.unregisterNode(node);
    this.emitHierarchyChanged();
  }

  /** Move a node to a new parent or position. */
  moveNode(node: BaseNode, newParent: BaseNode, index?: number): void {
    if (node === this.root) return;

    if (node.parent) {
      node.parent.removeChild(node);
    }

    if (index !== undefined) {
      node.parent = newParent;
      newParent.children.splice(index, 0, node);
      for (let i = 0; i < newParent.children.length; i++) {
        newParent.children[i].renderOrder = i;
      }
      node.markTransformDirty();
    } else {
      newParent.addChild(node);
    }

    this.emit({ type: 'node-reordered', node });
    this.emitHierarchyChanged();
  }

  /** Notify that a node's properties changed. */
  notifyNodeChanged(node: BaseNode): void {
    this.emit({ type: 'node-changed', node });
  }

  /**
   * Batch-notify that multiple nodes changed (e.g. during drag).
   * Emits a single 'nodes-changed' event instead of N individual ones.
   * Listeners should update indices once for the whole batch.
   */
  notifyNodesChanged(nodes: BaseNode[]): void {
    this.emit({ type: 'nodes-changed', nodes });
  }

  /** Get a flat ordered list for rendering (depth-first pre-order). */
  getRenderOrder(): BaseNode[] {
    const result: BaseNode[] = [];
    this.collectRenderOrder(this.root, result);
    return result;
  }

  private collectRenderOrder(node: BaseNode, result: BaseNode[]): void {
    for (const child of node.children) {
      result.push(child);
      if (child.children.length > 0) {
        this.collectRenderOrder(child, result);
      }
    }
  }

  private registerNode(node: BaseNode): void {
    this.nodeMap.set(node.id, node);
    for (const child of node.children) {
      this.registerNode(child);
    }
  }

  private unregisterNode(node: BaseNode): void {
    this.nodeMap.delete(node.id);
    for (const child of node.children) {
      this.unregisterNode(child);
    }
  }

  private emitNodeAddedRecursive(node: BaseNode): void {
    this.emit({ type: 'node-added', node });
    for (const child of node.children) {
      this.emitNodeAddedRecursive(child);
    }
  }

  private emitNodeRemovedRecursive(node: BaseNode): void {
    for (const child of node.children) {
      this.emitNodeRemovedRecursive(child);
    }
    this.emit({ type: 'node-removed', node });
  }

  /** Emit hierarchy-changed, or defer it when inside a batch. */
  private emitHierarchyChanged(): void {
    if (this._batchDepth > 0) {
      this._pendingHierarchyChanged = true;
    } else {
      this.emit({ type: 'hierarchy-changed' });
    }
  }

  /** Clear all nodes except root. */
  clear(): void {
    this.beginBatch();
    const children = [...this.root.children];
    for (const child of children) {
      this.removeNode(child);
    }
    this.endBatch();
  }
}
