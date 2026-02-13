import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { ArrowNode } from '../../scene-graph/arrow-node';
import { colorToNumber } from '@shared/utils/color-utils';
import { graphicsPool } from '../../pools/graphics-pool';

export class ArrowRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'arrow';

  create(_node: BaseNode): Graphics {
    return graphicsPool.acquire();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    const arrow = node as ArrowNode;
    gfx.clear();
    const strokeColor = colorToNumber(arrow.stroke.color);
    gfx.moveTo(arrow.startPoint.x, arrow.startPoint.y);
    gfx.lineTo(arrow.endPoint.x, arrow.endPoint.y);
    gfx.stroke({ color: strokeColor, width: arrow.stroke.width });
    if (arrow.endArrow !== 'none') {
      const dx = arrow.endPoint.x - arrow.startPoint.x;
      const dy = arrow.endPoint.y - arrow.startPoint.y;
      const angle = Math.atan2(dy, dx);
      const size = arrow.arrowSize;
      const x1 = arrow.endPoint.x - size * Math.cos(angle - Math.PI / 6);
      const y1 = arrow.endPoint.y - size * Math.sin(angle - Math.PI / 6);
      const x2 = arrow.endPoint.x - size * Math.cos(angle + Math.PI / 6);
      const y2 = arrow.endPoint.y - size * Math.sin(angle + Math.PI / 6);
      gfx.poly([arrow.endPoint.x, arrow.endPoint.y, x1, y1, x2, y2], true);
      gfx.fill({ color: strokeColor });
    }
  }

  destroy(gfx: Graphics): void {
    graphicsPool.release(gfx);
  }
}
