import { Bounds, MutableBounds } from '@shared/math/bounds';
import { Vec2 } from '@shared/math/vec2';
import { Matrix2D } from '@shared/math/matrix2d';

/**
 * Computes axis-aligned bounding boxes for scene nodes
 * given their local geometry and world transform.
 */
export class BoundsCalculator {
  private tempBounds = new MutableBounds();

  /**
   * Compute world-space AABB by transforming the four corners
   * of a local-space AABB through the world matrix.
   */
  computeWorldBounds(localBounds: Bounds, worldMatrix: Matrix2D): Bounds {
    const { minX, minY, maxX, maxY } = localBounds;

    const corners = [
      worldMatrix.apply(new Vec2(minX, minY)),
      worldMatrix.apply(new Vec2(maxX, minY)),
      worldMatrix.apply(new Vec2(maxX, maxY)),
      worldMatrix.apply(new Vec2(minX, maxY)),
    ];

    this.tempBounds.reset();
    for (const c of corners) {
      this.tempBounds.addPoint(c.x, c.y);
    }

    return this.tempBounds.toImmutable();
  }

  /**
   * Compute the union bounds of multiple bounds objects.
   */
  computeUnion(boundsArray: Bounds[]): Bounds {
    if (boundsArray.length === 0) return Bounds.EMPTY;

    this.tempBounds.reset();
    for (const b of boundsArray) {
      this.tempBounds.unionMut(b);
    }

    return this.tempBounds.toImmutable();
  }

  /**
   * Compute local bounds for a rectangle shape.
   */
  rectangleBounds(width: number, height: number): Bounds {
    return new Bounds(0, 0, width, height);
  }

  /**
   * Compute local bounds for an ellipse shape.
   */
  ellipseBounds(rx: number, ry: number): Bounds {
    return new Bounds(-rx, -ry, rx, ry);
  }

  /**
   * Compute local bounds from a set of vertices (polygon, star).
   */
  verticesBounds(vertices: Vec2[]): Bounds {
    return Bounds.fromPoints(vertices);
  }

  /**
   * Compute local bounds for a line segment.
   */
  lineBounds(start: Vec2, end: Vec2, strokeWidth: number): Bounds {
    const halfStroke = strokeWidth / 2;
    return new Bounds(
      Math.min(start.x, end.x) - halfStroke,
      Math.min(start.y, end.y) - halfStroke,
      Math.max(start.x, end.x) + halfStroke,
      Math.max(start.y, end.y) + halfStroke
    );
  }
}
