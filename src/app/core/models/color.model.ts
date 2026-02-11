/**
 * Color model for the design tool.
 */
export interface ColorModel {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface GradientStop {
  color: ColorModel;
  position: number;
}

export interface GradientModel {
  type: 'linear' | 'radial';
  angle: number;
  stops: GradientStop[];
}

export type PaintModel = { type: 'solid'; color: ColorModel } | { type: 'gradient'; gradient: GradientModel };
