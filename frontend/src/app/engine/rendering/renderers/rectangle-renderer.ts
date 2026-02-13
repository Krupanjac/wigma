import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { RectangleNode } from '../../scene-graph/rectangle-node';
import { colorToNumber } from '@shared/utils/color-utils';
import { graphicsPool } from '../../pools/graphics-pool';

export class RectangleRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'rectangle';

  create(_node: BaseNode): Graphics {
    return graphicsPool.acquire();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    const rect = node as RectangleNode;
    gfx.clear();
    if (rect.cornerRadius > 0) {
      gfx.roundRect(0, 0, rect.width, rect.height, rect.cornerRadius);
    } else {
      gfx.rect(0, 0, rect.width, rect.height);
    }
    if (rect.fill.visible) {
      gfx.fill({ color: colorToNumber(rect.fill.color), alpha: rect.fill.color.a });
    }
    if (rect.stroke.visible && rect.stroke.width > 0) {
      gfx.stroke({ color: colorToNumber(rect.stroke.color), width: rect.stroke.width });
    }
  }

  destroy(gfx: Graphics): void {
    graphicsPool.release(gfx);
  }
}
