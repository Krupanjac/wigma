/**
 * Type declarations for the Emscripten-generated math_wasm.mjs module.
 */
declare module '*/math_wasm.mjs' {
  interface MathWasmModule {
    HEAPF64: Float64Array;
    _get_result_ptr(): number;
    _get_adaptive_buf(): number;
    _get_input_points_ptr(): number;

    // Vec2
    _vec2_add(x1: number, y1: number, x2: number, y2: number): void;
    _vec2_sub(x1: number, y1: number, x2: number, y2: number): void;
    _vec2_scale(x: number, y: number, s: number): void;
    _vec2_scale_xy(x: number, y: number, sx: number, sy: number): void;
    _vec2_negate(x: number, y: number): void;
    _vec2_dot(x1: number, y1: number, x2: number, y2: number): number;
    _vec2_cross(x1: number, y1: number, x2: number, y2: number): number;
    _vec2_length(x: number, y: number): number;
    _vec2_length_squared(x: number, y: number): number;
    _vec2_normalize(x: number, y: number): void;
    _vec2_distance(x1: number, y1: number, x2: number, y2: number): number;
    _vec2_distance_squared(x1: number, y1: number, x2: number, y2: number): number;
    _vec2_lerp(x1: number, y1: number, x2: number, y2: number, t: number): void;
    _vec2_angle(x: number, y: number): number;
    _vec2_angle_to(x1: number, y1: number, x2: number, y2: number): number;
    _vec2_rotate(x: number, y: number, angle: number): void;
    _vec2_rotate_around(x: number, y: number, px: number, py: number, angle: number): void;
    _vec2_perpendicular(x: number, y: number): void;
    _vec2_reflect(x: number, y: number, nx: number, ny: number): void;
    _vec2_clamp(x: number, y: number, minX: number, minY: number, maxX: number, maxY: number): void;
    _vec2_abs(x: number, y: number): void;
    _vec2_floor(x: number, y: number): void;
    _vec2_ceil(x: number, y: number): void;
    _vec2_round(x: number, y: number): void;
    _vec2_equals(x1: number, y1: number, x2: number, y2: number, epsilon: number): number;
    _vec2_normalize_mut(x: number, y: number): void;

    // Matrix2D
    _mat2d_translation(tx: number, ty: number): void;
    _mat2d_scaling(sx: number, sy: number): void;
    _mat2d_rotation(angle: number): void;
    _mat2d_from_trs(tx: number, ty: number, rotation: number, sx: number, sy: number): void;
    _mat2d_multiply(
      a1: number, b1: number, c1: number, d1: number, tx1: number, ty1: number,
      a2: number, b2: number, c2: number, d2: number, tx2: number, ty2: number
    ): void;
    _mat2d_invert(a: number, b: number, c: number, d: number, tx: number, ty: number): number;
    _mat2d_apply(
      a: number, b: number, c: number, d: number, tx: number, ty: number,
      px: number, py: number
    ): void;
    _mat2d_decompose(a: number, b: number, c: number, d: number, tx: number, ty: number): void;
    _mat2d_translate(
      a: number, b: number, c: number, d: number, tx: number, ty: number,
      dtx: number, dty: number
    ): void;
    _mat2d_scale(
      a: number, b: number, c: number, d: number, tx: number, ty: number,
      sx: number, sy: number
    ): void;
    _mat2d_equals(
      a1: number, b1: number, c1: number, d1: number, tx1: number, ty1: number,
      a2: number, b2: number, c2: number, d2: number, tx2: number, ty2: number,
      epsilon: number
    ): number;

    // Bounds
    _bounds_intersects(
      minX1: number, minY1: number, maxX1: number, maxY1: number,
      minX2: number, minY2: number, maxX2: number, maxY2: number
    ): number;
    _bounds_contains_point(
      minX: number, minY: number, maxX: number, maxY: number,
      px: number, py: number
    ): number;
    _bounds_contains_bounds(
      minX1: number, minY1: number, maxX1: number, maxY1: number,
      minX2: number, minY2: number, maxX2: number, maxY2: number
    ): number;
    _bounds_union(
      minX1: number, minY1: number, maxX1: number, maxY1: number,
      minX2: number, minY2: number, maxX2: number, maxY2: number
    ): void;
    _bounds_intersection(
      minX1: number, minY1: number, maxX1: number, maxY1: number,
      minX2: number, minY2: number, maxX2: number, maxY2: number
    ): number;
    _bounds_expand(
      minX: number, minY: number, maxX: number, maxY: number, margin: number
    ): void;
    _bounds_expand_xy(
      minX: number, minY: number, maxX: number, maxY: number,
      mx: number, my: number
    ): void;
    _bounds_translate(
      minX: number, minY: number, maxX: number, maxY: number,
      dx: number, dy: number
    ): void;
    _bounds_equals(
      minX1: number, minY1: number, maxX1: number, maxY1: number,
      minX2: number, minY2: number, maxX2: number, maxY2: number,
      epsilon: number
    ): number;
    _bounds_from_points(points: number, count: number): void;

    // Bezier
    _bezier_point(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ): void;
    _bezier_derivative(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ): void;
    _bezier_second_derivative(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ): void;
    _bezier_subdivide(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number, t: number
    ): void;
    _bezier_arc_length(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number,
      tStart: number, tEnd: number
    ): number;
    _bezier_nearest_point(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number,
      qx: number, qy: number, samples: number, iterations: number
    ): void;
    _bezier_bounds(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number
    ): void;
    _bezier_adaptive_subdivide(
      p0x: number, p0y: number, p1x: number, p1y: number,
      p2x: number, p2y: number, p3x: number, p3y: number,
      tolerance: number, maxDepth: number
    ): number;

    _malloc(size: number): number;
    _free(ptr: number): void;
  }

  type MathWasmModuleFactory = (options?: {
    locateFile?: (path: string) => string;
  }) => Promise<MathWasmModule>;

  const factory: MathWasmModuleFactory;
  export default factory;
}
