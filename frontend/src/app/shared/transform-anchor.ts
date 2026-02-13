export type TransformAnchor =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

export interface AnchorNormalized {
  x: number;
  y: number;
}

export const TRANSFORM_ANCHORS: TransformAnchor[] = [
  'top-left',
  'top-center',
  'top-right',
  'middle-left',
  'center',
  'middle-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
];

export function anchorToNormalized(anchor: TransformAnchor): AnchorNormalized {
  switch (anchor) {
    case 'top-left': return { x: 0, y: 0 };
    case 'top-center': return { x: 0.5, y: 0 };
    case 'top-right': return { x: 1, y: 0 };
    case 'middle-left': return { x: 0, y: 0.5 };
    case 'center': return { x: 0.5, y: 0.5 };
    case 'middle-right': return { x: 1, y: 0.5 };
    case 'bottom-left': return { x: 0, y: 1 };
    case 'bottom-center': return { x: 0.5, y: 1 };
    case 'bottom-right': return { x: 1, y: 1 };
  }
}
