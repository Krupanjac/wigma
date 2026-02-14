/**
 * WASM Math Library for Wigma
 *
 * Implements Vec2, Matrix2D, Bounds, and Bezier operations in C,
 * compiled to WebAssembly via Emscripten.
 *
 * All multi-value returns use a shared result buffer in WASM linear memory.
 * The TypeScript wrapper reads results from this buffer via Float64Array view.
 */

#include <emscripten/emscripten.h>
#include <math.h>

/* ── Result Buffer ──────────────────────────────────────────── */

/* Shared scratch buffer for returning multiple values to JS.
 * 16 doubles = 128 bytes, enough for any operation here. */
static double result_buf[16];

EMSCRIPTEN_KEEPALIVE
double* get_result_ptr(void) {
    return result_buf;
}

/* ══════════════════════════════════════════════════════════════
 *  Vec2 Operations
 * ══════════════════════════════════════════════════════════════ */

EMSCRIPTEN_KEEPALIVE
void vec2_add(double x1, double y1, double x2, double y2) {
    result_buf[0] = x1 + x2;
    result_buf[1] = y1 + y2;
}

EMSCRIPTEN_KEEPALIVE
void vec2_sub(double x1, double y1, double x2, double y2) {
    result_buf[0] = x1 - x2;
    result_buf[1] = y1 - y2;
}

EMSCRIPTEN_KEEPALIVE
void vec2_scale(double x, double y, double s) {
    result_buf[0] = x * s;
    result_buf[1] = y * s;
}

EMSCRIPTEN_KEEPALIVE
void vec2_scale_xy(double x, double y, double sx, double sy) {
    result_buf[0] = x * sx;
    result_buf[1] = y * sy;
}

EMSCRIPTEN_KEEPALIVE
void vec2_negate(double x, double y) {
    result_buf[0] = -x;
    result_buf[1] = -y;
}

EMSCRIPTEN_KEEPALIVE
double vec2_dot(double x1, double y1, double x2, double y2) {
    return x1 * x2 + y1 * y2;
}

EMSCRIPTEN_KEEPALIVE
double vec2_cross(double x1, double y1, double x2, double y2) {
    return x1 * y2 - y1 * x2;
}

EMSCRIPTEN_KEEPALIVE
double vec2_length(double x, double y) {
    return sqrt(x * x + y * y);
}

EMSCRIPTEN_KEEPALIVE
double vec2_length_squared(double x, double y) {
    return x * x + y * y;
}

EMSCRIPTEN_KEEPALIVE
void vec2_normalize(double x, double y) {
    double len = sqrt(x * x + y * y);
    if (len < 1e-10) {
        result_buf[0] = 0.0;
        result_buf[1] = 0.0;
    } else {
        result_buf[0] = x / len;
        result_buf[1] = y / len;
    }
}

EMSCRIPTEN_KEEPALIVE
double vec2_distance(double x1, double y1, double x2, double y2) {
    double dx = x1 - x2;
    double dy = y1 - y2;
    return sqrt(dx * dx + dy * dy);
}

EMSCRIPTEN_KEEPALIVE
double vec2_distance_squared(double x1, double y1, double x2, double y2) {
    double dx = x1 - x2;
    double dy = y1 - y2;
    return dx * dx + dy * dy;
}

EMSCRIPTEN_KEEPALIVE
void vec2_lerp(double x1, double y1, double x2, double y2, double t) {
    result_buf[0] = x1 + (x2 - x1) * t;
    result_buf[1] = y1 + (y2 - y1) * t;
}

EMSCRIPTEN_KEEPALIVE
double vec2_angle(double x, double y) {
    return atan2(y, x);
}

EMSCRIPTEN_KEEPALIVE
double vec2_angle_to(double x1, double y1, double x2, double y2) {
    return atan2(y2 - y1, x2 - x1);
}

EMSCRIPTEN_KEEPALIVE
void vec2_rotate(double x, double y, double angle) {
    double c = cos(angle);
    double s = sin(angle);
    result_buf[0] = x * c - y * s;
    result_buf[1] = x * s + y * c;
}

EMSCRIPTEN_KEEPALIVE
void vec2_rotate_around(double x, double y, double px, double py, double angle) {
    double dx = x - px;
    double dy = y - py;
    double c = cos(angle);
    double s = sin(angle);
    result_buf[0] = px + dx * c - dy * s;
    result_buf[1] = py + dx * s + dy * c;
}

EMSCRIPTEN_KEEPALIVE
void vec2_perpendicular(double x, double y) {
    result_buf[0] = -y;
    result_buf[1] = x;
}

EMSCRIPTEN_KEEPALIVE
void vec2_reflect(double x, double y, double nx, double ny) {
    double d = 2.0 * (x * nx + y * ny);
    result_buf[0] = x - d * nx;
    result_buf[1] = y - d * ny;
}

EMSCRIPTEN_KEEPALIVE
void vec2_clamp(double x, double y,
                double minX, double minY,
                double maxX, double maxY) {
    result_buf[0] = fmax(minX, fmin(maxX, x));
    result_buf[1] = fmax(minY, fmin(maxY, y));
}

EMSCRIPTEN_KEEPALIVE
void vec2_abs(double x, double y) {
    result_buf[0] = fabs(x);
    result_buf[1] = fabs(y);
}

EMSCRIPTEN_KEEPALIVE
void vec2_floor(double x, double y) {
    result_buf[0] = floor(x);
    result_buf[1] = floor(y);
}

EMSCRIPTEN_KEEPALIVE
void vec2_ceil(double x, double y) {
    result_buf[0] = ceil(x);
    result_buf[1] = ceil(y);
}

EMSCRIPTEN_KEEPALIVE
void vec2_round(double x, double y) {
    result_buf[0] = round(x);
    result_buf[1] = round(y);
}

EMSCRIPTEN_KEEPALIVE
int vec2_equals(double x1, double y1, double x2, double y2, double epsilon) {
    return (fabs(x1 - x2) < epsilon && fabs(y1 - y2) < epsilon) ? 1 : 0;
}

/* ── MutableVec2 operations ─────────────────────────────────── */

EMSCRIPTEN_KEEPALIVE
void vec2_normalize_mut(double x, double y) {
    double len = sqrt(x * x + y * y);
    if (len < 1e-10) {
        result_buf[0] = 0.0;
        result_buf[1] = 0.0;
    } else {
        result_buf[0] = x / len;
        result_buf[1] = y / len;
    }
}


/* ══════════════════════════════════════════════════════════════
 *  Matrix2D Operations
 *
 *  Layout: | a  c  tx |
 *          | b  d  ty |
 *          | 0  0  1  |
 * ══════════════════════════════════════════════════════════════ */

EMSCRIPTEN_KEEPALIVE
void mat2d_translation(double tx, double ty) {
    result_buf[0] = 1.0; result_buf[1] = 0.0;
    result_buf[2] = 0.0; result_buf[3] = 1.0;
    result_buf[4] = tx;  result_buf[5] = ty;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_scaling(double sx, double sy) {
    result_buf[0] = sx;  result_buf[1] = 0.0;
    result_buf[2] = 0.0; result_buf[3] = sy;
    result_buf[4] = 0.0; result_buf[5] = 0.0;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_rotation(double angle) {
    double c = cos(angle);
    double s = sin(angle);
    result_buf[0] = c;   result_buf[1] = s;
    result_buf[2] = -s;  result_buf[3] = c;
    result_buf[4] = 0.0; result_buf[5] = 0.0;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_from_trs(double tx, double ty, double rotation, double sx, double sy) {
    double c = cos(rotation);
    double s = sin(rotation);
    result_buf[0] = c * sx;
    result_buf[1] = s * sx;
    result_buf[2] = -s * sy;
    result_buf[3] = c * sy;
    result_buf[4] = tx;
    result_buf[5] = ty;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_multiply(double a1, double b1, double c1, double d1, double tx1, double ty1,
                    double a2, double b2, double c2, double d2, double tx2, double ty2) {
    result_buf[0] = a1 * a2 + c1 * b2;
    result_buf[1] = b1 * a2 + d1 * b2;
    result_buf[2] = a1 * c2 + c1 * d2;
    result_buf[3] = b1 * c2 + d1 * d2;
    result_buf[4] = a1 * tx2 + c1 * ty2 + tx1;
    result_buf[5] = b1 * tx2 + d1 * ty2 + ty1;
}

EMSCRIPTEN_KEEPALIVE
int mat2d_invert(double a, double b, double c, double d, double tx, double ty) {
    double det = a * d - b * c;
    if (fabs(det) < 1e-12) return 0;
    double inv_det = 1.0 / det;
    result_buf[0] =  d * inv_det;
    result_buf[1] = -b * inv_det;
    result_buf[2] = -c * inv_det;
    result_buf[3] =  a * inv_det;
    result_buf[4] = (c * ty - d * tx) * inv_det;
    result_buf[5] = (b * tx - a * ty) * inv_det;
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_apply(double a, double b, double c, double d, double tx, double ty,
                 double px, double py) {
    result_buf[0] = a * px + c * py + tx;
    result_buf[1] = b * px + d * py + ty;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_decompose(double a, double b, double c, double d, double tx, double ty) {
    double sx = sqrt(a * a + b * b);
    double sy = sqrt(c * c + d * d);
    double det = a * d - b * c;
    double sign_y = det < 0.0 ? -1.0 : 1.0;
    double rotation = atan2(b, a);
    /* result: tx, ty, rotation, sx, signY*sy */
    result_buf[0] = tx;
    result_buf[1] = ty;
    result_buf[2] = rotation;
    result_buf[3] = sx;
    result_buf[4] = sign_y * sy;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_translate(double a, double b, double c, double d, double tx, double ty,
                     double dtx, double dty) {
    result_buf[0] = a;  result_buf[1] = b;
    result_buf[2] = c;  result_buf[3] = d;
    result_buf[4] = tx + dtx;
    result_buf[5] = ty + dty;
}

EMSCRIPTEN_KEEPALIVE
void mat2d_scale(double a, double b, double c, double d, double tx, double ty,
                 double sx, double sy) {
    result_buf[0] = a * sx; result_buf[1] = b * sx;
    result_buf[2] = c * sy; result_buf[3] = d * sy;
    result_buf[4] = tx;     result_buf[5] = ty;
}

EMSCRIPTEN_KEEPALIVE
int mat2d_equals(double a1, double b1, double c1, double d1, double tx1, double ty1,
                 double a2, double b2, double c2, double d2, double tx2, double ty2,
                 double epsilon) {
    return (fabs(a1 - a2) < epsilon &&
            fabs(b1 - b2) < epsilon &&
            fabs(c1 - c2) < epsilon &&
            fabs(d1 - d2) < epsilon &&
            fabs(tx1 - tx2) < epsilon &&
            fabs(ty1 - ty2) < epsilon) ? 1 : 0;
}


/* ══════════════════════════════════════════════════════════════
 *  Bounds Operations
 * ══════════════════════════════════════════════════════════════ */

EMSCRIPTEN_KEEPALIVE
int bounds_intersects(double minX1, double minY1, double maxX1, double maxY1,
                      double minX2, double minY2, double maxX2, double maxY2) {
    return (minX1 <= maxX2 && maxX1 >= minX2 &&
            minY1 <= maxY2 && maxY1 >= minY2) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int bounds_contains_point(double minX, double minY, double maxX, double maxY,
                          double px, double py) {
    return (px >= minX && px <= maxX && py >= minY && py <= maxY) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
int bounds_contains_bounds(double minX1, double minY1, double maxX1, double maxY1,
                           double minX2, double minY2, double maxX2, double maxY2) {
    return (minX2 >= minX1 && maxX2 <= maxX1 &&
            minY2 >= minY1 && maxY2 <= maxY1) ? 1 : 0;
}

EMSCRIPTEN_KEEPALIVE
void bounds_union(double minX1, double minY1, double maxX1, double maxY1,
                  double minX2, double minY2, double maxX2, double maxY2) {
    result_buf[0] = fmin(minX1, minX2);
    result_buf[1] = fmin(minY1, minY2);
    result_buf[2] = fmax(maxX1, maxX2);
    result_buf[3] = fmax(maxY1, maxY2);
}

EMSCRIPTEN_KEEPALIVE
int bounds_intersection(double minX1, double minY1, double maxX1, double maxY1,
                        double minX2, double minY2, double maxX2, double maxY2) {
    double minX = fmax(minX1, minX2);
    double minY = fmax(minY1, minY2);
    double maxX = fmin(maxX1, maxX2);
    double maxY = fmin(maxY1, maxY2);
    if (minX > maxX || minY > maxY) {
        /* Return EMPTY sentinel */
        result_buf[0] = 1.0 / 0.0;   /* Infinity */
        result_buf[1] = 1.0 / 0.0;
        result_buf[2] = -1.0 / 0.0;  /* -Infinity */
        result_buf[3] = -1.0 / 0.0;
        return 0;
    }
    result_buf[0] = minX;
    result_buf[1] = minY;
    result_buf[2] = maxX;
    result_buf[3] = maxY;
    return 1;
}

EMSCRIPTEN_KEEPALIVE
void bounds_expand(double minX, double minY, double maxX, double maxY, double margin) {
    result_buf[0] = minX - margin;
    result_buf[1] = minY - margin;
    result_buf[2] = maxX + margin;
    result_buf[3] = maxY + margin;
}

EMSCRIPTEN_KEEPALIVE
void bounds_expand_xy(double minX, double minY, double maxX, double maxY,
                      double mx, double my) {
    result_buf[0] = minX - mx;
    result_buf[1] = minY - my;
    result_buf[2] = maxX + mx;
    result_buf[3] = maxY + my;
}

EMSCRIPTEN_KEEPALIVE
void bounds_translate(double minX, double minY, double maxX, double maxY,
                      double dx, double dy) {
    result_buf[0] = minX + dx;
    result_buf[1] = minY + dy;
    result_buf[2] = maxX + dx;
    result_buf[3] = maxY + dy;
}

EMSCRIPTEN_KEEPALIVE
int bounds_equals(double minX1, double minY1, double maxX1, double maxY1,
                  double minX2, double minY2, double maxX2, double maxY2,
                  double epsilon) {
    return (fabs(minX1 - minX2) < epsilon &&
            fabs(minY1 - minY2) < epsilon &&
            fabs(maxX1 - maxX2) < epsilon &&
            fabs(maxY1 - maxY2) < epsilon) ? 1 : 0;
}

/* Input buffer for bounds_from_points (points written by JS before call) */
EMSCRIPTEN_KEEPALIVE
void bounds_from_points(double* points, int count) {
    if (count == 0) {
        result_buf[0] = 1.0 / 0.0;
        result_buf[1] = 1.0 / 0.0;
        result_buf[2] = -1.0 / 0.0;
        result_buf[3] = -1.0 / 0.0;
        return;
    }
    double minX = points[0], minY = points[1];
    double maxX = points[0], maxY = points[1];
    for (int i = 1; i < count; i++) {
        double x = points[i * 2];
        double y = points[i * 2 + 1];
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    }
    result_buf[0] = minX;
    result_buf[1] = minY;
    result_buf[2] = maxX;
    result_buf[3] = maxY;
}


/* ══════════════════════════════════════════════════════════════
 *  Bezier Operations
 * ══════════════════════════════════════════════════════════════ */

/* Gauss-Legendre 5-point quadrature weights and abscissae */
static const double GL5_WEIGHTS[5] = {
    0.2369268850561891, 0.4786286704993665, 0.5688888888888889,
    0.4786286704993665, 0.2369268850561891
};

static const double GL5_ABSCISSAE[5] = {
    -0.9061798459386640, -0.5384693101056831, 0.0,
     0.5384693101056831,  0.9061798459386640
};

EMSCRIPTEN_KEEPALIVE
void bezier_point(double p0x, double p0y, double p1x, double p1y,
                  double p2x, double p2y, double p3x, double p3y,
                  double t) {
    double mt = 1.0 - t;
    double mt2 = mt * mt;
    double t2 = t * t;
    result_buf[0] = mt2 * mt * p0x + 3.0 * mt2 * t * p1x + 3.0 * mt * t2 * p2x + t2 * t * p3x;
    result_buf[1] = mt2 * mt * p0y + 3.0 * mt2 * t * p1y + 3.0 * mt * t2 * p2y + t2 * t * p3y;
}

EMSCRIPTEN_KEEPALIVE
void bezier_derivative(double p0x, double p0y, double p1x, double p1y,
                       double p2x, double p2y, double p3x, double p3y,
                       double t) {
    double mt = 1.0 - t;
    double mt2 = mt * mt;
    double t2 = t * t;
    result_buf[0] = 3.0 * mt2 * (p1x - p0x) + 6.0 * mt * t * (p2x - p1x) + 3.0 * t2 * (p3x - p2x);
    result_buf[1] = 3.0 * mt2 * (p1y - p0y) + 6.0 * mt * t * (p2y - p1y) + 3.0 * t2 * (p3y - p2y);
}

EMSCRIPTEN_KEEPALIVE
void bezier_second_derivative(double p0x, double p0y, double p1x, double p1y,
                              double p2x, double p2y, double p3x, double p3y,
                              double t) {
    double mt = 1.0 - t;
    result_buf[0] = 6.0 * mt * (p2x - 2.0 * p1x + p0x) + 6.0 * t * (p3x - 2.0 * p2x + p1x);
    result_buf[1] = 6.0 * mt * (p2y - 2.0 * p1y + p0y) + 6.0 * t * (p3y - 2.0 * p2y + p1y);
}

EMSCRIPTEN_KEEPALIVE
void bezier_subdivide(double p0x, double p0y, double p1x, double p1y,
                      double p2x, double p2y, double p3x, double p3y,
                      double t) {
    /* Level 1 */
    double q0x = p0x + (p1x - p0x) * t, q0y = p0y + (p1y - p0y) * t;
    double q1x = p1x + (p2x - p1x) * t, q1y = p1y + (p2y - p1y) * t;
    double q2x = p2x + (p3x - p2x) * t, q2y = p2y + (p3y - p2y) * t;
    /* Level 2 */
    double r0x = q0x + (q1x - q0x) * t, r0y = q0y + (q1y - q0y) * t;
    double r1x = q1x + (q2x - q1x) * t, r1y = q1y + (q2y - q1y) * t;
    /* Level 3 - split point */
    double sx = r0x + (r1x - r0x) * t, sy = r0y + (r1y - r0y) * t;

    /* Left: p0, q0, r0, s  |  Right: s, r1, q2, p3 */
    result_buf[0]  = p0x; result_buf[1]  = p0y;
    result_buf[2]  = q0x; result_buf[3]  = q0y;
    result_buf[4]  = r0x; result_buf[5]  = r0y;
    result_buf[6]  = sx;  result_buf[7]  = sy;
    result_buf[8]  = sx;  result_buf[9]  = sy;
    result_buf[10] = r1x; result_buf[11] = r1y;
    result_buf[12] = q2x; result_buf[13] = q2y;
    result_buf[14] = p3x; result_buf[15] = p3y;
}

EMSCRIPTEN_KEEPALIVE
double bezier_arc_length(double p0x, double p0y, double p1x, double p1y,
                         double p2x, double p2y, double p3x, double p3y,
                         double t_start, double t_end) {
    double half_range = (t_end - t_start) / 2.0;
    double midpoint = (t_end + t_start) / 2.0;
    double sum = 0.0;

    for (int i = 0; i < 5; i++) {
        double t = half_range * GL5_ABSCISSAE[i] + midpoint;
        double mt = 1.0 - t;
        double mt2 = mt * mt;
        double t2 = t * t;
        double dx = 3.0 * mt2 * (p1x - p0x) + 6.0 * mt * t * (p2x - p1x) + 3.0 * t2 * (p3x - p2x);
        double dy = 3.0 * mt2 * (p1y - p0y) + 6.0 * mt * t * (p2y - p1y) + 3.0 * t2 * (p3y - p2y);
        sum += GL5_WEIGHTS[i] * sqrt(dx * dx + dy * dy);
    }

    return half_range * sum;
}

/* Internal helper: evaluate bezier point into outX, outY */
static void bezier_point_inline(double p0x, double p0y, double p1x, double p1y,
                                double p2x, double p2y, double p3x, double p3y,
                                double t, double* outX, double* outY) {
    double mt = 1.0 - t;
    double mt2 = mt * mt;
    double t2 = t * t;
    *outX = mt2 * mt * p0x + 3.0 * mt2 * t * p1x + 3.0 * mt * t2 * p2x + t2 * t * p3x;
    *outY = mt2 * mt * p0y + 3.0 * mt2 * t * p1y + 3.0 * mt * t2 * p2y + t2 * t * p3y;
}

EMSCRIPTEN_KEEPALIVE
void bezier_nearest_point(double p0x, double p0y, double p1x, double p1y,
                          double p2x, double p2y, double p3x, double p3y,
                          double qx, double qy,
                          int samples, int iterations) {
    /* Coarse sampling */
    double best_t = 0.0;
    double best_dist_sq = 1e300;

    for (int i = 0; i <= samples; i++) {
        double t = (double)i / (double)samples;
        double px, py;
        bezier_point_inline(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t, &px, &py);
        double dx = px - qx, dy = py - qy;
        double dist_sq = dx * dx + dy * dy;
        if (dist_sq < best_dist_sq) {
            best_dist_sq = dist_sq;
            best_t = t;
        }
    }

    /* Newton-Raphson refinement */
    double t = best_t;
    for (int i = 0; i < iterations; i++) {
        double mt = 1.0 - t;
        double mt2 = mt * mt;
        double t2 = t * t;

        /* P(t) */
        double px = mt2 * mt * p0x + 3.0 * mt2 * t * p1x + 3.0 * mt * t2 * p2x + t2 * t * p3x;
        double py = mt2 * mt * p0y + 3.0 * mt2 * t * p1y + 3.0 * mt * t2 * p2y + t2 * t * p3y;

        /* P'(t) */
        double d1x = 3.0 * mt2 * (p1x - p0x) + 6.0 * mt * t * (p2x - p1x) + 3.0 * t2 * (p3x - p2x);
        double d1y = 3.0 * mt2 * (p1y - p0y) + 6.0 * mt * t * (p2y - p1y) + 3.0 * t2 * (p3y - p2y);

        /* P''(t) */
        double d2x = 6.0 * mt * (p2x - 2.0 * p1x + p0x) + 6.0 * t * (p3x - 2.0 * p2x + p1x);
        double d2y = 6.0 * mt * (p2y - 2.0 * p1y + p0y) + 6.0 * t * (p3y - 2.0 * p2y + p1y);

        double diff_x = px - qx, diff_y = py - qy;

        double f = diff_x * d1x + diff_y * d1y;
        double f_prime = d1x * d1x + d1y * d1y + diff_x * d2x + diff_y * d2y;

        if (fabs(f_prime) < 1e-12) break;

        t -= f / f_prime;
        if (t < 0.0) t = 0.0;
        if (t > 1.0) t = 1.0;
    }

    double rx, ry;
    bezier_point_inline(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t, &rx, &ry);
    double dx = rx - qx, dy = ry - qy;

    result_buf[0] = t;
    result_buf[1] = rx;
    result_buf[2] = ry;
    result_buf[3] = sqrt(dx * dx + dy * dy);
}

EMSCRIPTEN_KEEPALIVE
void bezier_bounds(double p0x, double p0y, double p1x, double p1y,
                   double p2x, double p2y, double p3x, double p3y) {
    double minX = fmin(p0x, p3x);
    double maxX = fmax(p0x, p3x);
    double minY = fmin(p0y, p3y);
    double maxY = fmax(p0y, p3y);

    /* For each axis (0=x, 1=y), solve derivative = 0 */
    double coords[4][2] = { {p0x, p0y}, {p1x, p1y}, {p2x, p2y}, {p3x, p3y} };

    for (int axis = 0; axis < 2; axis++) {
        double a0 = coords[0][axis], a1 = coords[1][axis];
        double a2 = coords[2][axis], a3 = coords[3][axis];

        double a = -3.0 * a0 + 9.0 * a1 - 9.0 * a2 + 3.0 * a3;
        double b = 6.0 * a0 - 12.0 * a1 + 6.0 * a2;
        double c = -3.0 * a0 + 3.0 * a1;

        if (fabs(a) < 1e-12) {
            /* Linear */
            if (fabs(b) > 1e-12) {
                double t = -c / b;
                if (t > 0.0 && t < 1.0) {
                    double vx, vy;
                    bezier_point_inline(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t, &vx, &vy);
                    double val = (axis == 0) ? vx : vy;
                    if (axis == 0) { minX = fmin(minX, val); maxX = fmax(maxX, val); }
                    else           { minY = fmin(minY, val); maxY = fmax(maxY, val); }
                }
            }
            continue;
        }

        double disc = b * b - 4.0 * a * c;
        if (disc < 0.0) continue;
        double sqrt_disc = sqrt(disc);

        double roots[2] = { (-b + sqrt_disc) / (2.0 * a), (-b - sqrt_disc) / (2.0 * a) };
        for (int r = 0; r < 2; r++) {
            double t = roots[r];
            if (t > 0.0 && t < 1.0) {
                double vx, vy;
                bezier_point_inline(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, t, &vx, &vy);
                double val = (axis == 0) ? vx : vy;
                if (axis == 0) { minX = fmin(minX, val); maxX = fmax(maxX, val); }
                else           { minY = fmin(minY, val); maxY = fmax(maxY, val); }
            }
        }
    }

    result_buf[0] = minX;
    result_buf[1] = minY;
    result_buf[2] = maxX;
    result_buf[3] = maxY;
}

/* ── Adaptive subdivision ─────────────────────────────────────
 *
 * This is more complex because it produces a variable-length array.
 * We use a pre-allocated output buffer in WASM memory.
 * Max points = 2^maxDepth + 1 = 257 points = 514 doubles.
 */

#define MAX_ADAPTIVE_POINTS 512
static double adaptive_buf[MAX_ADAPTIVE_POINTS * 2];
static int adaptive_count;

static int is_flat_enough(double p0x, double p0y, double p1x, double p1y,
                          double p2x, double p2y, double p3x, double p3y,
                          double tolerance) {
    double dx = p3x - p0x;
    double dy = p3y - p0y;
    double len_sq = dx * dx + dy * dy;

    if (len_sq < 1e-12) {
        double d1 = (p1x - p0x) * (p1x - p0x) + (p1y - p0y) * (p1y - p0y);
        double d2 = (p2x - p0x) * (p2x - p0x) + (p2y - p0y) * (p2y - p0y);
        double max_d = d1 > d2 ? d1 : d2;
        return max_d <= tolerance * tolerance ? 1 : 0;
    }

    double inv_len = 1.0 / sqrt(len_sq);
    double nx = -dy * inv_len;
    double ny = dx * inv_len;

    double d1 = fabs(nx * (p1x - p0x) + ny * (p1y - p0y));
    double d2 = fabs(nx * (p2x - p0x) + ny * (p2y - p0y));

    double max_d = d1 > d2 ? d1 : d2;
    return max_d <= tolerance ? 1 : 0;
}

static void adaptive_subdivide_impl(
    double p0x, double p0y, double p1x, double p1y,
    double p2x, double p2y, double p3x, double p3y,
    double tolerance, int max_depth, int depth)
{
    if (adaptive_count >= MAX_ADAPTIVE_POINTS) return;

    if (depth >= max_depth || is_flat_enough(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y, tolerance)) {
        adaptive_buf[adaptive_count * 2]     = p3x;
        adaptive_buf[adaptive_count * 2 + 1] = p3y;
        adaptive_count++;
        return;
    }

    double t = 0.5;
    /* Level 1 */
    double q0x = p0x + (p1x - p0x) * t, q0y = p0y + (p1y - p0y) * t;
    double q1x = p1x + (p2x - p1x) * t, q1y = p1y + (p2y - p1y) * t;
    double q2x = p2x + (p3x - p2x) * t, q2y = p2y + (p3y - p2y) * t;
    /* Level 2 */
    double r0x = q0x + (q1x - q0x) * t, r0y = q0y + (q1y - q0y) * t;
    double r1x = q1x + (q2x - q1x) * t, r1y = q1y + (q2y - q1y) * t;
    /* Level 3 */
    double sx = r0x + (r1x - r0x) * t, sy = r0y + (r1y - r0y) * t;

    adaptive_subdivide_impl(p0x, p0y, q0x, q0y, r0x, r0y, sx, sy,
                            tolerance, max_depth, depth + 1);
    adaptive_subdivide_impl(sx, sy, r1x, r1y, q2x, q2y, p3x, p3y,
                            tolerance, max_depth, depth + 1);
}

EMSCRIPTEN_KEEPALIVE
int bezier_adaptive_subdivide(double p0x, double p0y, double p1x, double p1y,
                              double p2x, double p2y, double p3x, double p3y,
                              double tolerance, int max_depth) {
    adaptive_count = 0;
    /* First point is p0 */
    adaptive_buf[0] = p0x;
    adaptive_buf[1] = p0y;
    adaptive_count = 1;

    adaptive_subdivide_impl(p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y,
                            tolerance, max_depth, 0);

    return adaptive_count;
}

EMSCRIPTEN_KEEPALIVE
double* get_adaptive_buf(void) {
    return adaptive_buf;
}

/* ── Points input buffer for bounds_from_points ─────────────── */
#define MAX_INPUT_POINTS 4096
static double input_points_buf[MAX_INPUT_POINTS * 2];

EMSCRIPTEN_KEEPALIVE
double* get_input_points_ptr(void) {
    return input_points_buf;
}
