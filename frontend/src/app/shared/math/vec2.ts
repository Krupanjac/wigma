/**
 * Immutable 2D Vector class — WASM-accelerated.
 *
 * Drop-in replacement for the original TypeScript Vec2.
 * All heavy math operations delegate to the C/WASM module.
 */
import { getWasm } from './wasm-math';

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

  // ── Immutable operations (WASM-backed) ─────────────────────

  add(other: Vec2): Vec2 {
    const w = getWasm();
    w.vec2_add(this.x, this.y, other.x, other.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  sub(other: Vec2): Vec2 {
    const w = getWasm();
    w.vec2_sub(this.x, this.y, other.x, other.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  scale(scalar: number): Vec2 {
    const w = getWasm();
    w.vec2_scale(this.x, this.y, scalar);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  scaleXY(sx: number, sy: number): Vec2 {
    const w = getWasm();
    w.vec2_scale_xy(this.x, this.y, sx, sy);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  negate(): Vec2 {
    const w = getWasm();
    w.vec2_negate(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  dot(other: Vec2): number {
    return getWasm().vec2_dot(this.x, this.y, other.x, other.y);
  }

  cross(other: Vec2): number {
    return getWasm().vec2_cross(this.x, this.y, other.x, other.y);
  }

  length(): number {
    return getWasm().vec2_length(this.x, this.y);
  }

  lengthSquared(): number {
    return getWasm().vec2_length_squared(this.x, this.y);
  }

  normalize(): Vec2 {
    const w = getWasm();
    w.vec2_normalize(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  distanceTo(other: Vec2): number {
    return getWasm().vec2_distance(this.x, this.y, other.x, other.y);
  }

  distanceToSquared(other: Vec2): number {
    return getWasm().vec2_distance_squared(this.x, this.y, other.x, other.y);
  }

  lerp(other: Vec2, t: number): Vec2 {
    const w = getWasm();
    w.vec2_lerp(this.x, this.y, other.x, other.y, t);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  angle(): number {
    return getWasm().vec2_angle(this.x, this.y);
  }

  angleTo(other: Vec2): number {
    return getWasm().vec2_angle_to(this.x, this.y, other.x, other.y);
  }

  rotate(angle: number): Vec2 {
    const w = getWasm();
    w.vec2_rotate(this.x, this.y, angle);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  rotateAround(pivot: Vec2, angle: number): Vec2 {
    const w = getWasm();
    w.vec2_rotate_around(this.x, this.y, pivot.x, pivot.y, angle);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  perpendicular(): Vec2 {
    const w = getWasm();
    w.vec2_perpendicular(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  reflect(normal: Vec2): Vec2 {
    const w = getWasm();
    w.vec2_reflect(this.x, this.y, normal.x, normal.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  clamp(min: Vec2, max: Vec2): Vec2 {
    const w = getWasm();
    w.vec2_clamp(this.x, this.y, min.x, min.y, max.x, max.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  abs(): Vec2 {
    const w = getWasm();
    w.vec2_abs(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  floor(): Vec2 {
    const w = getWasm();
    w.vec2_floor(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  ceil(): Vec2 {
    const w = getWasm();
    w.vec2_ceil(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  round(): Vec2 {
    const w = getWasm();
    w.vec2_round(this.x, this.y);
    return new Vec2(w.resultBuf[0], w.resultBuf[1]);
  }

  equals(other: Vec2, epsilon: number = 1e-10): boolean {
    return getWasm().vec2_equals(this.x, this.y, other.x, other.y, epsilon) === 1;
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

  static mutable(x: number = 0, y: number = 0): MutableVec2 {
    return new MutableVec2(x, y);
  }
}

/**
 * Mutable variant of Vec2 for hot-path operations — WASM-accelerated.
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
    const w = getWasm();
    w.vec2_add(this.x, this.y, other.x, other.y);
    this.x = w.resultBuf[0];
    this.y = w.resultBuf[1];
    return this;
  }

  subMut(other: Vec2 | MutableVec2): this {
    const w = getWasm();
    w.vec2_sub(this.x, this.y, other.x, other.y);
    this.x = w.resultBuf[0];
    this.y = w.resultBuf[1];
    return this;
  }

  scaleMut(scalar: number): this {
    const w = getWasm();
    w.vec2_scale(this.x, this.y, scalar);
    this.x = w.resultBuf[0];
    this.y = w.resultBuf[1];
    return this;
  }

  normalizeMut(): this {
    const w = getWasm();
    w.vec2_normalize_mut(this.x, this.y);
    this.x = w.resultBuf[0];
    this.y = w.resultBuf[1];
    return this;
  }

  toImmutable(): Vec2 {
    return new Vec2(this.x, this.y);
  }
}
