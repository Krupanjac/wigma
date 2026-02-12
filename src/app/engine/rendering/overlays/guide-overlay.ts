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

    for (const g of this.guides) {
      if (g.axis === 'x') {
        const from = camera.worldToScreen(new Vec2(g.value, g.min));
        const to = camera.worldToScreen(new Vec2(g.value, g.max));
        this.gfx.moveTo(from.x, from.y);
        this.gfx.lineTo(to.x, to.y);
      } else {
        const from = camera.worldToScreen(new Vec2(g.min, g.value));
        const to = camera.worldToScreen(new Vec2(g.max, g.value));
        this.gfx.moveTo(from.x, from.y);
        this.gfx.lineTo(to.x, to.y);
      }
    }

    this.gfx.stroke({ color: SNAP_LINE_COLOR, alpha: SNAP_LINE_OPACITY, width: 1 });
  }

  dispose(): void {
    this.guides = [];
    this.gfx.destroy();
  }
}
