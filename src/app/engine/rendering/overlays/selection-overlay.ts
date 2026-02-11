import { Container, Graphics } from 'pixi.js';
import {
  HANDLE_FILL,
  HANDLE_SIZE,
  HANDLE_STROKE,
  ROTATION_HANDLE_DISTANCE,
  SELECTION_COLOR,
  SELECTION_STROKE_WIDTH,
} from '@shared/constants';

/**
 * Selection overlay — renders selection bounds, resize handles,
 * and rotation handle over selected nodes.
 *
 * Coordinates are screen-space pixels.
 */
export class SelectionOverlay {
  private visible: boolean = false;
  private gfx: Graphics = new Graphics();

  attach(stage: Container): void {
    stage.addChild(this.gfx);
  }

  show(): void { this.visible = true; }
  hide(): void {
    this.visible = false;
    this.gfx.clear();
  }

  /**
   * Update the overlay to match current selection bounds.
   * Draws: bounding rectangle, 8 resize handles, rotation handle.
   */
  update(
    minX: number, minY: number,
    maxX: number, maxY: number,
    zoom: number
  ): void {
    void zoom;
    this.gfx.clear();
    if (!this.visible) return;

    const w = Math.max(0, maxX - minX);
    const h = Math.max(0, maxY - minY);

    // Outline
    this.gfx.rect(minX, minY, w, h);
    this.gfx.stroke({ color: SELECTION_COLOR, width: SELECTION_STROKE_WIDTH });

    // Handles (constant size in screen-space)
    const hs = HANDLE_SIZE;
    const half = hs / 2;
    const cx = minX + w / 2;
    const cy = minY + h / 2;

    const handlePoints: Array<[number, number]> = [
      [minX, minY],
      [cx, minY],
      [maxX, minY],
      [minX, cy],
      [maxX, cy],
      [minX, maxY],
      [cx, maxY],
      [maxX, maxY],
    ];

    for (const [hx, hy] of handlePoints) {
      this.gfx.rect(hx - half, hy - half, hs, hs);
      this.gfx.fill({ color: HANDLE_FILL, alpha: 1 });
      this.gfx.stroke({ color: HANDLE_STROKE, width: 1 });
    }

    // Rotation handle
    const rotX = cx;
    const rotY = minY - ROTATION_HANDLE_DISTANCE;
    this.gfx.moveTo(cx, minY);
    this.gfx.lineTo(rotX, rotY);
    this.gfx.stroke({ color: SELECTION_COLOR, width: 1 });
    this.gfx.circle(rotX, rotY, hs / 2);
    this.gfx.fill({ color: HANDLE_FILL, alpha: 1 });
    this.gfx.stroke({ color: HANDLE_STROKE, width: 1 });
  }

  dispose(): void {
    this.visible = false;
    this.gfx.destroy();
  }
}
