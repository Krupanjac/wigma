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

  /** Get all selected node IDs. */
  get selectedNodeIds(): string[] {
    return Array.from(this.selectedIds);
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
