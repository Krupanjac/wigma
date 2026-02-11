import { BaseNode } from './base-node';
import { Bounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';
import { CubicBezierSegment, cubicBezierBounds } from '@shared/math/bezier';

/**
 * Anchor point type for Bézier path construction.
 * - 'sharp': No handles (corner point)
 * - 'smooth': Handles are mirror-symmetric
 * - 'asymmetric': Independent handle lengths, shared angle
 * - 'disconnected': Fully independent handles
 */
export type AnchorType = 'sharp' | 'smooth' | 'asymmetric' | 'disconnected';

/**
 * A single anchor point in a Bézier path.
 */
export interface PathAnchor {
  position: Vec2;
  handleIn: Vec2;   // Relative to position
  handleOut: Vec2;  // Relative to position
  type: AnchorType;
}

/**
 * Path node — Bézier curve composed of cubic segments.
 *
 * Hit-testing: minimum distance to each cubic segment via Newton-Raphson.
 * Hit if distance < strokeWidth/2 + tolerance. O(s·i), s = segments, i ≈ 5 iterations.
 */
export class PathNode extends BaseNode {
  anchors: PathAnchor[] = [];
  closed: boolean = false;

  constructor(name?: string) {
    super('path', name ?? 'Path');
    this.fill.visible = false;
    this.stroke.visible = true;
    this.stroke.width = 2;
  }

  /** Get cubic Bézier segments from anchor chain. */
  getSegments(): CubicBezierSegment[] {
    const segments: CubicBezierSegment[] = [];
    const n = this.anchors.length;
    if (n < 2) return segments;

    const limit = this.closed ? n : n - 1;
    for (let i = 0; i < limit; i++) {
      const a0 = this.anchors[i];
      const a1 = this.anchors[(i + 1) % n];

      segments.push({
        p0: a0.position,
        p1: a0.position.add(a0.handleOut),
        p2: a1.position.add(a1.handleIn),
        p3: a1.position,
      });
    }

    return segments;
  }

  computeLocalBounds(): Bounds {
    const segments = this.getSegments();
    if (segments.length === 0) {
      return new Bounds(0, 0, this.width, this.height);
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const seg of segments) {
      const b = cubicBezierBounds(seg);
      minX = Math.min(minX, b.minX);
      minY = Math.min(minY, b.minY);
      maxX = Math.max(maxX, b.maxX);
      maxY = Math.max(maxY, b.maxY);
    }

    const expand = this.stroke.width / 2;
    return new Bounds(minX - expand, minY - expand, maxX + expand, maxY + expand);
  }

  /** Add an anchor point. */
  addAnchor(anchor: PathAnchor): void {
    this.anchors.push(anchor);
    this.markRenderDirty();
    this.markBoundsDirty();
  }

  /** Remove an anchor point by index. */
  removeAnchor(index: number): void {
    this.anchors.splice(index, 1);
    this.markRenderDirty();
    this.markBoundsDirty();
  }

  override toJSON(): Record<string, unknown> {
    return {
      ...super.toJSON(),
      anchors: this.anchors.map(a => ({
        position: a.position.toArray(),
        handleIn: a.handleIn.toArray(),
        handleOut: a.handleOut.toArray(),
        type: a.type,
      })),
      closed: this.closed,
    };
  }

  clone(): PathNode {
    const node = new PathNode(this.name);
    this.copyBaseTo(node);
    node.closed = this.closed;
    node.anchors = this.anchors.map(a => ({
      position: a.position.clone(),
      handleIn: a.handleIn.clone(),
      handleOut: a.handleOut.clone(),
      type: a.type,
    }));
    return node;
  }
}
