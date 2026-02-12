/**
 * Application-wide constants.
 */

// ── Canvas ───────────────────────────────────────────────────

export const DEFAULT_CANVAS_BG = 0x09090b;

// ── Viewport ─────────────────────────────────────────────────

export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 256;
export const ZOOM_SPEED = 0.002;
export const ZOOM_LERP_FRAMES = 5;
export const PAN_SPEED = 1;

// ── Grid ─────────────────────────────────────────────────────

export const DEFAULT_GRID_SIZE = 8;
export const GRID_VISIBLE_MIN_ZOOM = 0.25;
export const GRID_COLOR = 0x27272a;
export const GRID_OPACITY = 0.4;

// ── Snapping ─────────────────────────────────────────────────

export const SNAP_THRESHOLD = 5; // pixels (screen-space)
export const SNAP_LINE_COLOR = 0xff3988;
export const SNAP_LINE_OPACITY = 0.8;

// ── Selection ────────────────────────────────────────────────

export const SELECTION_COLOR = 0x3b82f6;
export const SELECTION_STROKE_WIDTH = 1.5;
export const HANDLE_SIZE = 8;
export const HANDLE_FILL = 0xffffff;
export const HANDLE_STROKE = 0x3b82f6;
export const ROTATION_HANDLE_DISTANCE = 24;

export const MARQUEE_FILL_COLOR = 0x3b82f6;
export const MARQUEE_FILL_ALPHA = 0.16;
export const MARQUEE_STROKE_COLOR = 0x3b82f6;
export const MARQUEE_STROKE_ALPHA = 0.5;

// ── Hit-Testing ──────────────────────────────────────────────

export const HIT_TOLERANCE = 4; // pixels (screen-space), expanded for stroke/path hit
export const PATH_HIT_EXPAND = 4; // extra tolerance for Bézier nearest-point hit

// ── R-tree ───────────────────────────────────────────────────

export const RTREE_MAX_ENTRIES = 9; // rbush default M value

// ── History ──────────────────────────────────────────────────

export const MAX_HISTORY_SIZE = 200;
export const MERGE_WINDOW_MS = 300;

// ── Rendering ────────────────────────────────────────────────

export const IDLE_FRAME_SKIP = true;

// ── Default Node Properties ─────────────────────────────────

export const DEFAULT_FILL_COLOR = 0xd4d4d8;
export const DEFAULT_STROKE_COLOR = 0x000000;
export const DEFAULT_STROKE_WIDTH = 0;
export const DEFAULT_OPACITY = 1;
export const DEFAULT_CORNER_RADIUS = 0;
export const DEFAULT_FONT_SIZE = 16;
export const DEFAULT_FONT_FAMILY = 'Inter';
export const DEFAULT_TEXT_COLOR = 0x000000;

// ── Object Pool Sizes ────────────────────────────────────────

export const POOL_GRAPHICS_INITIAL = 64;
export const POOL_CONTAINER_INITIAL = 32;
export const POOL_SPRITE_INITIAL = 16;
export const POOL_TEXT_INITIAL = 16;

// ── Bézier ───────────────────────────────────────────────────

export const BEZIER_FLATNESS_TOLERANCE = 0.5;
export const BEZIER_MAX_SUBDIVISION_DEPTH = 8;
export const BEZIER_NEWTON_ITERATIONS = 5;
export const BEZIER_COARSE_SAMPLES = 8;
