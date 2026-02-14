/**
 * Cubic Bézier curve utilities — WASM-accelerated.
 *
 * Drop-in replacement for the original TypeScript bezier module.
 * All heavy computation delegates to the C/WASM module.
 */
import { Vec2 } from './vec2';
import { getWasm } from './wasm-math';

/** A cubic Bézier segment defined by 4 control points. */
export interface CubicBezierSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

/**
 * Evaluate a cubic Bézier at parameter t using De Casteljau's algorithm.
 */
export function cubicBezierPoint(seg: CubicBezierSegment, t: number): Vec2 {
  const w = getWasm();
  w.bezier_point(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y, t
  );
  return new Vec2(w.resultBuf[0], w.resultBuf[1]);
}

/**
 * Evaluate the first derivative of a cubic Bézier at parameter t.
 */
export function cubicBezierDerivative(seg: CubicBezierSegment, t: number): Vec2 {
  const w = getWasm();
  w.bezier_derivative(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y, t
  );
  return new Vec2(w.resultBuf[0], w.resultBuf[1]);
}

/**
 * Evaluate the second derivative of a cubic Bézier at parameter t.
 */
export function cubicBezierSecondDerivative(seg: CubicBezierSegment, t: number): Vec2 {
  const w = getWasm();
  w.bezier_second_derivative(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y, t
  );
  return new Vec2(w.resultBuf[0], w.resultBuf[1]);
}

/**
 * Split a cubic Bézier at parameter t into two cubic segments.
 */
export function subdivide(
  seg: CubicBezierSegment,
  t: number
): [CubicBezierSegment, CubicBezierSegment] {
  const w = getWasm();
  w.bezier_subdivide(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y, t
  );
  const r = w.resultBuf;
  return [
    {
      p0: new Vec2(r[0], r[1]),
      p1: new Vec2(r[2], r[3]),
      p2: new Vec2(r[4], r[5]),
      p3: new Vec2(r[6], r[7]),
    },
    {
      p0: new Vec2(r[8], r[9]),
      p1: new Vec2(r[10], r[11]),
      p2: new Vec2(r[12], r[13]),
      p3: new Vec2(r[14], r[15]),
    },
  ];
}

/**
 * Compute arc length of a cubic Bézier segment using 5-point
 * Gauss-Legendre quadrature.
 */
export function cubicArcLength(
  seg: CubicBezierSegment,
  tStart: number = 0,
  tEnd: number = 1
): number {
  return getWasm().bezier_arc_length(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y,
    tStart, tEnd
  );
}

/**
 * Find the parameter t of the nearest point on a cubic Bézier to query point Q.
 * Uses Newton-Raphson refinement.
 */
export function nearestPointOnCubic(
  seg: CubicBezierSegment,
  q: Vec2,
  samples: number = 8,
  iterations: number = 5
): { t: number; point: Vec2; distance: number } {
  const w = getWasm();
  w.bezier_nearest_point(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y,
    q.x, q.y, samples, iterations
  );
  return {
    t: w.resultBuf[0],
    point: new Vec2(w.resultBuf[1], w.resultBuf[2]),
    distance: w.resultBuf[3],
  };
}

/**
 * Adaptively subdivide a cubic Bézier into line segments
 * based on a flatness tolerance.
 */
export function adaptiveSubdivide(
  seg: CubicBezierSegment,
  tolerance: number = 0.5,
  maxDepth: number = 8
): Vec2[] {
  const w = getWasm();
  const count = w.bezier_adaptive_subdivide(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y,
    tolerance, maxDepth
  );
  const points: Vec2[] = new Array(count);
  for (let i = 0; i < count; i++) {
    points[i] = new Vec2(w.adaptiveBuf[i * 2], w.adaptiveBuf[i * 2 + 1]);
  }
  return points;
}

/**
 * Compute the tight bounding box of a cubic Bézier segment.
 */
export function cubicBezierBounds(seg: CubicBezierSegment): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  const w = getWasm();
  w.bezier_bounds(
    seg.p0.x, seg.p0.y, seg.p1.x, seg.p1.y,
    seg.p2.x, seg.p2.y, seg.p3.x, seg.p3.y
  );
  return {
    minX: w.resultBuf[0],
    minY: w.resultBuf[1],
    maxX: w.resultBuf[2],
    maxY: w.resultBuf[3],
  };
}
