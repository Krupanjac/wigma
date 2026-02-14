/**
 * 3×2 affine transformation matrix — WASM-accelerated.
 *
 * Drop-in replacement for the original TypeScript Matrix2D.
 * Layout (column-major):
 *   | a  c  tx |
 *   | b  d  ty |
 *   | 0  0  1  |
 */
import { Vec2 } from './vec2';
import { getWasm } from './wasm-math';

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
    const w = getWasm();
    w.mat2d_rotation(angle);
    return new Matrix2D(
      w.resultBuf[0], w.resultBuf[1],
      w.resultBuf[2], w.resultBuf[3],
      w.resultBuf[4], w.resultBuf[5]
    );
  }

  static fromTRS(tx: number, ty: number, rotation: number, sx: number, sy: number): Matrix2D {
    const w = getWasm();
    w.mat2d_from_trs(tx, ty, rotation, sx, sy);
    return new Matrix2D(
      w.resultBuf[0], w.resultBuf[1],
      w.resultBuf[2], w.resultBuf[3],
      w.resultBuf[4], w.resultBuf[5]
    );
  }

  multiply(other: Matrix2D): Matrix2D {
    const w = getWasm();
    w.mat2d_multiply(
      this.a, this.b, this.c, this.d, this.tx, this.ty,
      other.a, other.b, other.c, other.d, other.tx, other.ty
    );
    return new Matrix2D(
      w.resultBuf[0], w.resultBuf[1],
      w.resultBuf[2], w.resultBuf[3],
      w.resultBuf[4], w.resultBuf[5]
    );
  }

  invert(): Matrix2D | null {
    const w = getWasm();
    const ok = w.mat2d_invert(this.a, this.b, this.c, this.d, this.tx, this.ty);
    if (!ok) return null;
    return new Matrix2D(
      w.resultBuf[0], w.resultBuf[1],
      w.resultBuf[2], w.resultBuf[3],
      w.resultBuf[4], w.resultBuf[5]
    );
  }

  apply(point: Vec2): Vec2 {
    const w = getWasm();
    w.mat2d_apply(this.a, this.b, this.c, this.d, this.tx, this.ty, point.x, point.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  applyInverse(point: Vec2): Vec2 | null {
    const inv = this.invert();
    if (!inv) return null;
    return inv.apply(point);
  }

  decompose(): { translation: Vec2; rotation: number; scale: Vec2 } {
    const w = getWasm();
    w.mat2d_decompose(this.a, this.b, this.c, this.d, this.tx, this.ty);
    return {
      translation: new Vec2(w.resultBuf[0], w.resultBuf[1]),
      rotation: w.resultBuf[2],
      scale: new Vec2(w.resultBuf[3], w.resultBuf[4]),
    };
  }

  translate(tx: number, ty: number): Matrix2D {
    const w = getWasm();
    w.mat2d_translate(this.a, this.b, this.c, this.d, this.tx, this.ty, tx, ty);
    return new Matrix2D(
      w.resultBuf[0], w.resultBuf[1],
      w.resultBuf[2], w.resultBuf[3],
      w.resultBuf[4], w.resultBuf[5]
    );
  }

  scale(sx: number, sy: number): Matrix2D {
    const w = getWasm();
    w.mat2d_scale(this.a, this.b, this.c, this.d, this.tx, this.ty, sx, sy);
    return new Matrix2D(
      w.resultBuf[0], w.resultBuf[1],
      w.resultBuf[2], w.resultBuf[3],
      w.resultBuf[4], w.resultBuf[5]
    );
  }

  rotate(angle: number): Matrix2D {
    return this.multiply(Matrix2D.rotation(angle));
  }

  equals(other: Matrix2D, epsilon: number = 1e-10): boolean {
    return getWasm().mat2d_equals(
      this.a, this.b, this.c, this.d, this.tx, this.ty,
      other.a, other.b, other.c, other.d, other.tx, other.ty,
      epsilon
    ) === 1;
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
 * Mutable variant for hot-path operations — WASM-accelerated.
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
    const w = getWasm();
    w.mat2d_multiply(
      this.a, this.b, this.c, this.d, this.tx, this.ty,
      other.a, other.b, other.c, other.d, other.tx, other.ty
    );
    this.a = w.resultBuf[0]; this.b = w.resultBuf[1];
    this.c = w.resultBuf[2]; this.d = w.resultBuf[3];
    this.tx = w.resultBuf[4]; this.ty = w.resultBuf[5];
    return this;
  }

  invertMut(): boolean {
    const w = getWasm();
    const ok = w.mat2d_invert(this.a, this.b, this.c, this.d, this.tx, this.ty);
    if (!ok) return false;
    this.a = w.resultBuf[0]; this.b = w.resultBuf[1];
    this.c = w.resultBuf[2]; this.d = w.resultBuf[3];
    this.tx = w.resultBuf[4]; this.ty = w.resultBuf[5];
    return true;
  }

  applyToPoint(x: number, y: number, out: { x: number; y: number }): void {
    const w = getWasm();
    w.mat2d_apply(this.a, this.b, this.c, this.d, this.tx, this.ty, x, y);
    out.x = w.resultBuf[0];
    out.y = w.resultBuf[1];
  }

  toImmutable(): Matrix2D {
    return new Matrix2D(this.a, this.b, this.c, this.d, this.tx, this.ty);
  }
}
