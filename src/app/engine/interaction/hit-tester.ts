import { Vec2 } from '@shared/math/vec2';
import { BaseNode } from '../scene-graph/base-node';
import { SceneGraphManager } from '../scene-graph/scene-graph-manager';
import { SpatialIndex } from '../spatial/spatial-index';
import { EllipseNode } from '../scene-graph/ellipse-node';
import { PolygonNode } from '../scene-graph/polygon-node';
import { StarNode } from '../scene-graph/star-node';
import { PathNode } from '../scene-graph/path-node';
import { GroupNode } from '../scene-graph/group-node';
import { pointInPolygon, pointInEllipse } from '@shared/utils/geometry-utils';
import { nearestPointOnCubic } from '@shared/math/bezier';
import { HIT_TOLERANCE, PATH_HIT_EXPAND } from '@shared/constants';

/**
 * HitTester — two-phase hit-testing using R-tree.
 *
 * Broad phase: spatialIndex.queryPoint(worldPos) → candidate IDs. O(log_M n + k).
 * Narrow phase: Per-candidate precise containment test.
 *
 * Z-order resolve: topmost (highest render order) wins. O(k).
 */
export class HitTester {
  constructor(
    private sceneGraph: SceneGraphManager,
    private spatialIndex: SpatialIndex
  ) {}

  /**
   * Hit-test at a world-space point.
   * Returns the topmost node at that point, or null.
   */
  hitTest(worldPos: Vec2, tolerance: number = HIT_TOLERANCE): BaseNode | null {
    // Broad phase: R-tree query
    const candidateIds = this.spatialIndex.queryPoint(worldPos);

    if (candidateIds.length === 0) return null;

    // Narrow phase + z-order
    let bestNode: BaseNode | null = null;
    let bestOrder = -Infinity;

    for (const id of candidateIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node || !node.visible || node.locked) continue;
      if (node === this.sceneGraph.root) continue;

      if (this.narrowPhaseTest(node, worldPos, tolerance)) {
        const order = this.computeGlobalRenderOrder(node);
        if (order > bestOrder) {
          bestOrder = order;
          bestNode = node;
        }
      }
    }

    return bestNode;
  }

  /**
   * Hit-test returning all nodes at the point (not just topmost).
   */
  hitTestAll(worldPos: Vec2, tolerance: number = HIT_TOLERANCE): BaseNode[] {
    const candidateIds = this.spatialIndex.queryPoint(worldPos);
    const results: BaseNode[] = [];

    for (const id of candidateIds) {
      const node = this.sceneGraph.getNode(id);
      if (!node || !node.visible) continue;
      if (node === this.sceneGraph.root) continue;

      if (this.narrowPhaseTest(node, worldPos, tolerance)) {
        results.push(node);
      }
    }

    // Sort by render order (topmost last)
    return results.sort(
      (a, b) => this.computeGlobalRenderOrder(a) - this.computeGlobalRenderOrder(b)
    );
  }

  /**
   * Narrow phase precise containment test per node type.
   */
  private narrowPhaseTest(node: BaseNode, worldPos: Vec2, tolerance: number): boolean {
    // Transform world point to node's local space
    const inv = node.worldMatrix.invert();
    if (!inv) return false;
    const localPos = inv.apply(worldPos);

    switch (node.type) {
      case 'rectangle':
        return this.testRectangle(localPos, node, tolerance);

      case 'ellipse':
        return this.testEllipse(localPos, node as EllipseNode, tolerance);

      case 'polygon':
        return this.testPolygon(localPos, node as PolygonNode);

      case 'star':
        return this.testStar(localPos, node as StarNode);

      case 'path':
        return this.testPath(localPos, node as PathNode, tolerance);

      case 'group':
        return this.testGroup(node as GroupNode, worldPos, tolerance);

      case 'text':
      case 'image':
      case 'line':
      case 'arrow':
      default:
        // AABB test (already passed broad phase, but check local bounds)
        return this.testAABB(localPos, node, tolerance);
    }
  }

  /** Rectangle: inverse-transform point to local, AABB test. O(1). */
  private testRectangle(localPos: Vec2, node: BaseNode, tolerance: number): boolean {
    return (
      localPos.x >= -tolerance &&
      localPos.y >= -tolerance &&
      localPos.x <= node.width + tolerance &&
      localPos.y <= node.height + tolerance
    );
  }

  /** Ellipse: (x/rx)² + (y/ry)² ≤ 1 in local space. O(1). */
  private testEllipse(localPos: Vec2, node: EllipseNode, _tolerance: number): boolean {
    const cx = node.width / 2;
    const cy = node.height / 2;
    return pointInEllipse(localPos.x - cx, localPos.y - cy, node.rx, node.ry);
  }

  /** Polygon: ray-casting (count edge intersections). O(v). */
  private testPolygon(localPos: Vec2, node: PolygonNode): boolean {
    return pointInPolygon(localPos, node.vertices);
  }

  /** Star: same ray-casting algorithm. O(v). */
  private testStar(localPos: Vec2, node: StarNode): boolean {
    return pointInPolygon(localPos, node.vertices);
  }

  /**
   * Path (Bézier): minimum distance to each cubic segment via Newton-Raphson.
   * Hit if distance < strokeWidth/2 + tolerance.
   * O(s·i), s = segments, i ≈ 5 iterations.
   */
  private testPath(localPos: Vec2, node: PathNode, tolerance: number): boolean {
    const segments = node.getSegments();
    const hitDistance = (node.stroke.width / 2) + tolerance + PATH_HIT_EXPAND;

    for (const seg of segments) {
      const result = nearestPointOnCubic(seg, localPos);
      if (result.distance <= hitDistance) {
        return true;
      }
    }

    return false;
  }

  /** Group: recurse children, deepest hit wins. O(c). */
  private testGroup(node: GroupNode, worldPos: Vec2, tolerance: number): boolean {
    for (const child of node.children) {
      const inv = child.worldMatrix.invert();
      if (!inv) continue;
      const localPos = inv.apply(worldPos);

      if (this.narrowPhaseTest(child, worldPos, tolerance)) {
        return true;
      }
      void localPos;
    }
    return false;
  }

  /** Generic AABB test. O(1). */
  private testAABB(localPos: Vec2, node: BaseNode, tolerance: number): boolean {
    const bounds = node.computeLocalBounds();
    return (
      localPos.x >= bounds.minX - tolerance &&
      localPos.y >= bounds.minY - tolerance &&
      localPos.x <= bounds.maxX + tolerance &&
      localPos.y <= bounds.maxY + tolerance
    );
  }

  /** Compute a global render order for z-sorting. */
  private computeGlobalRenderOrder(node: BaseNode): number {
    const indices: number[] = [];
    let current: BaseNode | null = node;
    while (current && current.parent) {
      indices.unshift(current.renderOrder);
      current = current.parent;
    }
    // Simple weighted sum for ordering
    let order = 0;
    for (let i = 0; i < indices.length; i++) {
      order = order * 10000 + indices[i];
    }
    return order;
  }
}
