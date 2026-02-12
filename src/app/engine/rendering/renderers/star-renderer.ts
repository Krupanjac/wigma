import { Graphics } from 'pixi.js';
import { BaseRenderer } from './base-renderer';
import { BaseNode, NodeType } from '../../scene-graph/base-node';
import { StarNode } from '../../scene-graph/star-node';
import { colorToNumber } from '@shared/utils/color-utils';
import { graphicsPool } from '../../pools/graphics-pool';

export class StarRenderer extends BaseRenderer<Graphics> {
  readonly nodeType: NodeType = 'star';

  create(_node: BaseNode): Graphics {
    return graphicsPool.acquire();
  }

  sync(node: BaseNode, gfx: Graphics): void {
    const star = node as StarNode;
    gfx.clear();
    const verts = star.vertices;
    if (verts.length < 3) return;
    const flat: number[] = [];
    for (const v of verts) { flat.push(v.x, v.y); }
    gfx.poly(flat, true);
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
