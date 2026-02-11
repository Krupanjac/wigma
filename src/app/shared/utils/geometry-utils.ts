import { Vec2 } from '../math/vec2';

/**
 * Geometry utility functions.
 */

/**
 * Ray-casting point-in-polygon test. O(v), v = number of vertices.
 *
 * Algorithm: Cast a horizontal ray from the test point to +∞.
 * Count how many polygon edges cross that ray.
 * Odd count = inside, even count = outside.
 *
 * Edge cases: points exactly on an edge or vertex are handled
 * by the strict inequality on y-coordinates.
 */
export function pointInPolygon(point: Vec2, vertices: Vec2[]): boolean {
  const n = vertices.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = vertices[i].x, yi = vertices[i].y;
    const xj = vertices[j].x, yj = vertices[j].y;

    // Check if the ray crosses the edge from vertices[j] to vertices[i]
    if ((yi > point.y) !== (yj > point.y)) {
      const intersectX = xj + ((point.y - yj) / (yi - yj)) * (xi - xj);
      if (point.x < intersectX) {
        inside = !inside;
      }
    }
  }

  return inside;
}

/**
 * Point-in-ellipse test. O(1).
 * Tests if (x/rx)² + (y/ry)² <= 1 in local space.
 */
export function pointInEllipse(
  localX: number, localY: number,
  rx: number, ry: number
): boolean {
  if (rx <= 0 || ry <= 0) return false;
  const nx = localX / rx;
  const ny = localY / ry;
  return nx * nx + ny * ny <= 1;
}

/**
 * Generate regular polygon vertices. O(n).
 */
export function regularPolygonVertices(sides: number, radius: number, cx: number = 0, cy: number = 0): Vec2[] {
  const vertices: Vec2[] = [];
  const angleStep = (2 * Math.PI) / sides;
  const startAngle = -Math.PI / 2; // Start from top

  for (let i = 0; i < sides; i++) {
    const angle = startAngle + i * angleStep;
    vertices.push(new Vec2(
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle)
    ));
  }

  return vertices;
}

/**
 * Generate star vertices with inner and outer radius. O(n).
 */
export function starVertices(
  points: number,
  outerRadius: number,
  innerRadius: number,
  cx: number = 0,
  cy: number = 0
): Vec2[] {
  const vertices: Vec2[] = [];
  const totalPoints = points * 2;
  const angleStep = (2 * Math.PI) / totalPoints;
  const startAngle = -Math.PI / 2;

  for (let i = 0; i < totalPoints; i++) {
    const angle = startAngle + i * angleStep;
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    vertices.push(new Vec2(
      cx + radius * Math.cos(angle),
      cy + radius * Math.sin(angle)
    ));
  }

  return vertices;
}

/**
 * Clamp a number to a range.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Linear interpolation.
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Convert degrees to radians.
 */
export function degToRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Convert radians to degrees.
 */
export function radToDeg(radians: number): number {
  return radians * (180 / Math.PI);
}

/**
 * Snap a value to the nearest grid increment.
 */
export function snapToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

/**
 * Binary search for nearest snap coordinate. O(log g), g = guide count.
 */
export function findNearestSnap(
  value: number,
  sortedGuides: number[],
  threshold: number
): { guide: number; distance: number } | null {
  if (sortedGuides.length === 0) return null;

  let lo = 0;
  let hi = sortedGuides.length - 1;

  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (sortedGuides[mid] < value) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Check lo and hi candidates
  let bestGuide = sortedGuides[0];
  let bestDist = Math.abs(value - bestGuide);

  for (const idx of [hi, lo]) {
    if (idx >= 0 && idx < sortedGuides.length) {
      const dist = Math.abs(value - sortedGuides[idx]);
      if (dist < bestDist) {
        bestDist = dist;
        bestGuide = sortedGuides[idx];
      }
    }
  }

  if (bestDist <= threshold) {
    return { guide: bestGuide, distance: bestDist };
  }

  return null;
}
