import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { colorToNumber } from '@shared/utils/color-utils';
import { graphicsPool } from '../../pools/graphics-pool';

export class EllipseRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'ellipse';

  create(_node: BaseNode): Graphics {
    return graphicsPool.acquire();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    gfx.clear();
    gfx.ellipse(node.width / 2, node.height / 2, node.width / 2, node.height / 2);
    if (node.fill.visible) {
      gfx.fill({ color: colorToNumber(node.fill.color), alpha: node.fill.color.a });
    }
    if (node.stroke.visible && node.stroke.width > 0) {
      gfx.stroke({ color: colorToNumber(node.stroke.color), width: node.stroke.width });
    }
  }

  destroy(gfx: Graphics): void {
    graphicsPool.release(gfx);
  }
}
