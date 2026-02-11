import { Container, Graphics } from 'pixi.js';
import { Camera } from '../../viewport/camera';
import { SNAP_LINE_COLOR, SNAP_LINE_OPACITY } from '@shared/constants';
import { Guide } from '../../interaction/guide-state';
import { Vec2 } from '@shared/math/vec2';

/**
 * Guide overlay — renders snap/alignment guides.
 * Values are stored in world-space and rendered in screen-space.
 */
export class GuideOverlay {
  private guides: Guide[] = [];
  private gfx: Graphics = new Graphics();

  attach(stage: Container): void {
    stage.addChild(this.gfx);
  }

  setGuides(guides: Guide[]): void {
    this.guides = guides;
  }

  clearGuides(): void {
    this.guides = [];
    this.gfx.clear();
  }

  update(camera: Camera): void {
    this.gfx.clear();
    if (this.guides.length === 0) return;

    const w = camera.screenWidth;
    const h = camera.screenHeight;

    for (const g of this.guides) {
      if (g.axis === 'x') {
        const x = camera.worldToScreen(new Vec2(g.value, 0)).x;
        this.gfx.moveTo(x, 0);
        this.gfx.lineTo(x, h);
      } else {
        const y = camera.worldToScreen(new Vec2(0, g.value)).y;
        this.gfx.moveTo(0, y);
        this.gfx.lineTo(w, y);
      }
    }

    this.gfx.stroke({ color: SNAP_LINE_COLOR, alpha: SNAP_LINE_OPACITY, width: 1 });
  }

  dispose(): void {
    this.guides = [];
    this.gfx.destroy();
  }
}
