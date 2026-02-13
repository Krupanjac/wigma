import { BaseNode } from '../scene-graph/base-node';
import { Bounds } from '@shared/math/bounds';

type EdgeRef = { id: string; value: number };

/**
 * AlignmentIndex — hashmap-based lookup for alignment candidates.
 *
 * Stores node edge coordinates (min/center/max) for x and y in bucketed maps.
 * Bucketing is done by rounding world-space coordinates to integer keys.
 *
 * Query cost is O(k) where k is bucket range (typically a few units for snap threshold).
 */
export class AlignmentIndex {
  /** World-space bucket size used for hashmap indexing (smaller = more keys, more precise). */
  private bucketSize = 1;

  private xMap = new Map<number, EdgeRef[]>();
  private yMap = new Map<number, EdgeRef[]>();

  private nodeEdges = new Map<string, { x: EdgeRef[]; y: EdgeRef[] }>();

  clear(): void {
    this.xMap.clear();
    this.yMap.clear();
    this.nodeEdges.clear();
  }

  upsertNode(node: BaseNode, bounds: Bounds = node.worldBounds): void {
    // Exclude invisible/locked nodes from snapping targets
    if (!node.visible || node.locked) {
      this.removeNode(node.id);
      return;
    }

    this.removeNode(node.id);

    const minX = bounds.minX;
    const maxX = bounds.maxX;
    const minY = bounds.minY;
    const maxY = bounds.maxY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    const xEdges: EdgeRef[] = [
      { id: node.id, value: minX },
      { id: node.id, value: cx },
      { id: node.id, value: maxX },
    ];

    const yEdges: EdgeRef[] = [
      { id: node.id, value: minY },
      { id: node.id, value: cy },
      { id: node.id, value: maxY },
    ];

    for (const e of xEdges) this.insertEdge(this.xMap, e);
    for (const e of yEdges) this.insertEdge(this.yMap, e);

    this.nodeEdges.set(node.id, { x: xEdges, y: yEdges });
  }

  removeNode(id: string): void {
    const edges = this.nodeEdges.get(id);
    if (!edges) return;

    for (const e of edges.x) this.removeEdge(this.xMap, e);
    for (const e of edges.y) this.removeEdge(this.yMap, e);

    this.nodeEdges.delete(id);
  }

  /** Find nearest X guide to align to within tolerance (world-space units). */
  nearestX(targetX: number, tolerance: number, excludeIds: Set<string> = new Set()): EdgeRef | null {
    return this.nearestInMap(this.xMap, targetX, tolerance, excludeIds);
  }

  /** Find nearest Y guide to align to within tolerance (world-space units). */
  nearestY(targetY: number, tolerance: number, excludeIds: Set<string> = new Set()): EdgeRef | null {
    return this.nearestInMap(this.yMap, targetY, tolerance, excludeIds);
  }

  private insertEdge(map: Map<number, EdgeRef[]>, edge: EdgeRef): void {
    const key = Math.floor(edge.value / this.bucketSize);
    const arr = map.get(key);
    if (arr) {
      arr.push(edge);
    } else {
      map.set(key, [edge]);
    }
  }

  private removeEdge(map: Map<number, EdgeRef[]>, edge: EdgeRef): void {
    const key = Math.floor(edge.value / this.bucketSize);
    const arr = map.get(key);
    if (!arr) return;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === edge.id && arr[i].value === edge.value) {
        arr.splice(i, 1);
        break;
      }
    }
    if (arr.length === 0) map.delete(key);
  }

  private nearestInMap(
    map: Map<number, EdgeRef[]>,
    target: number,
    tolerance: number,
    excludeIds: Set<string>
  ): EdgeRef | null {
    const minKey = Math.floor((target - tolerance) / this.bucketSize);
    const maxKey = Math.floor((target + tolerance) / this.bucketSize);

    let best: EdgeRef | null = null;
    let bestDist = Infinity;

    for (let key = minKey; key <= maxKey; key++) {
      const bucket = map.get(key);
      if (!bucket) continue;

      for (const edge of bucket) {
        if (excludeIds.has(edge.id)) continue;
        const dist = Math.abs(edge.value - target);
        if (dist <= tolerance && dist < bestDist) {
          bestDist = dist;
          best = edge;
        }
      }
    }

    return best;
  }
}
