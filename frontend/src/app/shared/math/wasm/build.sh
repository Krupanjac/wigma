#!/usr/bin/env bash
#
# Build script for WASM math library using Emscripten.
#
# Usage:
#   cd frontend/src/app/shared/math/wasm
#   ./build.sh
#
# Output:
#   ../math_wasm.js   - ES module glue code
#   ../math_wasm.wasm - WebAssembly binary (loaded by the JS glue)
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Compiling math_wasm.c → WASM"

emcc "$SCRIPT_DIR/math_wasm.c" \
    -O3 \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME="MathWasmModule" \
    -s ENVIRONMENT='web,worker' \
    -s ALLOW_MEMORY_GROWTH=0 \
    -s INITIAL_MEMORY=1048576 \
    -s STACK_SIZE=65536 \
    -s NO_FILESYSTEM=1 \
    -s EXPORTED_FUNCTIONS='[
        "_get_result_ptr",
        "_get_adaptive_buf",
        "_get_input_points_ptr",
        "_vec2_add", "_vec2_sub", "_vec2_scale", "_vec2_scale_xy",
        "_vec2_negate", "_vec2_dot", "_vec2_cross",
        "_vec2_length", "_vec2_length_squared",
        "_vec2_normalize", "_vec2_distance", "_vec2_distance_squared",
        "_vec2_lerp", "_vec2_angle", "_vec2_angle_to",
        "_vec2_rotate", "_vec2_rotate_around",
        "_vec2_perpendicular", "_vec2_reflect",
        "_vec2_clamp", "_vec2_abs", "_vec2_floor", "_vec2_ceil", "_vec2_round",
        "_vec2_equals", "_vec2_normalize_mut",
        "_mat2d_translation", "_mat2d_scaling", "_mat2d_rotation",
        "_mat2d_from_trs", "_mat2d_multiply", "_mat2d_invert",
        "_mat2d_apply", "_mat2d_decompose",
        "_mat2d_translate", "_mat2d_scale", "_mat2d_equals",
        "_bounds_intersects", "_bounds_contains_point", "_bounds_contains_bounds",
        "_bounds_union", "_bounds_intersection",
        "_bounds_expand", "_bounds_expand_xy", "_bounds_translate",
        "_bounds_equals", "_bounds_from_points",
        "_bezier_point", "_bezier_derivative", "_bezier_second_derivative",
        "_bezier_subdivide", "_bezier_arc_length",
        "_bezier_nearest_point", "_bezier_bounds",
        "_bezier_adaptive_subdivide",
        "_malloc", "_free"
    ]' \
    -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap","HEAPF64"]' \
    -o "$OUT_DIR/math_wasm.mjs" \
    --no-entry

echo "==> Output files:"
ls -lh "$OUT_DIR/math_wasm.mjs" "$OUT_DIR/math_wasm.wasm"
echo "==> Build complete!"
