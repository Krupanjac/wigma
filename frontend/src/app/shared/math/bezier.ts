import { Vec2 } from './vec2';

/**
 * Cubic Bézier curve utilities.
 *
 * De Casteljau evaluation: O(n²) for degree n; O(1) for cubic.
 * Cubic subdivision at parameter t producing 2 new cubic segments: O(1).
 * Arc-length via Gauss-Legendre quadrature (5-point): O(1).
 * Nearest-point-on-curve via Newton-Raphson: converges in ~5 iterations.
 */

/** A cubic Bézier segment defined by 4 control points. */
export interface CubicBezierSegment {
  p0: Vec2;
  p1: Vec2;
  p2: Vec2;
  p3: Vec2;
}

// ── Gauss-Legendre 5-point quadrature weights and abscissae ──

const GL5_WEIGHTS = [
  0.2369268850561891, 0.4786286704993665, 0.5688888888888889,
  0.4786286704993665, 0.2369268850561891,
];

const GL5_ABSCISSAE = [
  -0.9061798459386640, -0.5384693101056831, 0.0,
  0.5384693101056831, 0.9061798459386640,
];

// ── De Casteljau Evaluation ──────────────────────────────────

/**
 * Evaluate a cubic Bézier at parameter t using De Casteljau's algorithm.
 * O(1) for cubic (degree 3).
 */
export function cubicBezierPoint(seg: CubicBezierSegment, t: number): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  const x =
    mt2 * mt * seg.p0.x +
    3 * mt2 * t * seg.p1.x +
    3 * mt * t2 * seg.p2.x +
    t2 * t * seg.p3.x;

  const y =
    mt2 * mt * seg.p0.y +
    3 * mt2 * t * seg.p1.y +
    3 * mt * t2 * seg.p2.y +
    t2 * t * seg.p3.y;

  return new Vec2(x, y);
}

/**
 * Evaluate the first derivative of a cubic Bézier at parameter t.
 */
export function cubicBezierDerivative(seg: CubicBezierSegment, t: number): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  const x =
    3 * mt2 * (seg.p1.x - seg.p0.x) +
    6 * mt * t * (seg.p2.x - seg.p1.x) +
    3 * t2 * (seg.p3.x - seg.p2.x);

  const y =
    3 * mt2 * (seg.p1.y - seg.p0.y) +
    6 * mt * t * (seg.p2.y - seg.p1.y) +
    3 * t2 * (seg.p3.y - seg.p2.y);

  return new Vec2(x, y);
}

/**
 * Evaluate the second derivative of a cubic Bézier at parameter t.
 */
export function cubicBezierSecondDerivative(seg: CubicBezierSegment, t: number): Vec2 {
  const mt = 1 - t;

  const x =
    6 * mt * (seg.p2.x - 2 * seg.p1.x + seg.p0.x) +
    6 * t * (seg.p3.x - 2 * seg.p2.x + seg.p1.x);

  const y =
    6 * mt * (seg.p2.y - 2 * seg.p1.y + seg.p0.y) +
    6 * t * (seg.p3.y - 2 * seg.p2.y + seg.p1.y);

  return new Vec2(x, y);
}

// ── Cubic Subdivision ────────────────────────────────────────

/**
 * Split a cubic Bézier at parameter t into two cubic segments.
 * Uses De Casteljau's construction. O(1).
 */
export function subdivide(
  seg: CubicBezierSegment,
  t: number
): [CubicBezierSegment, CubicBezierSegment] {
  const { p0, p1, p2, p3 } = seg;

  // Level 1
  const q0 = p0.lerp(p1, t);
  const q1 = p1.lerp(p2, t);
  const q2 = p2.lerp(p3, t);

  // Level 2
  const r0 = q0.lerp(q1, t);
  const r1 = q1.lerp(q2, t);

  // Level 3 — the point on the curve
  const s = r0.lerp(r1, t);

  return [
    { p0, p1: q0, p2: r0, p3: s },
    { p0: s, p1: r1, p2: q2, p3 },
  ];
}

// ── Arc Length (Gauss-Legendre Quadrature) ────────────────────

/**
 * Compute arc length of a cubic Bézier segment using 5-point
 * Gauss-Legendre quadrature. O(1).
 */
export function cubicArcLength(seg: CubicBezierSegment, tStart: number = 0, tEnd: number = 1): number {
  const halfRange = (tEnd - tStart) / 2;
  const midpoint = (tEnd + tStart) / 2;

  let sum = 0;
  for (let i = 0; i < 5; i++) {
    const t = halfRange * GL5_ABSCISSAE[i] + midpoint;
    const d = cubicBezierDerivative(seg, t);
    sum += GL5_WEIGHTS[i] * d.length();
  }

  return halfRange * sum;
}

// ── Nearest Point on Curve (Newton-Raphson) ──────────────────

/**
 * Find the parameter t of the nearest point on a cubic Bézier to query point Q.
 *
 * Uses Newton-Raphson on d/dt ||P(t) - Q||² = 0.
 * The objective function derivative is: 2 * dot(P(t) - Q, P'(t)).
 * The second derivative is: 2 * (dot(P'(t), P'(t)) + dot(P(t) - Q, P''(t))).
 *
 * Converges in ~5 iterations for typical cases.
 *
 * @param seg The cubic Bézier segment
 * @param q The query point
 * @param samples Number of initial samples for coarse search (default 8)
 * @param iterations Newton-Raphson iterations (default 5)
 * @returns { t: number, point: Vec2, distance: number }
 */
export function nearestPointOnCubic(
  seg: CubicBezierSegment,
  q: Vec2,
  samples: number = 8,
  iterations: number = 5
): { t: number; point: Vec2; distance: number } {
  // Coarse sampling to find initial guess
  let bestT = 0;
  let bestDistSq = Infinity;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = cubicBezierPoint(seg, t);
    const distSq = p.distanceToSquared(q);
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestT = t;
    }
  }

  // Newton-Raphson refinement
  let t = bestT;
  for (let i = 0; i < iterations; i++) {
    const p = cubicBezierPoint(seg, t);
    const d1 = cubicBezierDerivative(seg, t);
    const d2 = cubicBezierSecondDerivative(seg, t);

    const diff = p.sub(q);

    // f(t)  = dot(P(t) - Q, P'(t))
    const f = diff.dot(d1);
    // f'(t) = dot(P'(t), P'(t)) + dot(P(t) - Q, P''(t))
    const fPrime = d1.dot(d1) + diff.dot(d2);

    if (Math.abs(fPrime) < 1e-12) break;

    t -= f / fPrime;
    t = Math.max(0, Math.min(1, t)); // clamp to [0, 1]
  }

  const point = cubicBezierPoint(seg, t);
  const distance = point.distanceTo(q);
  return { t, point, distance };
}

// ── Adaptive Subdivision (LOD) ───────────────────────────────

/**
 * Adaptively subdivide a cubic Bézier into line segments
 * based on a flatness tolerance (screen-space pixel threshold).
 *
 * Flatness test: max distance of control points from the baseline
 * chord (p0→p3). If within tolerance, treat as line.
 *
 * @param seg The cubic Bézier segment
 * @param tolerance Flatness tolerance in pixels (default 0.5)
 * @param maxDepth Maximum recursion depth (default 8)
 * @returns Array of points approximating the curve
 */
export function adaptiveSubdivide(
  seg: CubicBezierSegment,
  tolerance: number = 0.5,
  maxDepth: number = 8
): Vec2[] {
  const points: Vec2[] = [seg.p0];
  adaptiveSubdivideImpl(seg, tolerance, maxDepth, 0, points);
  return points;
}

function adaptiveSubdivideImpl(
  seg: CubicBezierSegment,
  tolerance: number,
  maxDepth: number,
  depth: number,
  points: Vec2[]
): void {
  if (depth >= maxDepth || isFlatEnough(seg, tolerance)) {
    points.push(seg.p3);
    return;
  }

  const [left, right] = subdivide(seg, 0.5);
  adaptiveSubdivideImpl(left, tolerance, maxDepth, depth + 1, points);
  adaptiveSubdivideImpl(right, tolerance, maxDepth, depth + 1, points);
}

/**
 * Flatness test: check if control points are within tolerance of the
 * baseline chord (p0→p3).
 */
function isFlatEnough(seg: CubicBezierSegment, tolerance: number): boolean {
  const { p0, p1, p2, p3 } = seg;

  // Vector from p0 to p3
  const dx = p3.x - p0.x;
  const dy = p3.y - p0.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-12) {
    // Degenerate segment — check distance of control points from p0
    const d1 = p0.distanceToSquared(p1);
    const d2 = p0.distanceToSquared(p2);
    return Math.max(d1, d2) <= tolerance * tolerance;
  }

  // Perpendicular distance of p1 and p2 from the chord
  const invLen = 1 / Math.sqrt(lenSq);
  const nx = -dy * invLen;
  const ny = dx * invLen;

  const d1 = Math.abs(nx * (p1.x - p0.x) + ny * (p1.y - p0.y));
  const d2 = Math.abs(nx * (p2.x - p0.x) + ny * (p2.y - p0.y));

  return Math.max(d1, d2) <= tolerance;
}

// ── Bounding Box ─────────────────────────────────────────────

/**
 * Compute the tight bounding box of a cubic Bézier segment.
 * Finds extrema by solving the derivative = 0 for each axis.
 */
export function cubicBezierBounds(seg: CubicBezierSegment): {
  minX: number; minY: number; maxX: number; maxY: number;
} {
  const { p0, p1, p2, p3 } = seg;

  let minX = Math.min(p0.x, p3.x);
  let maxX = Math.max(p0.x, p3.x);
  let minY = Math.min(p0.y, p3.y);
  let maxY = Math.max(p0.y, p3.y);

  // For each axis, solve 3at² + 2bt + c = 0
  for (const axis of ['x', 'y'] as const) {
    const a0 = p0[axis], a1 = p1[axis], a2 = p2[axis], a3 = p3[axis];
    const a = -3 * a0 + 9 * a1 - 9 * a2 + 3 * a3;
    const b = 6 * a0 - 12 * a1 + 6 * a2;
    const c = -3 * a0 + 3 * a1;

    if (Math.abs(a) < 1e-12) {
      // Linear
      if (Math.abs(b) > 1e-12) {
        const t = -c / b;
        if (t > 0 && t < 1) {
          const val = cubicBezierPoint(seg, t)[axis];
          if (axis === 'x') { minX = Math.min(minX, val); maxX = Math.max(maxX, val); }
          else { minY = Math.min(minY, val); maxY = Math.max(maxY, val); }
        }
      }
      continue;
    }

    const disc = b * b - 4 * a * c;
    if (disc < 0) continue;
    const sqrtDisc = Math.sqrt(disc);

    for (const t of [(-b + sqrtDisc) / (2 * a), (-b - sqrtDisc) / (2 * a)]) {
      if (t > 0 && t < 1) {
        const val = cubicBezierPoint(seg, t)[axis];
        if (axis === 'x') { minX = Math.min(minX, val); maxX = Math.max(maxX, val); }
        else { minY = Math.min(minY, val); maxY = Math.max(maxY, val); }
      }
    }
  }

  return { minX, minY, maxX, maxY };
}
