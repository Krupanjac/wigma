import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { LineNode } from '../../scene-graph/line-node';
import { colorToNumber } from '@shared/utils/color-utils';
import { graphicsPool } from '../../pools/graphics-pool';

export class LineRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'line';

  create(_node: BaseNode): Graphics {
    return graphicsPool.acquire();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    const line = node as LineNode;
    gfx.clear();
    gfx.moveTo(line.startPoint.x, line.startPoint.y);
    gfx.lineTo(line.endPoint.x, line.endPoint.y);
    gfx.stroke({ color: colorToNumber(line.stroke.color), width: line.stroke.width });
  }

  destroy(gfx: Graphics): void {
    graphicsPool.release(gfx);
  }
}
