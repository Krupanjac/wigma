import { Vec2 } from './vec2';

/**
 * 3×2 affine transformation matrix.
 *
 * Layout (column-major for consistency with WebGL/PixiJS):
 *   | a  c  tx |
 *   | b  d  ty |
 *   | 0  0  1  |
 *
 * All operations are O(1).
 */
export class Matrix2D {
  constructor(
    public readonly a: number = 1,
    public readonly b: number = 0,
    public readonly c: number = 0,
    public readonly d: number = 1,
    public readonly tx: number = 0,
    public readonly ty: number = 0
  ) {}

  static readonly IDENTITY = new Matrix2D(1, 0, 0, 1, 0, 0);

  static translation(tx: number, ty: number): Matrix2D {
    return new Matrix2D(1, 0, 0, 1, tx, ty);
  }

  static scaling(sx: number, sy: number): Matrix2D {
    return new Matrix2D(sx, 0, 0, sy, 0, 0);
  }

  static rotation(angle: number): Matrix2D {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return new Matrix2D(cos, sin, -sin, cos, 0, 0);
  }

  static fromTRS(tx: number, ty: number, rotation: number, sx: number, sy: number): Matrix2D {
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return new Matrix2D(
      cos * sx,
      sin * sx,
      -sin * sy,
      cos * sy,
      tx,
      ty
    );
  }

  /** this × other (apply other first, then this). */
  multiply(other: Matrix2D): Matrix2D {
    return new Matrix2D(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.tx + this.c * other.ty + this.tx,
      this.b * other.tx + this.d * other.ty + this.ty
    );
  }

  /** Compute the inverse matrix. Returns null if not invertible. */
  invert(): Matrix2D | null {
    const det = this.a * this.d - this.b * this.c;
    if (Math.abs(det) < 1e-12) return null;
    const invDet = 1 / det;
    return new Matrix2D(
      this.d * invDet,
      -this.b * invDet,
      -this.c * invDet,
      this.a * invDet,
      (this.c * this.ty - this.d * this.tx) * invDet,
      (this.b * this.tx - this.a * this.ty) * invDet
    );
  }

  /** Apply this transform to a point. */
  apply(point: Vec2): Vec2 {
    return new Vec2(
      this.a * point.x + this.c * point.y + this.tx,
      this.b * point.x + this.d * point.y + this.ty
    );
  }

  /** Apply inverse transform to a point (world → local). */
  applyInverse(point: Vec2): Vec2 | null {
    const inv = this.invert();
    if (!inv) return null;
    return inv.apply(point);
  }

  /**
   * Decompose matrix into translation, rotation, and scale.
   * Assumes no skew component (typical for design tools).
   */
  decompose(): { translation: Vec2; rotation: number; scale: Vec2 } {
    const sx = Math.sqrt(this.a * this.a + this.b * this.b);
    const sy = Math.sqrt(this.c * this.c + this.d * this.d);

    // Determine sign of scale from determinant
    const det = this.a * this.d - this.b * this.c;
    const signY = det < 0 ? -1 : 1;

    const rotation = Math.atan2(this.b, this.a);

    return {
      translation: new Vec2(this.tx, this.ty),
      rotation,
      scale: new Vec2(sx, signY * sy),
    };
  }

  translate(tx: number, ty: number): Matrix2D {
    return new Matrix2D(
      this.a, this.b,
      this.c, this.d,
      this.tx + tx,
      this.ty + ty
    );
  }

  scale(sx: number, sy: number): Matrix2D {
    return new Matrix2D(
      this.a * sx, this.b * sx,
      this.c * sy, this.d * sy,
      this.tx, this.ty
    );
  }

  rotate(angle: number): Matrix2D {
    return this.multiply(Matrix2D.rotation(angle));
  }

  equals(other: Matrix2D, epsilon: number = 1e-10): boolean {
    return (
      Math.abs(this.a - other.a) < epsilon &&
      Math.abs(this.b - other.b) < epsilon &&
      Math.abs(this.c - other.c) < epsilon &&
      Math.abs(this.d - other.d) < epsilon &&
      Math.abs(this.tx - other.tx) < epsilon &&
      Math.abs(this.ty - other.ty) < epsilon
    );
  }

  toArray(): [number, number, number, number, number, number] {
    return [this.a, this.b, this.c, this.d, this.tx, this.ty];
  }

  clone(): Matrix2D {
    return new Matrix2D(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }

  toString(): string {
    return `Matrix2D(${this.a.toFixed(3)}, ${this.b.toFixed(3)}, ${this.c.toFixed(3)}, ${this.d.toFixed(3)}, ${this.tx.toFixed(1)}, ${this.ty.toFixed(1)})`;
  }
}

/**
 * Mutable variant for hot-path operations.
 */
export class MutableMatrix2D {
  constructor(
    public a: number = 1,
    public b: number = 0,
    public c: number = 0,
    public d: number = 1,
    public tx: number = 0,
    public ty: number = 0
  ) {}

  set(a: number, b: number, c: number, d: number, tx: number, ty: number): this {
    this.a = a; this.b = b;
    this.c = c; this.d = d;
    this.tx = tx; this.ty = ty;
    return this;
  }

  copyFrom(m: Matrix2D | MutableMatrix2D): this {
    this.a = m.a; this.b = m.b;
    this.c = m.c; this.d = m.d;
    this.tx = m.tx; this.ty = m.ty;
    return this;
  }

  identity(): this {
    return this.set(1, 0, 0, 1, 0, 0);
  }

  multiplyMut(other: Matrix2D | MutableMatrix2D): this {
    const a = this.a * other.a + this.c * other.b;
    const b = this.b * other.a + this.d * other.b;
    const c = this.a * other.c + this.c * other.d;
    const d = this.b * other.c + this.d * other.d;
    const tx = this.a * other.tx + this.c * other.ty + this.tx;
    const ty = this.b * other.tx + this.d * other.ty + this.ty;
    this.a = a; this.b = b;
    this.c = c; this.d = d;
    this.tx = tx; this.ty = ty;
    return this;
  }

  invertMut(): boolean {
    const det = this.a * this.d - this.b * this.c;
    if (Math.abs(det) < 1e-12) return false;
    const invDet = 1 / det;
    const a = this.d * invDet;
    const b = -this.b * invDet;
    const c = -this.c * invDet;
    const d = this.a * invDet;
    const tx = (this.c * this.ty - this.d * this.tx) * invDet;
    const ty = (this.b * this.tx - this.a * this.ty) * invDet;
    this.a = a; this.b = b;
    this.c = c; this.d = d;
    this.tx = tx; this.ty = ty;
    return true;
  }

  applyToPoint(x: number, y: number, out: { x: number; y: number }): void {
    out.x = this.a * x + this.c * y + this.tx;
    out.y = this.b * x + this.d * y + this.ty;
  }

  toImmutable(): Matrix2D {
    return new Matrix2D(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }
}
