/**
 * Immutable 2D Vector class.
 * All operations return new Vec2 instances by default.
 * Use *Mut() variants for hot-path mutable operations.
 */
export class Vec2 {
  constructor(
    public readonly x: number = 0,
    public readonly y: number = 0
  ) {}

  static readonly ZERO = new Vec2(0, 0);
  static readonly ONE = new Vec2(1, 1);
  static readonly UP = new Vec2(0, -1);
  static readonly DOWN = new Vec2(0, 1);
  static readonly LEFT = new Vec2(-1, 0);
  static readonly RIGHT = new Vec2(1, 0);

  static from(x: number, y: number): Vec2 {
    return new Vec2(x, y);
  }

  static fromArray(arr: [number, number]): Vec2 {
    return new Vec2(arr[0], arr[1]);
  }

  // ── Immutable operations ───────────────────────────────────

  add(other: Vec2): Vec2 {
    return new Vec2(this.x + other.x, this.y + other.y);
  }

  sub(other: Vec2): Vec2 {
    return new Vec2(this.x - other.x, this.y - other.y);
  }

  scale(scalar: number): Vec2 {
    return new Vec2(this.x * scalar, this.y * scalar);
  }

  scaleXY(sx: number, sy: number): Vec2 {
    return new Vec2(this.x * sx, this.y * sy);
  }

  negate(): Vec2 {
    return new Vec2(-this.x, -this.y);
  }

  dot(other: Vec2): number {
    return this.x * other.x + this.y * other.y;
  }

  /** 2D cross product (returns scalar z-component). */
  cross(other: Vec2): number {
    return this.x * other.y - this.y * other.x;
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  lengthSquared(): number {
    return this.x * this.x + this.y * this.y;
  }

  normalize(): Vec2 {
    const len = this.length();
    if (len < 1e-10) return Vec2.ZERO;
    return new Vec2(this.x / len, this.y / len);
  }

  distanceTo(other: Vec2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  distanceToSquared(other: Vec2): number {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return dx * dx + dy * dy;
  }

  lerp(other: Vec2, t: number): Vec2 {
    return new Vec2(
      this.x + (other.x - this.x) * t,
      this.y + (other.y - this.y) * t
    );
  }

  /** Angle in radians from positive x-axis. */
  angle(): number {
    return Math.atan2(this.y, this.x);
  }

  /** Angle in radians from this vector to another. */
  angleTo(other: Vec2): number {
    return Math.atan2(other.y - this.y, other.x - this.x);
  }

  /** Rotate around origin by angle in radians. */
  rotate(angle: number): Vec2 {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vec2(
      this.x * cos - this.y * sin,
      this.x * sin + this.y * cos
    );
  }

  /** Rotate around a pivot point by angle in radians. */
  rotateAround(pivot: Vec2, angle: number): Vec2 {
    const dx = this.x - pivot.x;
    const dy = this.y - pivot.y;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Vec2(
      pivot.x + dx * cos - dy * sin,
      pivot.y + dx * sin + dy * cos
    );
  }

  perpendicular(): Vec2 {
    return new Vec2(-this.y, this.x);
  }

  reflect(normal: Vec2): Vec2 {
    const d = 2 * this.dot(normal);
    return new Vec2(this.x - d * normal.x, this.y - d * normal.y);
  }

  clamp(min: Vec2, max: Vec2): Vec2 {
    return new Vec2(
      Math.max(min.x, Math.min(max.x, this.x)),
      Math.max(min.y, Math.min(max.y, this.y))
    );
  }

  abs(): Vec2 {
    return new Vec2(Math.abs(this.x), Math.abs(this.y));
  }

  floor(): Vec2 {
    return new Vec2(Math.floor(this.x), Math.floor(this.y));
  }

  ceil(): Vec2 {
    return new Vec2(Math.ceil(this.x), Math.ceil(this.y));
  }

  round(): Vec2 {
    return new Vec2(Math.round(this.x), Math.round(this.y));
  }

  equals(other: Vec2, epsilon: number = 1e-10): boolean {
    return Math.abs(this.x - other.x) < epsilon && Math.abs(this.y - other.y) < epsilon;
  }

  toArray(): [number, number] {
    return [this.x, this.y];
  }

  clone(): Vec2 {
    return new Vec2(this.x, this.y);
  }

  toString(): string {
    return `Vec2(${this.x.toFixed(2)}, ${this.y.toFixed(2)})`;
  }

  // ── Mutable operations (for hot paths) ─────────────────────

  /** Mutable vector for performance-critical loops. */
  static mutable(x: number = 0, y: number = 0): MutableVec2 {
    return new MutableVec2(x, y);
  }
}

/**
 * Mutable variant of Vec2 for hot-path operations.
 * Avoids GC pressure in tight loops (rendering, spatial queries).
 */
export class MutableVec2 {
  constructor(
    public x: number = 0,
    public y: number = 0
  ) {}

  set(x: number, y: number): this {
    this.x = x;
    this.y = y;
    return this;
  }

  copyFrom(v: Vec2 | MutableVec2): this {
    this.x = v.x;
    this.y = v.y;
    return this;
  }

  addMut(other: Vec2 | MutableVec2): this {
    this.x += other.x;
    this.y += other.y;
    return this;
  }

  subMut(other: Vec2 | MutableVec2): this {
    this.x -= other.x;
    this.y -= other.y;
    return this;
  }

  scaleMut(scalar: number): this {
    this.x *= scalar;
    this.y *= scalar;
    return this;
  }

  normalizeMut(): this {
    const len = Math.sqrt(this.x * this.x + this.y * this.y);
    if (len < 1e-10) {
      this.x = 0;
      this.y = 0;
    } else {
      this.x /= len;
      this.y /= len;
    }
    return this;
  }

  toImmutable(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}
