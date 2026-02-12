import { BaseNode } from '../scene-graph/base-node';
import { Bounds, MutableBounds } from '@shared/math/bounds';

/**
 * SelectionManager tracks the set of currently selected nodes.
 */
export class SelectionManager {
  private selectedIds = new Set<string>();
  private nodesMap = new Map<string, BaseNode>();
  private _bounds: Bounds = Bounds.EMPTY;
  private _boundsDirty: boolean = true;

  private listeners: Array<() => void> = [];
  private _cachedIds: string[] | null = null;

  /** Subscribe to selection changes. */
  onChange(handler: () => void): () => void {
    this.listeners.push(handler);
    return () => {
      const idx = this.listeners.indexOf(handler);
      if (idx >= 0) this.listeners.splice(idx, 1);
    };
  }

  private notifyChange(): void {
    this._boundsDirty = true;
    this._cachedIds = null;
    for (const listener of this.listeners) {
      listener();
    }
  }

  /**
   * Mark selection bounds dirty without changing the selection set.
   * Useful when selected nodes move/resize.
   */
  invalidateBounds(): void {
    this._boundsDirty = true;
  }

  /**
   * Notify listeners that the selection's geometry changed (move/resize),
   * even if the selected IDs did not change.
   */
  notifyUpdated(): void {
    this._boundsDirty = true;
    for (const listener of this.listeners) {
      listener();
    }
  }

  /** Select a single node (replaces current selection). */
  select(node: BaseNode): void {
    this.selectedIds.clear();
    this.nodesMap.clear();
    this.selectedIds.add(node.id);
    this.nodesMap.set(node.id, node);
    this.notifyChange();
  }

  /** Add a node to the selection. */
  addToSelection(node: BaseNode): void {
    this.selectedIds.add(node.id);
    this.nodesMap.set(node.id, node);
    this.notifyChange();
  }

  /** Remove a node from the selection. */
  removeFromSelection(node: BaseNode): void {
    this.selectedIds.delete(node.id);
    this.nodesMap.delete(node.id);
    this.notifyChange();
  }

  /** Toggle a node's selection state. */
  toggleSelection(node: BaseNode): void {
    if (this.selectedIds.has(node.id)) {
      this.removeFromSelection(node);
    } else {
      this.addToSelection(node);
    }
  }

  /** Select multiple nodes (replaces current selection). */
  selectMultiple(nodes: BaseNode[]): void {
    this.selectedIds.clear();
    this.nodesMap.clear();
    for (const node of nodes) {
      this.selectedIds.add(node.id);
      this.nodesMap.set(node.id, node);
    }
    this.notifyChange();
  }

  /**
   * Incrementally sync the selection to match a target set of IDs.
   *
   * Only adds/removes the delta between the current selection and the
   * target. Skips notification entirely when nothing changed.
   *
   * Much faster than `selectMultiple()` during marquee drag because
   * most frames only add/remove 0–2 nodes rather than rebuilding the
   * entire Map and Set from scratch.
   *
   * @param targetIds  The desired set of selected node IDs.
   * @param resolve    Callback to look up a BaseNode by ID (only called
   *                   for nodes being *added* to the selection).
   */
  syncToSet(targetIds: Set<string>, resolve: (id: string) => BaseNode | undefined): void {
    let changed = false;

    // Remove nodes that are no longer in the target
    for (const id of this.selectedIds) {
      if (!targetIds.has(id)) {
        this.selectedIds.delete(id);
        this.nodesMap.delete(id);
        changed = true;
      }
    }

    // Add nodes that are new in the target
    for (const id of targetIds) {
      if (!this.selectedIds.has(id)) {
        const node = resolve(id);
        if (node) {
          this.selectedIds.add(id);
          this.nodesMap.set(id, node);
          changed = true;
        }
      }
    }

    if (changed) {
      this.notifyChange();
    }
  }

  /** Clear selection. */
  clearSelection(): void {
    this.selectedIds.clear();
    this.nodesMap.clear();
    this.notifyChange();
  }

  /** Check if a node is selected. */
  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  /** Get all selected node IDs (cached until selection changes). */
  get selectedNodeIds(): string[] {
    if (!this._cachedIds) {
      this._cachedIds = Array.from(this.selectedIds);
    }
    return this._cachedIds;
  }

  /** Get all selected nodes. */
  get selectedNodes(): BaseNode[] {
    return Array.from(this.nodesMap.values());
  }

  /** Number of selected nodes. */
  get count(): number {
    return this.selectedIds.size;
  }

  /** Whether anything is selected. */
  get hasSelection(): boolean {
    return this.selectedIds.size > 0;
  }

  /** Get the combined bounds of all selected nodes. */
  get bounds(): Bounds {
    if (this._boundsDirty) {
      this.recomputeBounds();
    }
    return this._bounds;
  }

  private recomputeBounds(): void {
    if (this.selectedIds.size === 0) {
      this._bounds = Bounds.EMPTY;
    } else {
      const mb = new MutableBounds();
      for (const node of this.nodesMap.values()) {
        mb.unionMut(node.worldBounds);
      }
      this._bounds = mb.toImmutable();
    }
    this._boundsDirty = false;
  }
}
