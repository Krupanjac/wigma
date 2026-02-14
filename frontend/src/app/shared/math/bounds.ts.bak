import { Vec2 } from './vec2';

/**
 * Axis-Aligned Bounding Box (AABB).
 * All operations are O(1).
 */
export class Bounds {
  constructor(
    public readonly minX: number,
    public readonly minY: number,
    public readonly maxX: number,
    public readonly maxY: number
  ) {}

  static readonly EMPTY = new Bounds(Infinity, Infinity, -Infinity, -Infinity);

  static fromXYWH(x: number, y: number, width: number, height: number): Bounds {
    return new Bounds(x, y, x + width, y + height);
  }

  static fromCenter(cx: number, cy: number, width: number, height: number): Bounds {
    const hw = width / 2;
    const hh = height / 2;
    return new Bounds(cx - hw, cy - hh, cx + hw, cy + hh);
  }

  static fromPoints(points: Vec2[]): Bounds {
    if (points.length === 0) return Bounds.EMPTY;
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return new Bounds(minX, minY, maxX, maxY);
  }

  get x(): number { return this.minX; }
  get y(): number { return this.minY; }
  get width(): number { return this.maxX - this.minX; }
  get height(): number { return this.maxY - this.minY; }
  get centerX(): number { return (this.minX + this.maxX) / 2; }
  get centerY(): number { return (this.minY + this.maxY) / 2; }
  get center(): Vec2 { return new Vec2(this.centerX, this.centerY); }
  get area(): number { return this.width * this.height; }

  get isEmpty(): boolean {
    return this.minX > this.maxX || this.minY > this.maxY;
  }

  /** Test if this AABB intersects another AABB. */
  intersects(other: Bounds): boolean {
    return (
      this.minX <= other.maxX &&
      this.maxX >= other.minX &&
      this.minY <= other.maxY &&
      this.maxY >= other.minY
    );
  }

  /** Test if a point is inside this AABB. */
  contains(point: Vec2): boolean {
    return (
      point.x >= this.minX &&
      point.x <= this.maxX &&
      point.y >= this.minY &&
      point.y <= this.maxY
    );
  }

  /** Test if another AABB is fully contained within this AABB. */
  containsBounds(other: Bounds): boolean {
    return (
      other.minX >= this.minX &&
      other.maxX <= this.maxX &&
      other.minY >= this.minY &&
      other.maxY <= this.maxY
    );
  }

  /** Return the smallest AABB enclosing both this and other. */
  union(other: Bounds): Bounds {
    return new Bounds(
      Math.min(this.minX, other.minX),
      Math.min(this.minY, other.minY),
      Math.max(this.maxX, other.maxX),
      Math.max(this.maxY, other.maxY)
    );
  }

  /** Return the intersection AABB, or EMPTY if no overlap. */
  intersection(other: Bounds): Bounds {
    const minX = Math.max(this.minX, other.minX);
    const minY = Math.max(this.minY, other.minY);
    const maxX = Math.min(this.maxX, other.maxX);
    const maxY = Math.min(this.maxY, other.maxY);
    if (minX > maxX || minY > maxY) return Bounds.EMPTY;
    return new Bounds(minX, minY, maxX, maxY);
  }

  /** Expand by a uniform margin on all sides. */
  expand(margin: number): Bounds {
    return new Bounds(
      this.minX - margin,
      this.minY - margin,
      this.maxX + margin,
      this.maxY + margin
    );
  }

  /** Expand by different margins per axis. */
  expandXY(mx: number, my: number): Bounds {
    return new Bounds(
      this.minX - mx,
      this.minY - my,
      this.maxX + mx,
      this.maxY + my
    );
  }

  /** Translate bounds by an offset. */
  translate(dx: number, dy: number): Bounds {
    return new Bounds(
      this.minX + dx,
      this.minY + dy,
      this.maxX + dx,
      this.maxY + dy
    );
  }

  equals(other: Bounds, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.minX - other.minX) < epsilon &&
      Math.abs(this.minY - other.minY) < epsilon &&
      Math.abs(this.maxX - other.maxX) < epsilon &&
      Math.abs(this.maxY - other.maxY) < epsilon
    );
  }

  clone(): Bounds {
    return new Bounds(this.minX, this.minY, this.maxX, this.maxY);
  }

  toString(): string {
    return `Bounds(${this.minX.toFixed(1)}, ${this.minY.toFixed(1)}, ${this.maxX.toFixed(1)}, ${this.maxY.toFixed(1)})`;
  }
}

/**
 * Mutable AABB for hot-path operations.
 */
export class MutableBounds {
  constructor(
    public minX: number = Infinity,
    public minY: number = Infinity,
    public maxX: number = -Infinity,
    public maxY: number = -Infinity
  ) {}

  reset(): this {
    this.minX = Infinity;
    this.minY = Infinity;
    this.maxX = -Infinity;
    this.maxY = -Infinity;
    return this;
  }

  set(minX: number, minY: number, maxX: number, maxY: number): this {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX;
    this.maxY = maxY;
    return this;
  }

  copyFrom(b: Bounds | MutableBounds): this {
    this.minX = b.minX;
    this.minY = b.minY;
    this.maxX = b.maxX;
    this.maxY = b.maxY;
    return this;
  }

  addPoint(x: number, y: number): this {
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
    return this;
  }

  unionMut(other: Bounds | MutableBounds): this {
    this.minX = Math.min(this.minX, other.minX);
    this.minY = Math.min(this.minY, other.minY);
    this.maxX = Math.max(this.maxX, other.maxX);
    this.maxY = Math.max(this.maxY, other.maxY);
    return this;
  }

  toImmutable(): Bounds {
    return new Bounds(this.minX, this.minY, this.maxX, this.maxY);
  }
}
