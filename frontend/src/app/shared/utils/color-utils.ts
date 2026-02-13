/**
 * Color utility functions for design tool operations.
 */

/** RGBA color in 0–1 range. */
export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** Parse a hex string (#RRGGBB or #RRGGBBAA) to Color. */
export function hexToColor(hex: string): Color {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

/** Convert Color to hex string (#RRGGBB or #RRGGBBAA). */
export function colorToHex(color: Color, includeAlpha: boolean = false): string {
  const r = Math.round(color.r * 255).toString(16).padStart(2, '0');
  const g = Math.round(color.g * 255).toString(16).padStart(2, '0');
  const b = Math.round(color.b * 255).toString(16).padStart(2, '0');
  if (includeAlpha) {
    const a = Math.round(color.a * 255).toString(16).padStart(2, '0');
    return `#${r}${g}${b}${a}`;
  }
  return `#${r}${g}${b}`;
}

/** Convert Color to a PixiJS-compatible numeric value (0xRRGGBB). */
export function colorToNumber(color: Color): number {
  return (
    (Math.round(color.r * 255) << 16) |
    (Math.round(color.g * 255) << 8) |
    Math.round(color.b * 255)
  );
}

/** Parse a numeric color (0xRRGGBB) to Color. */
export function numberToColor(num: number, alpha: number = 1): Color {
  return {
    r: ((num >> 16) & 0xff) / 255,
    g: ((num >> 8) & 0xff) / 255,
    b: (num & 0xff) / 255,
    a: alpha,
  };
}

/** Convert Color to CSS rgba() string. */
export function colorToCss(color: Color): string {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  return `rgba(${r}, ${g}, ${b}, ${color.a.toFixed(2)})`;
}

/** Linearly interpolate between two colors. */
export function lerpColor(a: Color, b: Color, t: number): Color {
  return {
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t,
    a: a.a + (b.a - a.a) * t,
  };
}

/** Predefined colors. */
export const Colors = {
  WHITE: { r: 1, g: 1, b: 1, a: 1 } as Color,
  BLACK: { r: 0, g: 0, b: 0, a: 1 } as Color,
  RED: { r: 1, g: 0, b: 0, a: 1 } as Color,
  GREEN: { r: 0, g: 1, b: 0, a: 1 } as Color,
  BLUE: { r: 0, g: 0, b: 1, a: 1 } as Color,
  TRANSPARENT: { r: 0, g: 0, b: 0, a: 0 } as Color,
  SELECTION_BLUE: { r: 0.22, g: 0.52, b: 1, a: 1 } as Color,
} as const;
