/**
 * WASM Math Module Loader
 *
 * Initializes the Emscripten-compiled WASM module and exposes
 * a typed API for all math operations. The module is loaded once
 * and shared across all math classes.
 */

// @ts-ignore — Emscripten-generated ES module, no TS declarations
import MathWasmModuleFactory from './math_wasm.mjs';

export interface WasmMathInstance {
  /** Float64Array view over the WASM result buffer (16 doubles) */
  resultBuf: Float64Array;

  /** Float64Array view over adaptive subdivision output buffer */
  adaptiveBuf: Float64Array;

  /** Float64Array view over input points buffer */
  inputPointsBuf: Float64Array;

  // ── Vec2 ─────────────────────────────────────────────────
  vec2_add(x1: number, y1: number, x2: number, y2: number): void;
  vec2_sub(x1: number, y1: number, x2: number, y2: number): void;
  vec2_scale(x: number, y: number, s: number): void;
  vec2_scale_xy(x: number, y: number, sx: number, sy: number): void;
  vec2_negate(x: number, y: number): void;
  vec2_dot(x1: number, y1: number, x2: number, y2: number): number;
  vec2_cross(x1: number, y1: number, x2: number, y2: number): number;
  vec2_length(x: number, y: number): number;
  vec2_length_squared(x: number, y: number): number;
  vec2_normalize(x: number, y: number): void;
  vec2_distance(x1: number, y1: number, x2: number, y2: number): number;
  vec2_distance_squared(x1: number, y1: number, x2: number, y2: number): number;
  vec2_lerp(x1: number, y1: number, x2: number, y2: number, t: number): void;
  vec2_angle(x: number, y: number): number;
  vec2_angle_to(x1: number, y1: number, x2: number, y2: number): number;
  vec2_rotate(x: number, y: number, angle: number): void;
  vec2_rotate_around(x: number, y: number, px: number, py: number, angle: number): void;
  vec2_perpendicular(x: number, y: number): void;
  vec2_reflect(x: number, y: number, nx: number, ny: number): void;
  vec2_clamp(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number): void;
  vec2_abs(x: number, y: number): void;
  vec2_floor(x: number, y: number): void;
  vec2_ceil(x: number, y: number): void;
  vec2_round(x: number, y: number): void;
  vec2_equals(x1: number, y1: number, x2: number, y2: number, epsilon: number): number;
  vec2_normalize_mut(x: number, y: number): void;

  // ── Matrix2D ─────────────────────────────────────────────
  mat2d_translation(tx: number, ty: number): void;
  mat2d_scaling(sx: number, sy: number): void;
  mat2d_rotation(angle: number): void;
  mat2d_from_trs(tx: number, ty: number, rotation: number, sx: number, sy: number): void;
  mat2d_multiply(
    a1: number, b1: number, c1: number, d1: number, tx1: number, ty1: number,
    a2: number, b2: number, c2: number, d2: number, tx2: number, ty2: number
  ): void;
  mat2d_invert(a: number, b: number, c: number, d: number, tx: number, ty: number): number;
  mat2d_apply(
    a: number, b: number, c: number, d: number, tx: number, ty: number,
    px: number, py: number
  ): void;
  mat2d_decompose(a: number, b: number, c: number, d: number, tx: number, ty: number): void;
  mat2d_translate(
    a: number, b: number, c: number, d: number, tx: number, ty: number,
    dtx: number, dty: number
  ): void;
  mat2d_scale(
    a: number, b: number, c: number, d: number, tx: number, ty: number,
    sx: number, sy: number
  ): void;
  mat2d_equals(
    a1: number, b1: number, c1: number, d1: number, tx1: number, ty1: number,
    a2: number, b2: number, c2: number, d2: number, tx2: number, ty2: number,
    epsilon: number
  ): number;

  // ── Bounds ───────────────────────────────────────────────
  bounds_intersects(
    minX1: number, minY1: number, maxX1: number, maxY1: number,
    minX2: number, minY2: number, maxX2: number, maxY2: number
  ): number;
  bounds_contains_point(
    minX: number, minY: number, maxX: number, maxY: number,
    px: number, py: number
  ): number;
  bounds_contains_bounds(
    minX1: number, minY1: number, maxX1: number, maxY1: number,
    minX2: number, minY2: number, maxX2: number, maxY2: number
  ): number;
  bounds_union(
    minX1: number, minY1: number, maxX1: number, maxY1: number,
    minX2: number, minY2: number, maxX2: number, maxY2: number
  ): void;
  bounds_intersection(
    minX1: number, minY1: number, maxX1: number, maxY1: number,
    minX2: number, minY2: number, maxX2: number, maxY2: number
  ): number;
  bounds_expand(
    minX: number, minY: number, maxX: number, maxY: number, margin: number
  ): void;
  bounds_expand_xy(
    minX: number, minY: number, maxX: number, maxY: number,
    mx: number, my: number
  ): void;
  bounds_translate(
    minX: number, minY: number, maxX: number, maxY: number,
    dx: number, dy: number
  ): void;
  bounds_equals(
    minX1: number, minY1: number, maxX1: number, maxY1: number,
    minX2: number, minY2: number, maxX2: number, maxY2: number,
    epsilon: number
  ): number;
  bounds_from_points(points: number, count: number): void;

  // ── Bezier ───────────────────────────────────────────────
  bezier_point(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number, t: number
  ): void;
  bezier_derivative(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number, t: number
  ): void;
  bezier_second_derivative(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number, t: number
  ): void;
  bezier_subdivide(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number, t: number
  ): void;
  bezier_arc_length(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number,
    tStart: number, tEnd: number
  ): number;
  bezier_nearest_point(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number,
    qx: number, qy: number, samples: number, iterations: number
  ): void;
  bezier_bounds(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number
  ): void;
  bezier_adaptive_subdivide(
    p0x: number, p0y: number, p1x: number, p1y: number,
    p2x: number, p2y: number, p3x: number, p3y: number,
    tolerance: number, maxDepth: number
  ): number;
}

let wasmInstance: WasmMathInstance | null = null;
let initPromise: Promise<WasmMathInstance> | null = null;

/**
 * Initialize the WASM math module. Safe to call multiple times —
 * returns the cached instance after first load.
 */
export function initWasmMath(): Promise<WasmMathInstance> {
  if (wasmInstance) return Promise.resolve(wasmInstance);
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const module = await MathWasmModuleFactory({
      locateFile: (path: string) => {
        if (path.endsWith('.wasm')) {
          return `assets/math_wasm.wasm`;
        }
        return path;
      },
    });

    const resultPtr: number = module._get_result_ptr();
    const adaptivePtr: number = module._get_adaptive_buf();
    const inputPointsPtr: number = module._get_input_points_ptr();

    // Create Float64Array views into WASM heap
    const resultBuf = new Float64Array(module.HEAPF64.buffer, resultPtr, 16);
    const adaptiveBuf = new Float64Array(module.HEAPF64.buffer, adaptivePtr, 512 * 2);
    const inputPointsBuf = new Float64Array(module.HEAPF64.buffer, inputPointsPtr, 4096 * 2);

    wasmInstance = {
      resultBuf,
      adaptiveBuf,
      inputPointsBuf,

      // Vec2
      vec2_add: module._vec2_add,
      vec2_sub: module._vec2_sub,
      vec2_scale: module._vec2_scale,
      vec2_scale_xy: module._vec2_scale_xy,
      vec2_negate: module._vec2_negate,
      vec2_dot: module._vec2_dot,
      vec2_cross: module._vec2_cross,
      vec2_length: module._vec2_length,
      vec2_length_squared: module._vec2_length_squared,
      vec2_normalize: module._vec2_normalize,
      vec2_distance: module._vec2_distance,
      vec2_distance_squared: module._vec2_distance_squared,
      vec2_lerp: module._vec2_lerp,
      vec2_angle: module._vec2_angle,
      vec2_angle_to: module._vec2_angle_to,
      vec2_rotate: module._vec2_rotate,
      vec2_rotate_around: module._vec2_rotate_around,
      vec2_perpendicular: module._vec2_perpendicular,
      vec2_reflect: module._vec2_reflect,
      vec2_clamp: module._vec2_clamp,
      vec2_abs: module._vec2_abs,
      vec2_floor: module._vec2_floor,
      vec2_ceil: module._vec2_ceil,
      vec2_round: module._vec2_round,
      vec2_equals: module._vec2_equals,
      vec2_normalize_mut: module._vec2_normalize_mut,

      // Matrix2D
      mat2d_translation: module._mat2d_translation,
      mat2d_scaling: module._mat2d_scaling,
      mat2d_rotation: module._mat2d_rotation,
      mat2d_from_trs: module._mat2d_from_trs,
      mat2d_multiply: module._mat2d_multiply,
      mat2d_invert: module._mat2d_invert,
      mat2d_apply: module._mat2d_apply,
      mat2d_decompose: module._mat2d_decompose,
      mat2d_translate: module._mat2d_translate,
      mat2d_scale: module._mat2d_scale,
      mat2d_equals: module._mat2d_equals,

      // Bounds
      bounds_intersects: module._bounds_intersects,
      bounds_contains_point: module._bounds_contains_point,
      bounds_contains_bounds: module._bounds_contains_bounds,
      bounds_union: module._bounds_union,
      bounds_intersection: module._bounds_intersection,
      bounds_expand: module._bounds_expand,
      bounds_expand_xy: module._bounds_expand_xy,
      bounds_translate: module._bounds_translate,
      bounds_equals: module._bounds_equals,
      bounds_from_points: module._bounds_from_points,

      // Bezier
      bezier_point: module._bezier_point,
      bezier_derivative: module._bezier_derivative,
      bezier_second_derivative: module._bezier_second_derivative,
      bezier_subdivide: module._bezier_subdivide,
      bezier_arc_length: module._bezier_arc_length,
      bezier_nearest_point: module._bezier_nearest_point,
      bezier_bounds: module._bezier_bounds,
      bezier_adaptive_subdivide: module._bezier_adaptive_subdivide,
    };

    return wasmInstance;
  })();

  return initPromise;
}

/**
 * Get the already-initialized WASM instance.
 * Throws if initWasmMath() hasn't completed yet.
 */
export function getWasm(): WasmMathInstance {
  if (!wasmInstance) {
    throw new Error(
      'WASM math module not initialized. ' +
      'Call and await initWasmMath() before using math operations.'
    );
  }
  return wasmInstance;
}
