import RBush from 'rbush';
import { Bounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';
import { RTREE_MAX_ENTRIES } from '@shared/constants';

/**
 * Internal item stored in the R-tree.
 * Extends rbush's BBox interface with an `id` field.
 */
interface RBushItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
}

/**
 * R-tree spatial index facade wrapping rbush.
 *
 * Provides a unified API for all spatial queries:
 * - Insert/Remove/Update: O(log_M n)
 * - Range query (viewport culling): O(log_M n + k)
 * - Point query (hit-testing broad phase): O(log_M n + k)
 * - Bulk load: O(n log n) via STR packing
 *
 * Internally, each item is stored as { minX, minY, maxX, maxY, id }.
 * An Map<string, RBushItem> maintains ID → item mapping for O(1) lookups.
 */
export class SpatialIndex {
  private tree: RBush<RBushItem>;
  private itemMap = new Map<string, RBushItem>();

  constructor(maxEntries: number = RTREE_MAX_ENTRIES) {
    this.tree = new RBush<RBushItem>(maxEntries);
  }

  /** Insert an item into the spatial index. O(log_M n). */
  insert(id: string, bounds: Bounds): void {
    if (this.itemMap.has(id)) {
      this.remove(id);
    }

    const item: RBushItem = {
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
      id,
    };

    this.itemMap.set(id, item);
    this.tree.insert(item);
  }

  /** Remove an item from the spatial index. O(log_M n). */
  remove(id: string): void {
    const item = this.itemMap.get(id);
    if (!item) return;
    this.tree.remove(item, (a, b) => a.id === b.id);
    this.itemMap.delete(id);
  }

  /**
   * Update an item's bounds. Equivalent to remove + insert.
   * O(log_M n).
   */
  update(id: string, newBounds: Bounds): void {
    this.remove(id);
    this.insert(id, newBounds);
  }

  /**
   * Batch-update multiple items' bounds.
   * More efficient than N individual update() calls because it
   * updates the in-place item coordinates and rebuilds the tree once.
   * O(n log n) for rebuild vs O(n × log_M n) for individual updates.
   */
  updateBatch(updates: Array<{ id: string; bounds: Bounds }>): void {
    if (updates.length === 0) return;

    // For small batches, individual updates are fine
    if (updates.length < 10) {
      for (const { id, bounds } of updates) {
        this.update(id, bounds);
      }
      return;
    }

    // For large batches, update in-place and rebuild the tree
    for (const { id, bounds } of updates) {
      const item = this.itemMap.get(id);
      if (item) {
        item.minX = bounds.minX;
        item.minY = bounds.minY;
        item.maxX = bounds.maxX;
        item.maxY = bounds.maxY;
      } else {
        const newItem: RBushItem = {
          minX: bounds.minX, minY: bounds.minY,
          maxX: bounds.maxX, maxY: bounds.maxY,
          id,
        };
        this.itemMap.set(id, newItem);
      }
    }

    // Rebuild the tree from all items
    this.tree.clear();
    this.tree.load(Array.from(this.itemMap.values()));
  }

  /**
   * Range query — find all items whose bounds intersect the query rectangle.
   * Used for viewport culling and marquee selection.
   * O(log_M n + k), k = number of results.
   */
  queryRange(bounds: Bounds): string[] {
    const results = this.tree.search({
      minX: bounds.minX,
      minY: bounds.minY,
      maxX: bounds.maxX,
      maxY: bounds.maxY,
    });
    return results.map(r => r.id);
  }

  /**
   * Point query — find all items whose bounds contain the point.
   * Used for hit-testing broad phase.
   * Special case of range query with a zero-area rectangle.
   * O(log_M n + k), k = number of results.
   */
  queryPoint(point: Vec2): string[] {
    return this.queryRange(
      new Bounds(point.x, point.y, point.x, point.y)
    );
  }

  /** Get all indexed item IDs. */
  all(): string[] {
    return this.tree.all().map(r => r.id);
  }

  /** Check if an item exists in the index. O(1). */
  has(id: string): boolean {
    return this.itemMap.has(id);
  }

  /** Get the bounds of an indexed item. O(1). */
  getBounds(id: string): Bounds | null {
    const item = this.itemMap.get(id);
    if (!item) return null;
    return new Bounds(item.minX, item.minY, item.maxX, item.maxY);
  }

  /** Number of items in the index. */
  get count(): number {
    return this.itemMap.size;
  }

  /** Clear all items from the index. */
  clear(): void {
    this.tree.clear();
    this.itemMap.clear();
  }

  /**
   * Bulk load items using STR (Sort-Tile-Recursive) packing.
   * Produces a near-optimal tree with minimal overlap.
   * O(n log n).
   *
   * Use on document load and paste operations.
   */
  bulkLoad(items: { id: string; bounds: Bounds }[]): void {
    this.clear();

    const rbushItems: RBushItem[] = items.map(item => ({
      minX: item.bounds.minX,
      minY: item.bounds.minY,
      maxX: item.bounds.maxX,
      maxY: item.bounds.maxY,
      id: item.id,
    }));

    for (const item of rbushItems) {
      this.itemMap.set(item.id, item);
    }

    this.tree.load(rbushItems);
  }
}
